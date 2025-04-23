// server/repositories/mappingRepository.ts\
import type { SystemField, FieldMapping, MappingConfiguration } from '~/types/mapping';

// Helper functions to transform DB rows to typed objects
const transformSystemFieldRow = (row: Record<string, any>): SystemField => {
  return {
    id: String(row.id),
    name: String(row.name),
    dataType: row.data_type as 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array',
    isRequired: Boolean(row.is_required),
    description: row.description || undefined,
    // Add the new required fields
    version: Number(row.version || 1),
    status: (row.status || 'active') as 'active' | 'deprecated' | 'draft',
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    createdBy: String(row.created_by || ''),
    changeReason: row.change_reason || undefined,
    validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : undefined,
    metadataProperties: row.metadata_properties ? JSON.parse(row.metadata_properties) : undefined
  };
};

const transformFieldMappingRow = (row: Record<string, any>): FieldMapping => {
  return {
    id: String(row.id),
    userHeaderName: String(row.user_header_name),
    systemFieldId: String(row.system_field_id),
    transformationType: row.transformation_type as 'direct' | 'formatted' | 'calculated' | undefined,
    transformationRule: row.transformation_rule || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
};

export const useMappingRepository = () => {
  const { db, status } = useDbConnection();
  
  if (status !== 'connected' || !db) {
    throw new Error('Database connection not available');
  }
  
  return {
    // Existing methods...
    
    // Modified method to handle versioned system fields
    async saveSystemField(field: SystemField): Promise<SystemField> {
      const now = new Date().toISOString();
      
      // Check if field exists
      const existing = await db.sql`
        SELECT * FROM system_fields WHERE id = ${field.id} LIMIT 1
      `;
      
      if (existing.rows && existing.rows.length > 0) {
        // Increment version for existing field
        const currentVersion = Number(existing.rows[0].version || 1);
        field.version = currentVersion + 1;
        
        // Update existing field with version info
        const result = await db.sql`
          UPDATE system_fields 
          SET 
            name = ${field.name},
            data_type = ${field.dataType},
            is_required = ${field.isRequired ? 1 : 0},
            description = ${field.description || null},
            version = ${field.version},
            status = ${field.status || 'active'},
            updated_at = ${now},
            updated_by = ${field.createdBy || null},
            validation_rules = ${field.validationRules ? JSON.stringify(field.validationRules) : null},
            metadata_properties = ${field.metadataProperties ? JSON.stringify(field.metadataProperties) : null}
          WHERE id = ${field.id}
          RETURNING *
        `;
        
        // Save version history (we'll implement this table in next step)
        await this.saveSystemFieldVersionHistory(field.id, field);
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error(`Failed to update system field with ID ${field.id}`);
        }
        
        return transformSystemFieldRow(result.rows[0]);
      } else {
        // Insert new field with initial version
        field.version = 1;
        field.createdAt = now;
        field.updatedAt = now;
        
        const result = await db.sql`
          INSERT INTO system_fields (
            id, name, data_type, is_required, description,
            version, status, created_at, updated_at, created_by,
            validation_rules, metadata_properties
          ) VALUES (
            ${field.id},
            ${field.name},
            ${field.dataType},
            ${field.isRequired ? 1 : 0},
            ${field.description || null},
            ${field.version},
            ${field.status || 'active'},
            ${now},
            ${now},
            ${field.createdBy || null},
            ${field.validationRules ? JSON.stringify(field.validationRules) : null},
            ${field.metadataProperties ? JSON.stringify(field.metadataProperties) : null}
          )
          RETURNING *
        `;
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error(`Failed to insert system field with ID ${field.id}`);
        }
        
        return transformSystemFieldRow(result.rows[0]);
      }
    },
    
    // New method to save field version history
    async saveSystemFieldVersionHistory(fieldId: string, field: SystemField): Promise<void> {
      const now = new Date().toISOString();
      
      await db.sql`
        INSERT INTO system_field_history (
          field_id, version, changed_at, changed_by, 
          field_data, change_reason
        ) VALUES (
          ${fieldId},
          ${field.version},
          ${now},
          ${field.createdBy || null},
          ${JSON.stringify(field)},
          ${field.changeReason || null}
        )
      `;
    },

    /**
 * Get all mapping configurations
 */
async getAllMappingConfigurations(): Promise<MappingConfiguration[]> {
  const result = await db.sql`
    SELECT * FROM mapping_configurations 
    ORDER BY created_at DESC
  `;
  
  const configs = result.rows || [];
  return Promise.all(configs.map(async (row: Record<string, any>) => {
    // Get mappings for this configuration
    const mappingsResult = await db.sql`
      SELECT * FROM field_mappings 
      WHERE config_id = ${row.id}
    `;
    
    const mappings = (mappingsResult.rows || []).map((mappingRow: Record<string, any>) => 
      transformFieldMappingRow(mappingRow)
    );
    
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description || undefined,
      mappings,
      createdBy: String(row.created_by),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: Number(row.version || 1),
      status: (row.status || 'draft') as 'draft' | 'published' | 'deprecated',
      effectiveFrom: row.effective_from ? new Date(row.effective_from) : undefined,
      effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
      previousVersionId: row.previous_version_id || undefined,
      changeReason: row.change_reason || undefined
    };
  }));
},

/**
 * Get a specific mapping configuration by ID
 */
async getMappingConfiguration(id: string): Promise<MappingConfiguration | null> {
  const result = await db.sql`
    SELECT * FROM mapping_configurations 
    WHERE id = ${id} LIMIT 1
  `;
  
  if (!result.rows || result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  
  // Get mappings for this configuration
  const mappingsResult = await db.sql`
    SELECT * FROM field_mappings 
    WHERE config_id = ${id}
  `;
  
  const mappings = (mappingsResult.rows || []).map((mappingRow: Record<string, any>) => 
  transformFieldMappingRow(mappingRow)
);
  
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description || undefined,
    mappings,
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version || 1),
    status: (row.status || 'draft') as 'draft' | 'published' | 'deprecated',
    effectiveFrom: row.effective_from ? new Date(row.effective_from) : undefined,
    effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
    previousVersionId: row.previous_version_id || undefined,
    changeReason: row.change_reason || undefined
  };
}
  };
};
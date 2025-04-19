// server/repositories/mappingRepository.ts
import { useDbConnection } from '../utils/db';
import type { SystemField, FieldMapping, MappingConfiguration } from '~/types/mapping';

// Helper functions to transform DB rows to typed objects
const transformSystemFieldRow = (row: Record<string, any>): SystemField => {
  return {
    id: String(row.id),
    name: String(row.name),
    dataType: row.data_type as 'string' | 'number' | 'date' | 'boolean' | 'object',
    isRequired: Boolean(row.is_required),
    description: row.description || undefined
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
    /**
     * Initialize the mapping tables in the database
     */
    async initializeTables(): Promise<void> {
      // Create system fields table
      await db.sql`
        CREATE TABLE IF NOT EXISTS system_fields (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          data_type TEXT NOT NULL,
          is_required INTEGER NOT NULL,
          description TEXT
        )
      `;
      
      // Create mapping configurations table
      await db.sql`
        CREATE TABLE IF NOT EXISTS mapping_configurations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL
        )
      `;
      
      // Create field mappings table
      await db.sql`
        CREATE TABLE IF NOT EXISTS field_mappings (
          id TEXT PRIMARY KEY,
          user_header_name TEXT NOT NULL,
          system_field_id TEXT NOT NULL,
          transformation_type TEXT,
          transformation_rule TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          mapping_configuration_id TEXT NOT NULL,
          FOREIGN KEY (system_field_id) REFERENCES system_fields (id),
          FOREIGN KEY (mapping_configuration_id) REFERENCES mapping_configurations (id)
        )
      `;
    },
    
    /**
     * Save a system field
     */
    async saveSystemField(field: SystemField): Promise<SystemField> {
      const now = new Date().toISOString();
      
      // Check if field exists
      const existing = await db.sql`
        SELECT * FROM system_fields WHERE id = ${field.id} LIMIT 1
      `;
      
      if (existing.rows && existing.rows.length > 0) {
        // Update existing field
        const result = await db.sql`
          UPDATE system_fields 
          SET 
            name = ${field.name},
            data_type = ${field.dataType},
            is_required = ${field.isRequired ? 1 : 0},
            description = ${field.description || null}
          WHERE id = ${field.id}
          RETURNING *
        `;
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error(`Failed to update system field with ID ${field.id}`);
        }
        
        return transformSystemFieldRow(result.rows[0]);
      } else {
        // Insert new field
        const result = await db.sql`
          INSERT INTO system_fields (
            id, name, data_type, is_required, description
          ) VALUES (
            ${field.id},
            ${field.name},
            ${field.dataType},
            ${field.isRequired ? 1 : 0},
            ${field.description || null}
          )
          RETURNING *
        `;
        
        if (!result.rows || result.rows.length === 0) {
          throw new Error(`Failed to insert system field with ID ${field.id}`);
        }
        
        return transformSystemFieldRow(result.rows[0]);
      }
    },
    
    /**
     * Get all system fields
     */
    async getSystemFields(): Promise<SystemField[]> {
      const result = await db.sql`SELECT * FROM system_fields`;
      return result.rows ? result.rows.map(row => transformSystemFieldRow(row)) : [];
    },
    
    /**
     * Get a system field by ID
     */
    async getSystemFieldById(id: string): Promise<SystemField | null> {
      const result = await db.sql`
        SELECT * FROM system_fields WHERE id = ${id} LIMIT 1
      `;
      
      return (result.rows && result.rows.length > 0) 
        ? transformSystemFieldRow(result.rows[0]) 
        : null;
    },

    /**
 * Save a mapping configuration
 */
async saveMappingConfiguration(config: MappingConfiguration): Promise<MappingConfiguration> {
  const now = new Date().toISOString();
  
  // Start a transaction
  await db.sql`BEGIN`;
  
  try {
    // Check if configuration exists
    const existing = await db.sql`
      SELECT * FROM mapping_configurations WHERE id = ${config.id} LIMIT 1
    `;
    
    if (existing.rows && existing.rows.length > 0) {
      // Update existing configuration
      await db.sql`
        UPDATE mapping_configurations 
        SET 
          name = ${config.name},
          description = ${config.description || null},
          created_by = ${config.createdBy},
          updated_at = ${now},
          version = ${config.version}
        WHERE id = ${config.id}
      `;
    } else {
      // Insert new configuration
      await db.sql`
        INSERT INTO mapping_configurations (
          id, name, description, created_by, created_at, updated_at, version
        ) VALUES (
          ${config.id},
          ${config.name},
          ${config.description || null},
          ${config.createdBy},
          ${config.createdAt.toISOString()},
          ${now},
          ${config.version}
        )
      `;
    }
    
    // Delete existing mappings
    await db.sql`DELETE FROM field_mappings WHERE mapping_configuration_id = ${config.id}`;
    
    // Insert new mappings
    for (const mapping of config.mappings) {
      await db.sql`
        INSERT INTO field_mappings (
          id, user_header_name, system_field_id, transformation_type, 
          transformation_rule, created_at, updated_at, mapping_configuration_id
        ) VALUES (
          ${mapping.id},
          ${mapping.userHeaderName},
          ${mapping.systemFieldId},
          ${mapping.transformationType || null},
          ${mapping.transformationRule || null},
          ${mapping.createdAt.toISOString()},
          ${mapping.updatedAt.toISOString()},
          ${config.id}
        )
      `;
    }
    
    // Commit transaction
    await db.sql`COMMIT`;
    
    // Return the updated configuration with explicit null check
    const result = await this.getMappingConfiguration(config.id);
    if (!result) {
      throw new Error(`Failed to retrieve saved mapping configuration with ID ${config.id}`);
    }
    
    return result;
    
  } catch (error) {
    // Rollback on error
    await db.sql`ROLLBACK`;
    throw error;
  }
},

/**
 * Get a mapping configuration by ID
 */
async getMappingConfiguration(id: string): Promise<MappingConfiguration | null> {
  // Get the configuration
  const configResult = await db.sql`
    SELECT * FROM mapping_configurations WHERE id = ${id} LIMIT 1
  `;
  
  if (!configResult.rows || configResult.rows.length === 0) {
    return null;
  }
  
  const configRow = configResult.rows[0];
  
  // Get all mappings for this configuration
  const mappingsResult = await db.sql`
    SELECT * FROM field_mappings WHERE mapping_configuration_id = ${id}
  `;
  
  const mappings = mappingsResult.rows 
    ? mappingsResult.rows.map(row => transformFieldMappingRow(row)) 
    : [];
  
  // Construct and return the full configuration with type safety
  return {
    id: String(configRow.id),
    name: String(configRow.name),
    description: configRow.description ? String(configRow.description) : undefined,
    createdBy: String(configRow.created_by),
    createdAt: new Date(String(configRow.created_at)),
    updatedAt: new Date(String(configRow.updated_at)),
    version: Number(configRow.version),
    mappings
  };
},

/**
 * Get all mapping configurations
 */
async getAllMappingConfigurations(): Promise<MappingConfiguration[]> {
  const result = await db.sql`SELECT * FROM mapping_configurations`;
  
  if (!result.rows) {
    return [];
  }
  
  const configurations: MappingConfiguration[] = [];
  
  for (const row of result.rows) {
    if (row.id) {
      const config = await this.getMappingConfiguration(String(row.id));
      if (config) {
        configurations.push(config);
      }
    }
  }
  
  return configurations;
},

/**
 * Delete a mapping configuration
 */
async deleteMappingConfiguration(id: string): Promise<boolean> {
  await db.sql`BEGIN`;
  
  try {
    // Delete associated mappings first
    await db.sql`DELETE FROM field_mappings WHERE mapping_configuration_id = ${id}`;
    
    // Delete the configuration
    const result = await db.sql`DELETE FROM mapping_configurations WHERE id = ${id}`;
    
    await db.sql`COMMIT`;
    
    return true;
  } catch (error) {
    await db.sql`ROLLBACK`;
    throw error;
  }
}
  };
};
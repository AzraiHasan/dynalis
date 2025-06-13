// server/repositories/schemaFieldsRepository.ts
import { useDbConnection } from "../utils/db";
import type {
  SystemField,
  CreateSystemFieldDTO,
  UpdateSystemFieldDTO,
  FieldDataType,
  FieldStatus,
  SystemFieldHistory,
  SchemaChangeLog
} from "../types/schema.types";

// Transform database row to SystemField entity
const transformFieldRow = (row: Record<string, any>): SystemField => {
  return {
    id: String(row.id),
    name: String(row.name),
    dataType: row.data_type as FieldDataType,
    isRequired: Boolean(row.is_required),
    description: row.description ? String(row.description) : undefined,
    version: Number(row.version),
    status: row.status as FieldStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    validationRules: row.validation_rules ? String(row.validation_rules) : undefined,
    metadataProperties: row.metadata_properties ? String(row.metadata_properties) : undefined,
  };
};

// Transform history row to SystemFieldHistory
const transformHistoryRow = (row: Record<string, any>): SystemFieldHistory => {
  return {
    id: String(row.id),
    fieldId: String(row.field_id),
    version: Number(row.version),
    changedAt: String(row.changed_at),
    changedBy: row.changed_by ? String(row.changed_by) : undefined,
    fieldData: String(row.field_data),
    changeReason: row.change_reason ? String(row.change_reason) : undefined,
  };
};

// Transform change log row to SchemaChangeLog
const transformChangeLogRow = (row: Record<string, any>): SchemaChangeLog => {
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: row.action as 'create' | 'update' | 'delete',
    performedBy: String(row.performed_by),
    performedAt: String(row.performed_at),
    previousState: row.previous_state ? String(row.previous_state) : undefined,
    newState: row.new_state ? String(row.new_state) : undefined,
    approvalStatus: row.approval_status as 'pending' | 'approved' | 'rejected',
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
  };
};

export const useSchemaFieldsRepository = () => {
  const { db, status } = useDbConnection();

  if (status !== "connected" || !db) {
    throw new Error("Database connection not available");
  }

  return {
    /**
     * Find system field by ID
     */
    async findById(id: string): Promise<SystemField | null> {
      const result = await db.sql`
        SELECT * FROM system_fields 
        WHERE id = ${id} 
        LIMIT 1
      `;
      const rows = result?.rows || [];
      return rows.length > 0 ? transformFieldRow(rows[0]) : null;
    },

    /**
     * Find system field by name
     */
    async findByName(name: string): Promise<SystemField | null> {
      const result = await db.sql`
        SELECT * FROM system_fields 
        WHERE name = ${name} 
        AND status != 'deprecated'
        LIMIT 1
      `;
      const rows = result?.rows || [];
      return rows.length > 0 ? transformFieldRow(rows[0]) : null;
    },

    /**
     * List all active system fields
     */
    async findAll(includeDeprecated = false): Promise<SystemField[]> {
      let query;
      
      if (includeDeprecated) {
        query = db.sql`SELECT * FROM system_fields ORDER BY name ASC`;
      } else {
        query = db.sql`
          SELECT * FROM system_fields 
          WHERE status != 'deprecated' 
          ORDER BY name ASC
        `;
      }
      
      const result = await query;
      const rows = result?.rows || [];
      return rows.map(transformFieldRow);
    },

    /**
     * Create a new system field
     */
    async create(
      fieldData: CreateSystemFieldDTO, 
      userId: string
    ): Promise<SystemField> {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      
      // Convert validation rules and metadata to JSON strings if provided
      const validationRules = fieldData.validationRules 
        ? JSON.stringify(fieldData.validationRules) 
        : null;
        
      const metadataProperties = fieldData.metadataProperties 
        ? JSON.stringify(fieldData.metadataProperties) 
        : null;

      // Initial version is always 1 for new fields
      const version = 1;
      
      // Create the field
      const result = await db.sql`
        INSERT INTO system_fields (
          id, name, data_type, is_required, description, 
          version, status, created_at, updated_at, created_by,
          validation_rules, metadata_properties
        ) VALUES (
          ${id}, ${fieldData.name}, ${fieldData.dataType}, 
          ${fieldData.isRequired ? 1 : 0}, ${fieldData.description || null},
          ${version}, ${'active'}, ${now}, ${now}, ${userId},
          ${validationRules}, ${metadataProperties}
        )
        RETURNING *
      `;

      const rows = result?.rows || [];
      if (rows.length === 0) {
        throw new Error(`Failed to create system field: ${fieldData.name}`);
      }
      
      const newField = transformFieldRow(rows[0]);
      
      // Create field data entry in history table
      const historyId = crypto.randomUUID();
      await db.sql`
        INSERT INTO system_field_history (
          id, field_id, version, changed_at, changed_by, field_data, change_reason
        ) VALUES (
          ${historyId}, ${id}, ${version}, ${now}, ${userId}, 
          ${JSON.stringify(newField)}, ${'Initial creation'}
        )
      `;
      
      // Log the change
      const changeLogId = crypto.randomUUID();
      await db.sql`
        INSERT INTO schema_change_log (
          id, entity_type, entity_id, action, performed_by, 
          performed_at, previous_state, new_state, approval_status
        ) VALUES (
          ${changeLogId}, ${'system_field'}, ${id}, ${'create'}, ${userId},
          ${now}, ${null}, ${JSON.stringify(newField)}, ${'approved'}
        )
      `;

      return newField;
    },

    /**
     * Update a system field
     * Note: This creates a new version and maintains history
     */
    async update(
      id: string, 
      updateData: UpdateSystemFieldDTO, 
      userId: string,
      changeReason?: string
    ): Promise<SystemField> {
      // Get the current field data
      const currentField = await this.findById(id);
      if (!currentField) {
        throw new Error(`System field not found with id: ${id}`);
      }
      
      const now = new Date().toISOString();
      
      // Increment version number
      const newVersion = currentField.version + 1;
      
      // Prepare update data
      const updates: any = {
        version: newVersion,
        updated_at: now
      };
      
      if (updateData.name !== undefined) {
        updates.name = updateData.name;
      }
      
      if (updateData.description !== undefined) {
        updates.description = updateData.description;
      }
      
      if (updateData.isRequired !== undefined) {
        updates.is_required = updateData.isRequired ? 1 : 0;
      }
      
      if (updateData.validationRules !== undefined) {
        updates.validation_rules = JSON.stringify(updateData.validationRules);
      }
      
      if (updateData.metadataProperties !== undefined) {
        updates.metadata_properties = JSON.stringify(updateData.metadataProperties);
      }
      
      if (updateData.status !== undefined) {
        updates.status = updateData.status;
      }
      
      // Update the field
      const result = await db.sql`
        UPDATE system_fields 
        SET 
          name = ${updates.name !== undefined ? updates.name : currentField.name},
          description = ${updates.description !== undefined ? updates.description : currentField.description},
          is_required = ${updates.is_required !== undefined ? updates.is_required : (currentField.isRequired ? 1 : 0)},
          validation_rules = ${updates.validation_rules !== undefined ? updates.validation_rules : currentField.validationRules},
          metadata_properties = ${updates.metadata_properties !== undefined ? updates.metadata_properties : currentField.metadataProperties},
          status = ${updates.status !== undefined ? updates.status : currentField.status},
          version = ${updates.version},
          updated_at = ${updates.updated_at}
        WHERE id = ${id}
        RETURNING *
      `;
      
      const rows = result?.rows || [];
      if (rows.length === 0) {
        throw new Error(`Failed to update system field with id: ${id}`);
      }
      
      const updatedField = transformFieldRow(rows[0]);
      
      // Add entry to history table
      const historyId = crypto.randomUUID();
      await db.sql`
        INSERT INTO system_field_history (
          id, field_id, version, changed_at, changed_by, field_data, change_reason
        ) VALUES (
          ${historyId}, ${id}, ${newVersion}, ${now}, ${userId}, 
          ${JSON.stringify(updatedField)}, ${changeReason || 'Field update'}
        )
      `;
      
      // Log the change
      const changeLogId = crypto.randomUUID();
      await db.sql`
        INSERT INTO schema_change_log (
          id, entity_type, entity_id, action, performed_by, 
          performed_at, previous_state, new_state, approval_status
        ) VALUES (
          ${changeLogId}, ${'system_field'}, ${id}, ${'update'}, ${userId},
          ${now}, ${JSON.stringify(currentField)}, ${JSON.stringify(updatedField)}, ${'approved'}
        )
      `;
      
      return updatedField;
    },
    
    /**
     * Get field version history
     */
    async getFieldHistory(fieldId: string): Promise<SystemFieldHistory[]> {
      const result = await db.sql`
        SELECT * FROM system_field_history
        WHERE field_id = ${fieldId}
        ORDER BY version DESC
      `;
      
      const rows = result?.rows || [];
      return rows.map(transformHistoryRow);
    },
    
    /**
     * Get a specific version of a field
     */
    async getFieldVersion(fieldId: string, version: number): Promise<SystemField | null> {
      const result = await db.sql`
        SELECT * FROM system_field_history
        WHERE field_id = ${fieldId} AND version = ${version}
        LIMIT 1
      `;
      
      const rows = result?.rows || [];
      if (rows.length === 0) {
        return null;
      }
      
      // Parse the stored JSON data
      const historyRecord = transformHistoryRow(rows[0]);
      return JSON.parse(historyRecord.fieldData) as SystemField;
    },
    
    /**
     * Get schema change logs (with optional filtering)
     */
    async getChangeLogs(
      entityType?: string,
      entityId?: string,
      limit = 50,
      offset = 0
    ): Promise<SchemaChangeLog[]> {
      let query;
      
      if (entityType && entityId) {
        query = db.sql`
          SELECT * FROM schema_change_log
          WHERE entity_type = ${entityType} AND entity_id = ${entityId}
          ORDER BY performed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (entityType) {
        query = db.sql`
          SELECT * FROM schema_change_log
          WHERE entity_type = ${entityType}
          ORDER BY performed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        query = db.sql`
          SELECT * FROM schema_change_log
          ORDER BY performed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      
      const result = await query;
      const rows = result?.rows || [];
      return rows.map(transformChangeLogRow);
    }
  };
};

// server/types/schema.types.ts

// Supported data types for dynamic schema fields
export enum FieldDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  OBJECT = 'object',
  ARRAY = 'array'
}

// Status options for schema fields
export enum FieldStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DRAFT = 'draft'
}

// Base field definition interface
export interface SystemField {
  id: string;
  name: string;
  dataType: FieldDataType;
  isRequired: boolean;
  description?: string;
  version: number;
  status: FieldStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  validationRules?: string; // JSON string with validation rules
  metadataProperties?: string; // JSON string with additional metadata
}

// DTO for creating a new system field
export interface CreateSystemFieldDTO {
  name: string;
  dataType: FieldDataType;
  isRequired: boolean;
  description?: string;
  validationRules?: Record<string, any>;
  metadataProperties?: Record<string, any>;
}

// DTO for updating an existing system field
export interface UpdateSystemFieldDTO {
  name?: string;
  description?: string;
  isRequired?: boolean;
  validationRules?: Record<string, any>;
  metadataProperties?: Record<string, any>;
  status?: FieldStatus;
}

// Field history record
export interface SystemFieldHistory {
  id: string;
  fieldId: string;
  version: number;
  changedAt: string;
  changedBy?: string;
  fieldData: string; // JSON string of the field at this version
  changeReason?: string;
}

// Schema change log entry
export interface SchemaChangeLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  performedBy: string;
  performedAt: string;
  previousState?: string; // JSON string of previous state
  newState?: string; // JSON string of new state
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

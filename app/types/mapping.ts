// app/types/mapping.ts

/**
 * Represents a system field with versioning and metadata
 */
export interface SystemField {
  id: string;
  name: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';
  isRequired: boolean;
  description?: string;
  // New fields for schema evolution
  version: number;
  status: 'active' | 'deprecated' | 'draft';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  validationRules?: ValidationRule[];
  metadataProperties?: Record<string, any>;
}

export interface ValidationRule {
  type: 'range' | 'regex' | 'enum' | 'length' | 'custom';
  params: Record<string, any>;
  errorMessage?: string;
}

/**
 * Represents a mapping between a user-defined header and a system field
 */
export interface FieldMapping {
  id: string;
  userHeaderName: string;
  systemFieldId: string;
  transformationType?: 'direct' | 'formatted' | 'calculated';
  transformationRule?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a complete mapping configuration for a dataset, with versioning and metadata
 */
export interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  mappings: FieldMapping[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  // New fields for schema evolution
  status: 'draft' | 'published' | 'deprecated';
  effectiveFrom?: Date;
  effectiveTo?: Date;
  previousVersionId?: string;
  changeReason?: string;
  isCompatibleWith?: string[]; // IDs of other mapping configurations this is compatible with
  versionHistory?: VersionHistoryEntry[];
}

export interface VersionHistoryEntry {
  version: number;
  versionId: string;
  timestamp: Date;
  changedBy: string;
  changeReason: string;
  changes: SchemaChange[];
}

export interface SchemaChange {
  type: 'added' | 'removed' | 'modified';
  fieldId: string;
  previousValue?: any;
  newValue?: any;
}
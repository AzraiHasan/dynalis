// app/types/mapping.ts

/**
 * Represents a data field in the system's core schema
 */
export interface SystemField {
  id: string;
  name: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object';
  isRequired: boolean;
  description?: string;
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
 * Represents a complete mapping configuration for a dataset
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
}
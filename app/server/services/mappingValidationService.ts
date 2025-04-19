// app/server/services/mappingValidationService.ts
import type { 
  SystemField, 
  FieldMapping, 
  MappingConfiguration 
} from '~/types/mapping';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export const useMappingValidation = () => {
  return {
    /**
     * Validate a mapping configuration 
     */
    validateConfiguration(
      config: MappingConfiguration, 
      systemFields: SystemField[]
    ): ValidationResult {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      // Check configuration structure
      if (!config.id) {
        result.errors.push({
          code: 'CONFIG_MISSING_ID',
          message: 'Configuration is missing ID'
        });
      }
      
      if (!config.name) {
        result.errors.push({
          code: 'CONFIG_MISSING_NAME',
          message: 'Configuration is missing name'
        });
      }
      
      if (!Array.isArray(config.mappings) || config.mappings.length === 0) {
        result.errors.push({
          code: 'CONFIG_NO_MAPPINGS',
          message: 'Configuration has no mappings'
        });
      }
      
      // Check each mapping
      const systemFieldIds = systemFields.map(f => f.id);
      
      config.mappings.forEach((mapping, index) => {
        // Check for required fields
        if (!mapping.id) {
          result.errors.push({
            code: 'MAPPING_MISSING_ID',
            message: `Mapping #${index + 1} is missing ID`,
            field: `mappings[${index}].id`
          });
        }
        
        if (!mapping.userHeaderName) {
          result.errors.push({
            code: 'MAPPING_MISSING_HEADER',
            message: `Mapping #${index + 1} is missing user header name`,
            field: `mappings[${index}].userHeaderName`
          });
        }
        
        if (!mapping.systemFieldId) {
          result.errors.push({
            code: 'MAPPING_MISSING_FIELD_ID',
            message: `Mapping #${index + 1} is missing system field ID`,
            field: `mappings[${index}].systemFieldId`
          });
        } else if (!systemFieldIds.includes(mapping.systemFieldId)) {
          result.errors.push({
            code: 'MAPPING_INVALID_FIELD_ID',
            message: `Mapping #${index + 1} references unknown system field ID: ${mapping.systemFieldId}`,
            field: `mappings[${index}].systemFieldId`
          });
        }
        
        // Validate transformation rules
        if (mapping.transformationType && mapping.transformationType !== 'direct') {
          if (!mapping.transformationRule) {
            result.warnings.push({
              code: 'MAPPING_MISSING_RULE',
              message: `Mapping #${index + 1} has transformation type '${mapping.transformationType}' but no rule specified`,
              field: `mappings[${index}].transformationRule`
            });
          } else {
            // Validate specific transformation types
            this.validateTransformationRule(
              mapping.transformationType, 
              mapping.transformationRule,
              result,
              index
            );
          }
        }
      });
      
      // Check for duplicate user headers
      const headerCounts = new Map<string, number>();
      config.mappings.forEach(mapping => {
        const header = mapping.userHeaderName;
        headerCounts.set(header, (headerCounts.get(header) || 0) + 1);
      });
      
      headerCounts.forEach((count, header) => {
        if (count > 1) {
          result.warnings.push({
            code: 'DUPLICATE_USER_HEADER',
            message: `Duplicate user header name '${header}' found ${count} times`,
            field: 'mappings',
            details: { header, count }
          });
        }
      });
      
      // Set overall validity
      result.isValid = result.errors.length === 0;
      
      return result;
    },
    
    /**
     * Validate a transformation rule
     */
    validateTransformationRule(
      type: string, 
      rule: string, 
      result: ValidationResult,
      mappingIndex: number
    ): void {
      if (type === 'formatted') {
        // Check if formatting rule is recognized
        const validFormats = ['date_iso', 'number_fixed2', 'uppercase', 'lowercase'];
        if (!validFormats.includes(rule)) {
          result.warnings.push({
            code: 'UNKNOWN_FORMAT_RULE',
            message: `Unknown formatting rule '${rule}' for mapping #${mappingIndex + 1}`,
            field: `mappings[${mappingIndex}].transformationRule`
          });
        }
      } else if (type === 'calculated') {
        // Validate expression syntax
        try {
          // Check for potentially unsafe expressions
          if (!/^[0-9x+\-*/().]*$/.test(rule)) {
            result.errors.push({
              code: 'UNSAFE_EXPRESSION',
              message: `Expression contains unsafe characters: '${rule}'`,
              field: `mappings[${mappingIndex}].transformationRule`
            });
          }
          
          // Test with dummy value
          Function(`return ${rule.replace(/x/g, '1')}`)();
        } catch (error) {
          result.errors.push({
            code: 'INVALID_EXPRESSION',
            message: `Invalid calculation expression: '${rule}'`,
            field: `mappings[${mappingIndex}].transformationRule`,
            details: { error: String(error) }
          });
        }
      }
    },
    
    /**
     * Validate data against a mapping configuration
     */
    validateDataAgainstMapping(
  data: Record<string, any>[],
  config: MappingConfiguration,
  systemFields: SystemField[]
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!data || data.length === 0) {
    result.warnings.push({
      code: 'EMPTY_DATA',
      message: 'No data to validate'
    });
    return result;
  }
  
  // Get available headers in data - fix the TypeScript error with null check
  const sampleRow = data[0] || {};
  const availableHeaders = Object.keys(sampleRow);
  
  // Rest of the method remains the same...
  // Check for missing headers
  config.mappings.forEach((mapping, index) => {
    if (!availableHeaders.includes(mapping.userHeaderName)) {
      result.errors.push({
        code: 'MISSING_HEADER',
        message: `Required header '${mapping.userHeaderName}' not found in data`,
        field: `mappings[${index}].userHeaderName`
      });
    }
  });
  
  // Check data types for each row
  data.forEach((row, rowIndex) => {
    config.mappings.forEach((mapping) => {
      const value = row[mapping.userHeaderName];
      if (value === undefined || value === null) {
        return; // Skip validation for null/undefined values
      }
      
      // Find system field for this mapping
      const systemField = systemFields.find(f => f.id === mapping.systemFieldId);
      if (!systemField) return;
      
      // Check data type
      const isValid = this.validateDataType(value, systemField.dataType);
      if (!isValid) {
        result.warnings.push({
          code: 'TYPE_MISMATCH',
          message: `Value '${value}' in row ${rowIndex + 1}, column '${mapping.userHeaderName}' doesn't match expected type '${systemField.dataType}'`,
          field: mapping.userHeaderName,
          details: { rowIndex, value, expectedType: systemField.dataType }
        });
      }
      
      // Check required fields
      if (systemField.isRequired && (value === null || value === undefined || value === '')) {
        result.errors.push({
          code: 'REQUIRED_FIELD_EMPTY',
          message: `Required field '${mapping.userHeaderName}' is empty in row ${rowIndex + 1}`,
          field: mapping.userHeaderName,
          details: { rowIndex }
        });
      }
    });
  });
  
  // Set overall validity
  result.isValid = result.errors.length === 0;
  
  return result;
},
    
    /**
     * Validate value against expected data type
     */
    validateDataType(value: any, dataType: string): boolean {
      if (value === null || value === undefined) return true;
      
      switch (dataType) {
        case 'string':
          return typeof value === 'string' || typeof value === 'number';
        
        case 'number':
          // Handle string numbers
          if (typeof value === 'string') {
            return !isNaN(Number(value.replace(/,/g, '')));
          }
          return typeof value === 'number' && !isNaN(value);
        
        case 'date':
          if (typeof value === 'string') {
            const date = new Date(value);
            return !isNaN(date.getTime());
          }
          return value instanceof Date && !isNaN(value.getTime());
        
        case 'boolean':
          if (typeof value === 'string') {
            const val = value.toLowerCase();
            return val === 'true' || val === 'false' || val === '1' || val === '0' || val === 'yes' || val === 'no';
          }
          return typeof value === 'boolean' || value === 1 || value === 0;
        
        case 'object':
          return typeof value === 'object';
        
        default:
          return true;
      }
    }
  };
};
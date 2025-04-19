// app/server/services/mappingService.ts
import { useMappingRepository } from '~~/server/repositories/mappingRepository';
import type { 
  SystemField, 
  FieldMapping, 
  MappingConfiguration 
} from '~/types/mapping';

export const useMappingService = () => {
  const mappingRepo = useMappingRepository();
  
  return {
    /**
     * Initialize the mapping tables in the database
     */
    async initializeMappingFramework(): Promise<void> {
      await mappingRepo.initializeTables();
    },
    
    /**
     * Create a new mapping configuration from file headers
     */
    async createMappingFromHeaders(
      headers: string[],
      configName: string,
      userId: string
    ): Promise<MappingConfiguration> {
      const timestamp = new Date();
      const configId = crypto.randomUUID();
      
      // Get system fields for matching
      const systemFields = await mappingRepo.getSystemFields();
      
      // Generate mappings based on header similarity
      const mappings: FieldMapping[] = headers.map(header => {
        const matchedField = this.findBestMatchingField(header, systemFields);
        
        return {
          id: crypto.randomUUID(),
          userHeaderName: header,
          systemFieldId: matchedField?.id || 'unknown',
          transformationType: 'direct',
          createdAt: timestamp,
          updatedAt: timestamp
        };
      });
      
      // Create configuration
      const configuration: MappingConfiguration = {
        id: configId,
        name: configName,
        mappings,
        createdBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1
      };
      
      return await mappingRepo.saveMappingConfiguration(configuration);
    },
    
    /**
     * Apply mapping configuration to transform input data
     */
    async transformData(
      inputData: Record<string, any>[],
      mappingConfigId: string
    ): Promise<Record<string, any>[]> {
      // Get the mapping configuration
      const config = await mappingRepo.getMappingConfiguration(mappingConfigId);
      if (!config) {
        throw new Error(`Mapping configuration with ID ${mappingConfigId} not found`);
      }
      
      // Get all system fields for reference
      const systemFields = await mappingRepo.getSystemFields();
      
      // Transform each row according to the mapping
      return inputData.map(row => {
        const transformedRow: Record<string, any> = {};
        
        for (const mapping of config.mappings) {
          const sourceValue = row[mapping.userHeaderName];
          
          // Apply transformation if specified
          const transformedValue = this.applyTransformation(
            sourceValue,
            mapping.transformationType,
            mapping.transformationRule
          );
          
          // Get system field info
          const systemField = systemFields.find(
            (field: SystemField) => field.id === mapping.systemFieldId
          );
          
          // Use system field name if available, otherwise use ID
          const targetField = systemField?.name || mapping.systemFieldId;
          
          transformedRow[targetField] = transformedValue;
        }
        
        return transformedRow;
      });
    },
    
    /**
     * Find the best matching system field for a user header
     */
    findBestMatchingField(header: string, systemFields: SystemField[]): SystemField | null {
      if (!systemFields.length) return null;
      
      // Normalize header for comparison
      const normalizedHeader = header.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
      
      // Simple matching algorithm - find field with most similar name
      let bestMatch: SystemField | null = null;
      let bestScore = 0;
      
      for (const field of systemFields) {
        const fieldName = field.name.toLowerCase().trim()
          .replace(/\s+/g, '_')
          .replace(/[^\w]/g, '');
        
        // Calculate similarity score (simple contains check for now)
        let score = 0;
        
        if (normalizedHeader === fieldName) {
          score = 100; // Exact match
        } else if (normalizedHeader.includes(fieldName) || fieldName.includes(normalizedHeader)) {
          score = 50; // Partial match
        } else {
          // Check for common words
          const headerWords = normalizedHeader.split('_');
          const fieldWords = fieldName.split('_');
          
          for (const word of headerWords) {
            if (word.length > 2 && fieldWords.includes(word)) {
              score += 10;
            }
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = field;
        }
      }
      
      // Return the best match if score is above threshold
      return bestScore >= 10 ? bestMatch : null;
    },
    
    /**
     * Apply transformation to a value based on transformation type and rule
     */
    applyTransformation(
      value: any,
      transformationType?: string, 
      transformationRule?: string
    ): any {
      if (!transformationType || transformationType === 'direct') {
        return value;
      }
      
      if (transformationType === 'formatted' && transformationRule) {
        // Apply formatting based on rule
        // Example: date formatting, currency formatting, etc.
        return this.applyFormattingRule(value, transformationRule);
      }
      
      if (transformationType === 'calculated' && transformationRule) {
        // Apply calculation based on rule
        // Example: simple expressions, conversions, etc.
        return this.evaluateExpression(value, transformationRule);
      }
      
      return value;
    },
    
    /**
     * Apply formatting rule to a value
     */
    applyFormattingRule(value: any, rule: string): any {
      // Handle different formatting rules
      if (rule === 'date_iso') {
        return this.formatDateISO(value);
      }
      
      if (rule === 'number_fixed2') {
        return this.formatNumberFixed(value, 2);
      }
      
      // Add more formatting rules as needed
      
      return value;
    },
    
    /**
     * Evaluate expression for calculated transformations
     */
    evaluateExpression(value: any, expression: string): any {
      // Simple expression evaluator
      // Expression can use 'x' as the value placeholder
      
      try {
        // For security, limit to simple arithmetic operations
        const sanitizedExpression = expression
          .replace(/[^0-9x+\-*/().]/g, '')
          .replace(/x/g, String(value || 0));
        
        // Use Function constructor with sanitized expression
        return Function(`return ${sanitizedExpression}`)();
      } catch (error) {
        console.error('Expression evaluation error:', error);
        return value;
      }
    },
    
    /**
     * Format value as ISO date
     */
    formatDateISO(value: any): string | null {
      if (!value) return null;
      
      try {
        const date = new Date(value);
        return date.toISOString();
      } catch (error) {
        return String(value);
      }
    },
    
    /**
     * Format number with fixed decimal places
     */
    formatNumberFixed(value: any, places: number): string | null {
      if (value === null || value === undefined) return null;
      
      try {
        const num = parseFloat(String(value));
        return num.toFixed(places);
      } catch (error) {
        return String(value);
      }
    }
  };
};
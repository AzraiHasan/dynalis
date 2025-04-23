// server/api/mapping/suggest.post.ts
import { useMappingService } from '~/server/services/mappingService';
import { useMappingRepository } from '~~/server/repositories/mappingRepository';
import type { SystemField } from '~/types/mapping';

interface SuggestionResponse {
  header: string;
  systemFieldId: string;
  systemFieldName: string;
  confidence: number; // 0-100 score
  dataType: string;
}

export default defineEventHandler(async (event) => {
  try {
    // Require authentication for this endpoint
    await requireUserSession(event);
    
    // Parse the request body
    const body = await readBody(event);
    const { headers } = body;
    
    if (!Array.isArray(headers)) {
      throw createError({
        statusCode: 400,
        message: 'Headers array is required'
      });
    }
    
    // Get dependencies
    const mappingService = useMappingService();
    const mappingRepo = useMappingRepository();
    
    // Get all system fields
    const systemFields = await mappingRepo.getSystemFields();
    
    // Generate suggestions for each header
    const suggestions: Record<string, SuggestionResponse> = {};
    
    for (const header of headers) {
      const match = mappingService.findBestMatchingField(header, systemFields);
      
      if (match) {
        // Calculate confidence score
        const normalizedHeader = header.toLowerCase().trim()
          .replace(/\s+/g, '_')
          .replace(/[^\w]/g, '');
        
        const fieldName = match.name.toLowerCase().trim()
          .replace(/\s+/g, '_')
          .replace(/[^\w]/g, '');
        
        let confidence = 0;
        if (normalizedHeader === fieldName) {
          confidence = 100; // Exact match
        } else if (normalizedHeader.includes(fieldName) || fieldName.includes(normalizedHeader)) {
          confidence = 50; // Partial match
        } else {
          // Check for common words
          const headerWords = normalizedHeader.split('_');
          const fieldWords = fieldName.split('_');
          
          for (const word of headerWords) {
            if (word.length > 2 && fieldWords.includes(word)) {
              confidence += 10;
            }
          }
        }
        
        // Add to suggestions if confidence is above threshold
        if (confidence >= 10) {
          suggestions[header] = {
            header,
            systemFieldId: match.id,
            systemFieldName: match.name,
            confidence,
            dataType: match.dataType
          };
        }
      }
    }
    
    return { suggestions };
  } catch (error) {
    console.error('Mapping suggestion error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
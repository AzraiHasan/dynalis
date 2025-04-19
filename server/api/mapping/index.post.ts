// server/api/mapping/index.post.ts
import { useMappingService } from '~/server/services/mappingService';
import { useMappingValidation } from '~/server/services/mappingValidationService';

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event);
    
    // Parse request body
    const body = await readBody(event);
    const { action, data } = body;
    
    // Validate request
    if (!action) {
      throw createError({
        statusCode: 400,
        message: 'Action is required'
      });
    }
    
    const mappingService = useMappingService();
    const mappingValidation = useMappingValidation();
    
    // Handle different actions
    switch (action) {
      case 'initialize':
        await mappingService.initializeMappingFramework();
        return { success: true, message: 'Mapping framework initialized' };
        
      case 'createFromHeaders':
        // Validate request data
        if (!data?.headers || !data?.configName || !data?.userId) {
          throw createError({
            statusCode: 400,
            message: 'Headers, configName and userId are required'
          });
        }
        
        const newConfig = await mappingService.createMappingFromHeaders(
          data.headers,
          data.configName,
          data.userId
        );
        
        return { success: true, config: newConfig };
        
      case 'transform':
        // Validate request data
        if (!data?.inputData || !data?.mappingConfigId) {
          throw createError({
            statusCode: 400,
            message: 'InputData and mappingConfigId are required'
          });
        }
        
        const transformedData = await mappingService.transformData(
          data.inputData,
          data.mappingConfigId
        );
        
        return { success: true, data: transformedData };
        
      default:
        throw createError({
          statusCode: 400,
          message: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    console.error('Mapping API error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
// server/api/mapping/system-fields.ts
import { useMappingRepository } from '~~/server/repositories/mappingRepository';
import type { SystemField } from '~/types/mapping';

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event);
    
    // Get HTTP method
    const method = event.method;
    const mappingRepo = useMappingRepository();
    
    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        // Get all system fields or a specific one
        const id = getQuery(event).id as string | undefined;
        
        if (id) {
          const field = await mappingRepo.getSystemFieldById(id);
          if (!field) {
            throw createError({
              statusCode: 404,
              message: `System field with ID ${id} not found`
            });
          }
          return { field };
        } else {
          const fields = await mappingRepo.getSystemFields();
          return { fields };
        }
        
      case 'POST':
        // Create or update a system field
        const fieldData = await readBody(event) as SystemField;
        
        if (!fieldData.id || !fieldData.name || !fieldData.dataType) {
          throw createError({
            statusCode: 400,
            message: 'id, name and dataType are required'
          });
        }
        
        const field = await mappingRepo.saveSystemField(fieldData);
        return { success: true, field };
        
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('System fields API error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
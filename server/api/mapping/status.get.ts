// server/api/mapping/status.get.ts
import { useMappingRepository } from '~~/server/repositories/mappingRepository';

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event);
    
    const mappingRepo = useMappingRepository();
    const fields = await mappingRepo.getSystemFields();
    
    // Return initialization status
    return {
      initialized: fields.length > 0,
      fieldCount: fields.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Mapping status check error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to check mapping status'
    });
  }
});
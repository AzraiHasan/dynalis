// server/api/mapping/configurations.get.ts
import { useMappingRepository } from '~~/server/repositories/mappingRepository';

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event);
    
    const mappingRepo = useMappingRepository();
    const configurations = await mappingRepo.getAllMappingConfigurations();
    
    return { configurations };
  } catch (error) {
    console.error('Error fetching mapping configurations:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch mapping configurations'
    });
  }
});
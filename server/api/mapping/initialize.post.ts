// server/api/mapping/initialize.post.ts
import { useMappingService } from '~/server/services/mappingService';
import { useMappingRepository } from '~~/server/repositories/mappingRepository';
import type { SystemField } from '~/types/mapping';

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event);
    
    // Initialize mapping tables
    const mappingService = useMappingService();
    await mappingService.initializeMappingFramework();
    
    // Seed default system fields
    const mappingRepo = useMappingRepository();
    
    // Create default system fields with proper types
    const defaultFields: SystemField[] = [
      {
        id: 'site_id',
        name: 'Site ID',
        dataType: 'string',
        isRequired: true,
        description: 'Unique identifier for the site'
      },
      {
        id: 'exp_date',
        name: 'Expiration Date',
        dataType: 'date',
        isRequired: false,
        description: 'Date when the contract expires'
      },
      {
        id: 'total_rental',
        name: 'Total Rental',
        dataType: 'number',
        isRequired: true,
        description: 'Total rental amount'
      },
      {
        id: 'total_payment_to_pay',
        name: 'Payment Due',
        dataType: 'number',
        isRequired: true,
        description: 'Total payment amount due'
      },
      {
        id: 'deposit',
        name: 'Deposit',
        dataType: 'number',
        isRequired: false,
        description: 'Security deposit amount'
      }
    ];
    
    for (const field of defaultFields) {
      await mappingRepo.saveSystemField(field);
    }
    
    return { 
      success: true, 
      message: 'Mapping framework initialized with default fields'
    };
  } catch (error) {
    console.error('Initialization error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
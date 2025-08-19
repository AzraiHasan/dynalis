// server/api/schema/fields/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { useSchemaFieldsRepository } from '../../../repositories/schemaFieldsRepository'
import type { CreateSystemFieldDTO} from '../../../types/schema.types';
import { FieldDataType } from '../../../types/schema.types'
import { z } from 'zod'

// Validation schema for field creation
const createFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  dataType: z.enum([
    FieldDataType.STRING, 
    FieldDataType.NUMBER, 
    FieldDataType.BOOLEAN, 
    FieldDataType.DATE, 
    FieldDataType.OBJECT, 
    FieldDataType.ARRAY
  ]),
  isRequired: z.boolean(),
  description: z.string().optional(),
  validationRules: z.record(z.any()).optional(),
  metadataProperties: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  try {
    // Extract user ID from session (placeholder for actual auth implementation)
    // In a real implementation, get the user ID from authenticated session
    const userId = 'system-user' // This is a placeholder
    
    // Read and validate request body
    const body = await readBody(event)
    
    try {
      createFieldSchema.parse(body)
    } catch (validationError: any) {
      return {
        success: false,
        error: 'Validation error',
        details: validationError.format ? validationError.format() : validationError.message
      }
    }
    
    const fieldData: CreateSystemFieldDTO = {
      name: body.name,
      dataType: body.dataType,
      isRequired: body.isRequired,
      description: body.description,
      validationRules: body.validationRules,
      metadataProperties: body.metadataProperties
    }
    
    // Check if a field with the same name already exists
    const repository = useSchemaFieldsRepository()
    const existingField = await repository.findByName(fieldData.name)
    
    if (existingField) {
      return {
        success: false,
        error: `A field with name '${fieldData.name}' already exists`
      }
    }
    
    // Create the field
    const newField = await repository.create(fieldData, userId)
    
    return {
      success: true,
      field: newField
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create schema field'
    }
  }
})

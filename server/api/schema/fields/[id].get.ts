// server/api/schema/fields/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { useSchemaFieldsRepository } from '../../../repositories/schemaFieldsRepository'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      return {
        success: false,
        error: 'Field ID is required'
      }
    }
    
    const repository = useSchemaFieldsRepository()
    const field = await repository.findById(id)
    
    if (!field) {
      return {
        success: false,
        error: `Field with ID ${id} not found`
      }
    }
    
    return {
      success: true,
      field
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to retrieve schema field'
    }
  }
})

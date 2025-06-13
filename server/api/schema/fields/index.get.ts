// server/api/schema/fields/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { useSchemaFieldsRepository } from '../../../repositories/schemaFieldsRepository'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const includeDeprecated = query.includeDeprecated === 'true'
    
    const repository = useSchemaFieldsRepository()
    const fields = await repository.findAll(includeDeprecated)
    
    return {
      success: true,
      fields
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to retrieve schema fields'
    }
  }
})

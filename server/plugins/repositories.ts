// server/plugins/repositories.ts
import { defineNitroPlugin } from 'nitropack/runtime'
import { useSchemaFieldsRepository } from '../repositories/schemaFieldsRepository'

export default defineNitroPlugin((nitroApp) => {
  // Register repositories for global access
  nitroApp.hooks.hook('request', (event) => {
    // Make repositories available globally
    globalThis.useSchemaFieldsRepository = useSchemaFieldsRepository
  })
})

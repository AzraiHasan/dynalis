// server/api/db-status.get.ts
import { useDbConnection, initializeDatabase } from '../utils/db'

export default defineEventHandler(async (event) => {
  // Test connection
  const { status, error } = useDbConnection()
  
  // If connected, ensure schema exists
  let schemaInitialized = false
  if (status === 'connected') {
    schemaInitialized = await initializeDatabase()
  }
  
  return {
    status,
    schemaInitialized,
    timestamp: new Date().toISOString(),
    error: error ? String(error) : undefined
  }
})
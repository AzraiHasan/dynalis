import { createHash } from 'crypto'
import type { ColumnSchema } from '~/types/schema.types'

export interface SchemaVersion {
  version: number
  schema_definition: ColumnSchema[]
  hash: string
}

export const generateSchemaHash = (schema: ColumnSchema[]): string => {
  const schemaString = schema
    .map(col => `${col.name}:${col.type}`)
    .sort()
    .join('|')
  
  return createHash('md5')
    .update(schemaString)
    .digest('hex')
}

export const compareSchemas = (
  current: ColumnSchema[],
  previous: ColumnSchema[]
): {
  added: string[]
  removed: string[]
  typeChanged: Array<{ column: string; from: string; to: string }>
} => {
  const currentCols = new Map(current.map(col => [col.name, col.type]))
  const previousCols = new Map(previous.map(col => [col.name, col.type]))
  
  const added = current
    .filter(col => !previousCols.has(col.name))
    .map(col => col.name)
    
  const removed = previous
    .filter(col => !currentCols.has(col.name))
    .map(col => col.name)
    
  const typeChanged = current
    .filter(col => {
      const prevType = previousCols.get(col.name)
      return prevType && prevType !== col.type
    })
    .map(col => ({
      column: col.name,
      from: previousCols.get(col.name)!,
      to: col.type
    }))
    
  return { added, removed, typeChanged }
}

export const isSchemaMigrationNeeded = (
  changes: ReturnType<typeof compareSchemas>
): boolean => {
  return (
    changes.removed.length > 0 ||
    changes.typeChanged.length > 0
  )
}
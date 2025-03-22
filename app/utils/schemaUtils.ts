import type { ColumnSchema } from '../types/schema.types'

export const generateTableSQL = (tableName: string, schema: ColumnSchema[]) => {
  const columnDefinitions = schema.map(col => {
    const sqlType = getSQLType(col.type)
    return `${sanitizeColumnName(col.name)} ${sqlType}`
  })

  // Add mandatory metadata columns
  const metadataColumns = [
    'id uuid default gen_random_uuid() primary key',
    'upload_batch_id uuid not null',
    'uploaded_at timestamp with time zone default now()',
    'last_updated timestamp with time zone default now()',
    'file_name text not null',
    'raw_data jsonb not null',
    'column_headers text[] not null'
  ]

  return `
    create table if not exists ${sanitizeTableName(tableName)} (
      ${[...columnDefinitions, ...metadataColumns].join(',\n      ')}
    );
    
    -- Add index on upload_batch_id
    create index if not exists idx_${tableName}_batch_id 
    on ${tableName}(upload_batch_id);
  `
}

const getSQLType = (columnType: ColumnSchema['type']): string => {
  switch (columnType) {
    case 'date':
      return 'timestamp with time zone'
    case 'currency':
    case 'number':
      return 'numeric(15,2)'
    case 'text':
    default:
      return 'text'
  }
}

const sanitizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
}

const sanitizeTableName = (name: string): string => {
  return `data_${sanitizeColumnName(name)}`
}

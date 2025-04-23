export const initializeDatabase = async () => {
  const { db, status } = useDbConnection()
  if (status !== 'connected' || db === null) {
    console.error('Cannot initialize database: connection failed')
    return false
  }
  
  try {
    // Create sites table (existing code)
    await db.sql`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL UNIQUE,
        exp_date TEXT,
        total_rental REAL NOT NULL DEFAULT 0,
        total_payment_to_pay REAL NOT NULL DEFAULT 0,
        deposit REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
    
    // Add users table
    await db.sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
    
    // Add system_fields table with versioning support
    await db.sql`
      CREATE TABLE IF NOT EXISTS system_fields (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        is_required INTEGER NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        validation_rules TEXT,
        metadata_properties TEXT
      )
    `
    
    // Add system_field_history table
    await db.sql`
      CREATE TABLE IF NOT EXISTS system_field_history (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        field_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        changed_at TEXT NOT NULL,
        changed_by TEXT,
        field_data TEXT NOT NULL,
        change_reason TEXT,
        FOREIGN KEY (field_id) REFERENCES system_fields (id)
      )
    `
    
    // Add schema_change_log table for governance
    await db.sql`
      CREATE TABLE IF NOT EXISTS schema_change_log (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        previous_state TEXT,
        new_state TEXT,
        approval_status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT
      )
    `

    // Add mapping_configurations table
await db.sql`
  CREATE TABLE IF NOT EXISTS mapping_configurations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    effective_from TEXT,
    effective_to TEXT,
    previous_version_id TEXT,
    change_reason TEXT
  )
`

// Add field_mappings table
await db.sql`
  CREATE TABLE IF NOT EXISTS field_mappings (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    user_header_name TEXT NOT NULL,
    system_field_id TEXT NOT NULL,
    transformation_type TEXT,
    transformation_rule TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (config_id) REFERENCES mapping_configurations (id),
    FOREIGN KEY (system_field_id) REFERENCES system_fields (id)
  )
`
    
    console.info('Database schema initialized successfully')
    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    return false
  }
}
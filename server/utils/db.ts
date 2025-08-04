// server/utils/db.ts

export const useDbConnection = () => {
  try {
    const db = useDatabase()
    return { db, status: 'connected' }
  } catch (error) {
    console.error('Database connection error:', error)
    return { db: null, status: 'error', error }
  }
}

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
    
    console.info('Database schema initialized successfully')
    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    return false
  }
}

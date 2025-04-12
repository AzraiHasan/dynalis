// server/plugins/database.ts
export default defineNitroPlugin(async () => {
  console.log('Initializing database...')
  await initializeDatabase()
})
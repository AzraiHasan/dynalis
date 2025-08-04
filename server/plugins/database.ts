// server/plugins/database.ts
import { initializeDatabase } from '../utils/db';
import { seedInitialUser } from '../utils/seedUsers';

export default defineNitroPlugin(async () => {
  console.log('Initializing database...');
  const initialized = await initializeDatabase();
  
  if (initialized) {
    console.log('Database initialized, seeding initial user...');
    await seedInitialUser();
  }
});
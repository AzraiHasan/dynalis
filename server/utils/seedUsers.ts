// server/utils/seedUsers.ts
import { useUsersRepository } from '../repositories/usersRepository';
import type { CreateUserDTO } from '~/types/auth.types';

export async function seedInitialUser(): Promise<boolean> {
  try {
    const usersRepo = useUsersRepository();
    
    // Check if any users exist
    const adminEmail = 'admin@example.com';
    const existingUser = await usersRepo.findByEmail(adminEmail);
    
    if (existingUser) {
      console.log('Initial admin user already exists, skipping seed');
      return false;
    }
    
    // Create initial admin user
    const adminUser: CreateUserDTO = {
      email: adminEmail,
      name: 'Admin User',
      password: 'password123' // This should be changed after first login in production
    };
    
    const user = await usersRepo.create(adminUser);
    console.log(`Initial admin user created with ID: ${user.id}`);
    return true;
  } catch (error) {
    console.error('Failed to seed initial admin user:', error);
    return false;
  }
}
// app/types/auth.types.ts

// User entity as stored in the database
export interface User {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

// DTO for user creation (without system fields)
export interface CreateUserDTO {
  email: string;
  name?: string | null;
  password: string; // Plain password, will be hashed before storage
}

// DTO for user updates
export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string;
}

// User data returned to the client (without sensitive fields)
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}
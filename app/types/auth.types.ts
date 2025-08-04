// app/types/auth.types.ts

// Supabase user profile (extends auth.users)
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

// DTO for profile updates
export interface UpdateProfileDTO {
  name?: string;
  email?: string;
}
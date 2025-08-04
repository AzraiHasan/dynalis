// server/repositories/usersRepository.ts
import { createHash } from "crypto";
import { verifyPassword } from "../utils/passwordUtils";
import { useDbConnection } from "../utils/db";
import type {
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserProfile,
} from "~/types/auth.types";

// Password utility functions (inline to reduce file count for now)
const hashPassword = (password: string): string => {
  return createHash("sha256").update(password).digest("hex");
};

// Transform database row to User entity
const transformUserRow = (row: Record<string, any>): User => {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    password_hash: String(row.password_hash),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
};

// Transform User to UserProfile (remove sensitive data)
const userToProfile = (user: User): UserProfile => {
  const { password_hash, ...profile } = user;
  return profile as UserProfile;
};

export const useUsersRepository = () => {
  const { db, status } = useDbConnection();

  if (status !== "connected" || !db) {
    throw new Error("Database connection not available");
  }

  return {
    /**
     * Find user by ID
     */
    async findById(id: string): Promise<User | null> {
      const result = await db.sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      const rows = result?.rows || [];
      return rows.length > 0 ? transformUserRow(rows[0]) : null;
    },

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
      const result =
        await db.sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      const rows = result?.rows || [];
      return rows.length > 0 ? transformUserRow(rows[0]) : null;
    },

    /**
     * Get user profile by ID (without sensitive data)
     */
    async getProfile(id: string): Promise<UserProfile | null> {
      const user = await this.findById(id);
      return user ? userToProfile(user) : null;
    },

    /**
     * Create a new user
     */
    async create(userData: CreateUserDTO): Promise<UserProfile> {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const password_hash = hashPassword(userData.password);

      const result = await db.sql`
        INSERT INTO users (
          id, email, name, password_hash, created_at, updated_at
        ) VALUES (
          ${id}, ${userData.email}, ${
        userData.name || null
      }, ${password_hash}, ${now}, ${now}
        )
        RETURNING *
      `;

      const rows = result?.rows || [];
      if (rows.length === 0) {
        throw new Error(`Failed to create user with email: ${userData.email}`);
      }

      return userToProfile(transformUserRow(rows[0]));
    },

    /**
     * Update user data
     */
    async update(id: string, userData: UpdateUserDTO): Promise<UserProfile> {
      const user = await this.findById(id);
      if (!user) {
        throw new Error(`User not found with id: ${id}`);
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (userData.name !== undefined) {
        updates.name = userData.name;
      }

      if (userData.email !== undefined) {
        updates.email = userData.email;
      }

      if (userData.password !== undefined) {
        updates.password_hash = hashPassword(userData.password);
      }

      // Build dynamic update query
      const fields = Object.keys(updates);
      const values = Object.values(updates);

      // Simple update with fixed fields for now
      const result = await db.sql`
        UPDATE users 
        SET 
          name = ${updates.name !== undefined ? updates.name : user.name},
          email = ${updates.email !== undefined ? updates.email : user.email},
          password_hash = ${
            updates.password_hash !== undefined
              ? updates.password_hash
              : user.password_hash
          },
          updated_at = ${updates.updated_at}
        WHERE id = ${id}
        RETURNING *
      `;

      const rows = result?.rows || [];
      if (rows.length === 0) {
        throw new Error(`Failed to update user with id: ${id}`);
      }

      return userToProfile(transformUserRow(rows[0]));
    },

    /**
     * Verify user credentials and return user if valid
     */
    async verifyCredentials(
      email: string,
      password: string
    ): Promise<UserProfile | null> {
      const user = await this.findByEmail(email);

      if (!user) {
        return null;
      }

      
      if (!verifyPassword(password, user.password_hash)) {
        return null;
      }

      return userToProfile(user);
    },
  };
};

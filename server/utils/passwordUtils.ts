// server/utils/passwordUtils.ts
import { createHash } from 'crypto';

/**
 * Hash a password using SHA-256
 * Note: In a production environment, use a more secure algorithm like bcrypt or Argon2
 * This is a simplified implementation for demonstration
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const passwordHash = hashPassword(password);
  return passwordHash === hash;
}
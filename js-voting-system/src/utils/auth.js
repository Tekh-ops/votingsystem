/**
 * Authentication Utilities
 * Simple password hashing (for demo - use bcrypt in production)
 */
import crypto from 'crypto';

export function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const computed = hashPassword(password, salt);
  return computed.hash === hash;
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}


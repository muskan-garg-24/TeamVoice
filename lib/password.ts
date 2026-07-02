import bcrypt from 'bcrypt'

/**
 * Hashes a plain text password using bcrypt.
 * Throws an error if the password is empty.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || plainPassword.trim() === '') {
    throw new Error('Password cannot be empty')
  }
  const saltRounds = 10
  return bcrypt.hash(plainPassword, saltRounds)
}

/**
 * Verifies a plain text password against a bcrypt hash.
 * Throws an error if the password is empty.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || plainPassword.trim() === '') {
    throw new Error('Password cannot be empty')
  }
  return bcrypt.compare(plainPassword, hash)
}

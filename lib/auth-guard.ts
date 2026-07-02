import { verifyToken } from './jwt'

/**
 * Extracts and verifies the JWT from the request Authorization header.
 * Returns decoded payload containing userId and role, or null if invalid/missing.
 */
export function getAuthenticatedUser(request: Request): { userId: string; role: 'OWNER' | 'EMPLOYEE' } | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  const token = parts[1]
  return verifyToken(token)
}

/**
 * Validates that the request comes from an authenticated user with the OWNER role.
 * Returns user details or an error object with status and message.
 */
export function requireOwner(request: Request):
  | { userId: string; role: 'OWNER' }
  | { error: true; status: number; message: string } {
  const user = getAuthenticatedUser(request)
  if (!user) {
    return { error: true, status: 401, message: 'Unauthorized' }
  }

  if (user.role !== 'OWNER') {
    return { error: true, status: 403, message: 'Forbidden: Owner access only' }
  }

  return user as { userId: string; role: 'OWNER' }
}

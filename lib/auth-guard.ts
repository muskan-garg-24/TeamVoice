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
 * Generic authenticated-user guard.
 */
export function requireAuth(request: Request):
  | { userId: string; role: 'OWNER' | 'EMPLOYEE' }
  | { error: true; status: 401; message: 'Unauthorized' } {
  const user = getAuthenticatedUser(request)
  if (!user) {
    return { error: true, status: 401, message: 'Unauthorized' }
  }
  return user
}

/**
 * Verifies that the user has one of the allowed roles.
 */
export function requireRole(
  request: Request,
  allowedRoles: ('OWNER' | 'EMPLOYEE')[]
):
  | { userId: string; role: 'OWNER' | 'EMPLOYEE' }
  | { error: true; status: 401 | 403; message: string } {
  const user = getAuthenticatedUser(request)
  if (!user) {
    return { error: true, status: 401, message: 'Unauthorized' }
  }
  if (!allowedRoles.includes(user.role)) {
    return { error: true, status: 403, message: 'You do not have permission to perform this action' }
  }
  return user
}

/**
 * Validates that the request comes from an authenticated user with the OWNER role.
 */
export function requireOwner(request: Request):
  | { userId: string; role: 'OWNER' }
  | { error: true; status: 401 | 403; message: string } {
  return requireRole(request, ['OWNER']) as any
}

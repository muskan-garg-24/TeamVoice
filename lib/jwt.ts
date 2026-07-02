import jwt, { JwtPayload } from 'jsonwebtoken'

/**
 * Signs a JWT with the HS256 algorithm.
 * Payload contains only userId and role.
 */
export function signToken(payload: {
  userId: string;
  role: 'OWNER' | 'EMPLOYEE';
}): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing')
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '15m'

  // Ensure payload contains ONLY userId and role
  const cleanPayload = {
    userId: payload.userId,
    role: payload.role,
  }

  return jwt.sign(cleanPayload, secret, {
    algorithm: 'HS256',
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Verifies a JWT.
 * Returns decoded payload containing userId and role, or null if invalid/expired/malformed.
 * Never throws exceptions.
 */
export function verifyToken(token: string): {
  userId: string;
  role: 'OWNER' | 'EMPLOYEE';
} | null {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET environment variable is missing for verification')
    return null
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.role !== 'string'
    ) {
      return null
    }

    if (decoded.role !== 'OWNER' && decoded.role !== 'EMPLOYEE') {
      return null
    }

    return {
      userId: decoded.userId,
      role: decoded.role as 'OWNER' | 'EMPLOYEE',
    }
  } catch {
    return null
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signToken } from '@/lib/jwt'

// Zod validation schema for request payload
const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format'),
  password: z
    .string()
    .min(1, 'Password cannot be empty'),
})

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    // Zod validation
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase()

    // DB Call wrapped inside try/catch (the overall block)
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password hash (never logs the plaintext password or hash)
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 })
    }

    // Sign JWT
    const token = signToken({
      userId: user.id,
      role: user.role,
    })

    // Return successful response without passwordHash
    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    // Log error server-side only. Do not log sensitive parameters.
    console.error('Unexpected login endpoint error:', error)
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
  }
}

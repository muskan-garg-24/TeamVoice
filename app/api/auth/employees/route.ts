import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

// Zod schema enforcing required parameters, non-empty, and rejecting whitespace-only inputs
const employeeSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, { message: 'Name cannot be empty or whitespace only' }),
  email: z
    .string()
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => val.length > 0, { message: 'Email cannot be empty or whitespace only' })
    .pipe(z.string().email('Invalid email format')),
  phone: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  password: z
    .string()
    .refine((val) => val.length > 0, { message: 'Password cannot be empty' }),
})

export async function POST(request: Request) {
  try {
    // 1. Authorization Guard Check
    const authResult = requireOwner(request)
    if ('error' in authResult) {
      return NextResponse.json({ message: authResult.message }, { status: authResult.status })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    // 2. Validate parameters
    const result = employeeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { name, email, phone, password } = result.data

    // 3. Email uniqueness check
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ message: 'Email already in use' }, { status: 409 })
    }

    // 4. Hash password
    const passwordHash = await hashPassword(password)

    // 5. Create employee (role is explicitly hardcoded to EMPLOYEE)
    const newUser = await db.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: 'EMPLOYEE',
      },
    })

    // 6. Return safe fields
    return NextResponse.json(
      {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    // Log errors server-side only
    console.error('Unexpected employee registration error:', error)
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
  }
}

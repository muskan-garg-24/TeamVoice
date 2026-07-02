import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

// Validation schema for profile update
const profileUpdateSchema = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, { message: 'Name cannot be empty' })
    .refine((val) => val.length <= 100, { message: 'Name must be at most 100 characters' })
    .optional(),
  phone: z
    .string()
    .transform((val) => val.trim())
    .optional(),
  password: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, { message: 'Password cannot be empty' })
    .refine((val) => val.length >= 8, { message: 'Password must be at least 8 characters' })
    .optional(),
})

export async function PATCH(request: Request) {
  try {
    // 1. Authenticate user
    const authUser = getAuthenticatedUser(request)
    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
    }

    // 3. Ignore role and email
    const { email, role, ...cleanBody } = body

    // 4. Validate input fields
    const result = profileUpdateSchema.safeParse(cleanBody)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { name, phone, password } = result.data

    // If none of name/phone/password are present in the body after stripping, return 400
    if (name === undefined && phone === undefined && password === undefined) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    // 5. Build update data
    const updateData: { name?: string; phone?: string | null; passwordHash?: string } = {}

    if (name !== undefined) {
      updateData.name = name
    }

    if (phone !== undefined) {
      updateData.phone = phone === '' ? null : phone
    }

    if (password !== undefined) {
      updateData.passwordHash = await hashPassword(password)
    }

    // 6. Update in DB
    const updatedUser = await db.user.update({
      where: { id: authUser.userId },
      data: updateData,
    })

    // 7. Return 200 with safe fields
    return NextResponse.json(
      {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
      },
      { status: 200 }
    )
  } catch (error) {
    // Log error server-side only
    console.error('Error updating user profile:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// Zod validation schema for creating a complaint
const complaintSchema = z.object({
  title: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 200, {
      message: 'Title must be between 1 and 200 characters long',
    }),
  description: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 5000, {
      message: 'Description must be between 1 and 5000 characters long',
    }),
  category: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 100, {
      message: 'Category must be between 1 and 100 characters long',
    }),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .default('MEDIUM'),
  visibility: z
    .enum(['PUBLIC', 'ANONYMOUS', 'PRIVATE'])
    .default('PUBLIC'),
})

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const authResult = requireAuth(request)
    if ('error' in authResult) {
      if (authResult.status === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json(
        { error: 'Forbidden', message: authResult.message },
        { status: 403 }
      )
    }

    // 2. Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    // 3. Validate body
    const result = complaintSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { title, description, category, priority, visibility } = result.data

    // 4. Create complaint in database
    const newComplaint = await db.complaint.create({
      data: {
        title,
        description,
        category,
        priority,
        visibility,
        status: 'OPEN',
        isEdited: false,
        creatorId: authResult.userId,
      },
    })

    // 5. Return 201 with the created complaint fields
    return NextResponse.json(newComplaint, { status: 201 })
  } catch (error) {
    // Log error server-side only
    console.error('Error creating complaint:', error)
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
  }
}

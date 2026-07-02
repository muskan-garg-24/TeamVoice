import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { canViewComplaint, shapeComplaintForResponse } from '@/lib/visibility'

const complaintUpdateSchema = z.object({
  title: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 200, {
      message: 'Title must be between 1 and 200 characters long',
    })
    .optional(),
  description: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 5000, {
      message: 'Description must be between 1 and 5000 characters long',
    })
    .optional(),
  category: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1 && val.length <= 100, {
      message: 'Category must be between 1 and 100 characters long',
    })
    .optional(),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional(),
  visibility: z
    .enum(['PUBLIC', 'ANONYMOUS', 'PRIVATE'])
    .optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 2. Validate params.id
    const resolvedParams = await params
    const idValidation = z.string().uuid().safeParse(resolvedParams.id)
    if (!idValidation.success) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    const complaintId = idValidation.data

    // 3. Fetch complaint where deletedAt is null
    const complaint = await db.complaint.findFirst({
      where: { id: complaintId, deletedAt: null },
    })

    if (!complaint) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    // 4. Authorization check on visibility
    const hasAccess = canViewComplaint(complaint, {
      userId: authResult.userId,
      role: authResult.role,
    })

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
        },
        { status: 403 }
      )
    }

    // 5. Shape and respond
    const shapedComplaint = shapeComplaintForResponse(complaint, {
      userId: authResult.userId,
      role: authResult.role,
    })

    return NextResponse.json(shapedComplaint, { status: 200 })
  } catch (error) {
    console.error('Error fetching complaint:', error)
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 2. Validate params.id
    const resolvedParams = await params
    const idValidation = z.string().uuid().safeParse(resolvedParams.id)
    if (!idValidation.success) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    const complaintId = idValidation.data

    // 3. Fetch complaint where deletedAt is null
    const complaint = await db.complaint.findFirst({
      where: { id: complaintId, deletedAt: null },
    })

    if (!complaint) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    // 4. Authorization check: Owner or Creator
    const isCreator = authResult.userId === complaint.creatorId
    const isOwner = authResult.role === 'OWNER'
    if (!isCreator && !isOwner) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only the creator or Owner can edit this complaint',
        },
        { status: 403 }
      )
    }

    // 5. Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
    }

    // 6. Ignore status, creatorId, isEdited
    const { status, creatorId, isEdited, ...cleanBody } = body

    // 7. Validate cleanBody with Zod
    const result = complaintUpdateSchema.safeParse(cleanBody)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { title, description, category, priority, visibility } = result.data

    if (
      title === undefined &&
      description === undefined &&
      category === undefined &&
      priority === undefined &&
      visibility === undefined
    ) {
      return NextResponse.json(
        { message: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // 8. Apply updates and set isEdited = true
    const updatedComplaint = await db.complaint.update({
      where: { id: complaintId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(priority !== undefined && { priority }),
        ...(visibility !== undefined && { visibility }),
        isEdited: true,
      },
    })

    // 9. Shape response using the requester identity
    const shapedComplaint = shapeComplaintForResponse(updatedComplaint, {
      userId: authResult.userId,
      role: authResult.role,
    })

    return NextResponse.json(shapedComplaint, { status: 200 })
  } catch (error) {
    // Log error server-side only
    console.error('Error updating complaint:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 2. Validate params.id
    const resolvedParams = await params
    const idValidation = z.string().uuid().safeParse(resolvedParams.id)
    if (!idValidation.success) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    const complaintId = idValidation.data

    // 3. Fetch complaint where deletedAt is null
    const complaint = await db.complaint.findFirst({
      where: { id: complaintId, deletedAt: null },
    })

    if (!complaint) {
      return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
    }

    // 4. Authorization: Creator or Owner
    const isCreator = authResult.userId === complaint.creatorId
    const isOwner = authResult.role === 'OWNER'
    if (!isCreator && !isOwner) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only the creator or Owner can delete this complaint',
        },
        { status: 403 }
      )
    }

    // 5. Perform SOFT delete
    await db.complaint.update({
      where: { id: complaintId },
      data: { deletedAt: new Date() },
    })

    // 6. Return 200 success
    return NextResponse.json(
      { message: 'Complaint deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    // Log actual error server-side only
    console.error('Error deleting complaint:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

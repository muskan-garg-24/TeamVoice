import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { Status } from '@prisma/client'
import { validateTransition } from '@/lib/status-rules'

const statusUpdateSchema = z.object({
  toStatus: z.nativeEnum(Status),
  note: z.string().optional().nullable(),
})

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

    // 2. Validate params.id (UUID)
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

    // Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
    }

    // Validate input with Zod
    const result = statusUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { toStatus, note } = result.data

    // 4. Permission check
    const isCreator = authResult.userId === complaint.creatorId
    const isOwner = authResult.role === 'OWNER'

    let isAuthorized = false
    if (complaint.status === 'OPEN' && toStatus === 'IN_PROGRESS') {
      isAuthorized = isCreator || isOwner
    } else if (complaint.status === 'IN_PROGRESS' && toStatus === 'RESOLVED') {
      isAuthorized = isCreator || isOwner
    } else if (complaint.status === 'OPEN' && toStatus === 'REJECTED') {
      isAuthorized = isOwner
    } else if (complaint.status === 'IN_PROGRESS' && toStatus === 'REJECTED') {
      isAuthorized = isOwner
    } else if (complaint.status === 'RESOLVED' && toStatus === 'OPEN') {
      isAuthorized = isCreator || isOwner
    }

    if (!isAuthorized) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // 5. Validate status transition
    const transitionValidation = validateTransition(complaint.status, toStatus, note)
    if (!transitionValidation.valid) {
      return NextResponse.json(
        { message: transitionValidation.message },
        { status: transitionValidation.status }
      )
    }

    // Process note (trimmed note or null)
    let trimmedNote: string | null = null
    if (note !== undefined && note !== null) {
      const trimmed = note.trim()
      trimmedNote = trimmed === '' ? null : trimmed
    }

    // 6. Execute transaction
    const transactionResult = await db.$transaction(async (tx) => {
      // Update complaint status
      await tx.complaint.update({
        where: { id: complaintId },
        data: { status: toStatus },
      })

      // Create StatusHistory entry
      const historyEntry = await tx.statusHistory.create({
        data: {
          complaintId,
          fromStatus: complaint.status,
          toStatus,
          note: trimmedNote,
          changedById: authResult.userId,
        },
      })

      return historyEntry
    })

    // 7. Return response
    return NextResponse.json(
      {
        status: toStatus,
        historyEntry: {
          id: transactionResult.id,
          fromStatus: transactionResult.fromStatus,
          toStatus: transactionResult.toStatus,
          note: transactionResult.note,
          changedById: transactionResult.changedById,
          createdAt: transactionResult.createdAt,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    // Log error server-side only
    console.error('Error transitioning complaint status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'

const statusUpdateSchema = z.object({
  toStatus: z.string(),
  note: z.string().optional(),
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

    // 4. Authorization: Creator or OWNER
    const isCreator = authResult.userId === complaint.creatorId
    const isOwner = authResult.role === 'OWNER'
    if (!isCreator && !isOwner) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
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

    // 6. Validate input with Zod
    const result = statusUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input fields', errors: result.error.format() },
        { status: 400 }
      )
    }

    const { toStatus, note } = result.data

    // 7. Validate status transition (Only OPEN -> IN_PROGRESS is supported)
    if (toStatus !== 'IN_PROGRESS' || complaint.status !== 'OPEN') {
      return NextResponse.json(
        { message: 'Only OPEN → IN_PROGRESS is supported in this version' },
        { status: 400 }
      )
    }

    // 8. Process note
    let finalNote: string | null = null
    if (note !== undefined && note !== null) {
      const trimmed = note.trim()
      if (trimmed === '') {
        finalNote = null
      } else {
        finalNote = trimmed
      }
    }

    // 9. Execute transaction
    const transactionResult = await db.$transaction(async (tx) => {
      // Update complaint status
      await tx.complaint.update({
        where: { id: complaintId },
        data: { status: 'IN_PROGRESS' },
      })

      // Insert StatusHistory entry
      const historyEntry = await tx.statusHistory.create({
        data: {
          complaintId,
          fromStatus: 'OPEN',
          toStatus: 'IN_PROGRESS',
          note: finalNote,
          changedById: authResult.userId,
        },
      })

      return historyEntry
    })

    // 10. Return response
    return NextResponse.json(
      {
        status: 'IN_PROGRESS',
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

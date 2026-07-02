import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { canViewComplaint, shapeComplaintForResponse } from '@/lib/visibility'

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

    // 3. Fetch complaint
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
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

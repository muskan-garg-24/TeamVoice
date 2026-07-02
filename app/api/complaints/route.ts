import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { filterVisibleComplaints } from '@/lib/visibility'

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

export async function GET(request: Request) {
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

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab')
    if (!tab || !['open', 'resolved', 'rejected'].includes(tab)) {
      return NextResponse.json(
        { message: 'tab query param must be one of: open, resolved, rejected' },
        { status: 400 }
      )
    }

    const pageParam = searchParams.get('page')
    let page = 1
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10)
      if (!isNaN(parsedPage) && parsedPage >= 1) {
        page = parsedPage
      }
    }

    const limitParam = searchParams.get('limit')
    let limit = 20
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit >= 1) {
        limit = Math.min(parsedLimit, 100)
      }
    }

    // 3. Status mapping
    let statuses: ('OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED')[] = []
    if (tab === 'open') {
      // "open" represents active complaints and intentionally includes both OPEN and IN_PROGRESS
      statuses = ['OPEN', 'IN_PROGRESS']
    } else if (tab === 'resolved') {
      statuses = ['RESOLVED']
    } else if (tab === 'rejected') {
      statuses = ['REJECTED']
    }

    // 4. Fetch complaints from Database
    const rawComplaints = await db.complaint.findMany({
      where: {
        status: {
          in: statuses,
        },
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 5. Visibility filtering
    const visibleComplaints = filterVisibleComplaints(rawComplaints, {
      userId: authResult.userId,
      role: authResult.role,
    })

    const total = visibleComplaints.length

    // 6. Pagination
    const startIdx = (page - 1) * limit
    const paginatedComplaints = visibleComplaints.slice(startIdx, startIdx + limit)

    // 7. Response
    return NextResponse.json(
      {
        complaints: paginatedComplaints,
        page,
        limit,
        total,
      },
      { status: 200 }
    )
  } catch (error) {
    // Log error server-side only
    console.error('Error fetching complaints list:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


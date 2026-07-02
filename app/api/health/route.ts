import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Run SELECT 1 as a raw query via the Prisma client
    await db.$queryRaw`SELECT 1`
    
    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    // Log errors server-side only
    console.error('Database health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
      { status: 503 }
    )
  }
}

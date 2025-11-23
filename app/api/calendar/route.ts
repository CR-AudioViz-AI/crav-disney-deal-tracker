import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    calendarData: [],
    message: 'Calendar system ready, deals coming in Phase 2',
    status: 'mvp'
  })
}

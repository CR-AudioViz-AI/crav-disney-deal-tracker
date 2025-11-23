import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // MVP: Return empty deals array, Phase 2 will populate
  return NextResponse.json({
    deals: [],
    message: 'Deal aggregators coming in Phase 2',
    status: 'mvp'
  })
}

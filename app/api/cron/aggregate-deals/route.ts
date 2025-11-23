import { NextRequest, NextResponse } from 'next/server'
import { runAllAggregators } from '@/lib/aggregators/run-all'
import { supabaseAdmin } from '@/lib/supabase/server'
import { addMonths, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Maximum execution time: 60 seconds

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('[Cron] Starting scheduled deal aggregation...')
  
  try {
    // Run all aggregators
    const results = await runAllAggregators()
    
    // Refresh calendar cache for next 3 months
    const today = new Date()
    const threeMonthsLater = addMonths(today, 3)
    
    console.log('[Cron] Refreshing calendar cache...')
    await refreshCalendarCache(today, threeMonthsLater)
    
    console.log('[Cron] Aggregation and cache refresh complete')
    
    return NextResponse.json({
      success: true,
      message: 'Deal aggregation completed successfully',
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Cron] Error during aggregation:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function refreshCalendarCache(startDate: Date, endDate: Date) {
  try {
    const { error } = await supabaseAdmin.rpc('refresh_deal_calendar_cache', {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    })

    if (error) {
      console.error('[Cron] Error refreshing calendar cache:', error)
      throw error
    }
    
    console.log('[Cron] Calendar cache refreshed successfully')
  } catch (error) {
    console.error('[Cron] Failed to refresh calendar cache:', error)
    throw error
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') // Format: YYYY-MM
    const year = searchParams.get('year')

    if (!month && !year) {
      return NextResponse.json(
        { error: 'Month or year parameter required' },
        { status: 400 }
      )
    }

    // Parse date
    const targetDate = month 
      ? new Date(`${month}-01`) 
      : new Date(`${year}-01-01`)
    
    const start = startOfMonth(targetDate)
    const end = endOfMonth(targetDate)

    // Fetch cached calendar data
    const { data: cacheData, error: cacheError } = await supabaseAdmin
      .from('deal_calendar_cache')
      .select('*')
      .gte('cache_date', format(start, 'yyyy-MM-dd'))
      .lte('cache_date', format(end, 'yyyy-MM-dd'))
      .order('cache_date', { ascending: true })

    if (cacheError) {
      console.error('Error fetching calendar cache:', cacheError)
      // Fall back to computing on-the-fly if cache fails
      return await computeCalendarDataFallback(start, end)
    }

    // If cache is empty or stale, refresh it
    if (!cacheData || cacheData.length === 0) {
      await refreshCalendarCache(start, end)
      
      // Retry fetch after refresh
      const { data: refreshedData, error: retryError } = await supabaseAdmin
        .from('deal_calendar_cache')
        .select('*')
        .gte('cache_date', format(start, 'yyyy-MM-dd'))
        .lte('cache_date', format(end, 'yyyy-MM-dd'))
        .order('cache_date', { ascending: true })

      if (retryError) {
        return await computeCalendarDataFallback(start, end)
      }

      return NextResponse.json({ calendar: refreshedData || [] })
    }

    return NextResponse.json({ calendar: cacheData })
  } catch (error) {
    console.error('Unexpected error in calendar API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to refresh calendar cache
async function refreshCalendarCache(startDate: Date, endDate: Date) {
  try {
    const { error } = await supabaseAdmin.rpc('refresh_deal_calendar_cache', {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    })

    if (error) {
      console.error('Error refreshing calendar cache:', error)
    }
  } catch (error) {
    console.error('Unexpected error refreshing cache:', error)
  }
}

// Fallback function to compute calendar data on-the-fly
async function computeCalendarDataFallback(startDate: Date, endDate: Date) {
  try {
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    const calendarData = await Promise.all(
      days.map(async (day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        
        const { data: deals, error } = await supabaseAdmin
          .from('deals')
          .select('id, discount_percentage, deal_type')
          .eq('is_active', true)
          .lte('travel_valid_from', dayStr)
          .gte('travel_valid_to', dayStr)

        if (error) {
          console.error(`Error fetching deals for ${dayStr}:`, error)
          return {
            cache_date: dayStr,
            deal_count: 0,
            best_discount_percentage: null,
            deal_quality: 'none',
            deals_by_type: {}
          }
        }

        const dealCount = deals?.length || 0
        const bestDiscount = deals && deals.length > 0
          ? Math.max(...deals.filter(d => d.discount_percentage).map(d => d.discount_percentage!))
          : null

        const dealQuality = bestDiscount 
          ? bestDiscount >= 30 ? 'excellent'
          : bestDiscount >= 20 ? 'great'
          : bestDiscount >= 10 ? 'good'
          : 'standard'
          : 'none'

        // Count deals by type
        const dealsByType = deals?.reduce((acc, deal) => {
          acc[deal.deal_type] = (acc[deal.deal_type] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        return {
          cache_date: dayStr,
          deal_count: dealCount,
          best_discount_percentage: bestDiscount,
          deal_quality: dealQuality,
          deals_by_type: dealsByType
        }
      })
    )

    return NextResponse.json({ calendar: calendarData })
  } catch (error) {
    console.error('Error in fallback computation:', error)
    return NextResponse.json(
      { error: 'Failed to compute calendar data' },
      { status: 500 }
    )
  }
}

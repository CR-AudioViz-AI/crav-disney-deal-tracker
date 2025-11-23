import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, addDays, format, differenceInDays } from 'date-fns'

export const dynamic = 'force-dynamic'

/**
 * Deal Comparison API
 * Find best deals across date ranges, resorts, and configurations
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const comparison_type = searchParams.get('type') || 'date_range'
    
    switch (comparison_type) {
      case 'date_range':
        return await compareDateRanges(request)
      
      case 'resorts':
        return await compareResorts(request)
      
      case 'flexible_dates':
        return await findFlexibleDates(request)
      
      case 'weekly':
        return await compareWeekly(request)
      
      default:
        return NextResponse.json(
          { error: 'Invalid comparison type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Compare API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Compare multiple date ranges
async function compareDateRanges(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')
  const nights = parseInt(searchParams.get('nights') || '7')
  const resort_types = searchParams.get('resort_types')?.split(',')
  
  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: 'start_date and end_date required' },
      { status: 400 }
    )
  }
  
  const start = new Date(start_date)
  const end = new Date(end_date)
  const totalDays = differenceInDays(end, start)
  
  if (totalDays < nights) {
    return NextResponse.json(
      { error: 'Date range too short for requested nights' },
      { status: 400 }
    )
  }
  
  const comparisons = []
  
  // Check each possible start date
  for (let i = 0; i <= totalDays - nights; i++) {
    const checkIn = addDays(start, i)
    const checkOut = addDays(checkIn, nights)
    
    const result = await findBestDealForDates(
      checkIn,
      checkOut,
      resort_types
    )
    
    if (result) {
      comparisons.push({
        check_in: format(checkIn, 'yyyy-MM-dd'),
        check_out: format(checkOut, 'yyyy-MM-dd'),
        nights,
        ...result
      })
    }
  }
  
  // Sort by total price
  comparisons.sort((a, b) => a.total_price - b.total_price)
  
  const best = comparisons[0]
  const worst = comparisons[comparisons.length - 1]
  const average = comparisons.reduce((sum, c) => sum + c.total_price, 0) / comparisons.length
  
  return NextResponse.json({
    comparisons,
    summary: {
      best_deal: best,
      worst_deal: worst,
      average_price: Math.round(average),
      potential_savings: worst ? worst.total_price - best.total_price : 0,
      options_analyzed: comparisons.length
    }
  })
}

// Compare different resorts for same dates
async function compareResorts(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const check_in = searchParams.get('check_in')
  const check_out = searchParams.get('check_out')
  
  if (!check_in || !check_out) {
    return NextResponse.json(
      { error: 'check_in and check_out required' },
      { status: 400 }
    )
  }
  
  // Get all resorts
  const { data: resorts, error } = await supabaseAdmin
    .from('resorts')
    .select('*')
    .eq('is_active', true)
    .order('resort_type')
  
  if (error) throw error
  
  const comparisons = []
  
  for (const resort of resorts || []) {
    // Find best deal for this resort
    const { data: deals } = await supabaseAdmin
      .from('deals')
      .select(`
        *,
        score:deal_scores(*)
      `)
      .eq('resort_id', resort.id)
      .eq('is_active', true)
      .lte('travel_valid_from', check_in)
      .gte('travel_valid_to', check_out)
      .order('discount_percentage', { ascending: false })
      .limit(1)
    
    const deal = deals?.[0]
    
    if (deal) {
      const nights = differenceInDays(new Date(check_out), new Date(check_in))
      const pricePerNight = deal.deal_price || deal.original_price || 0
      const totalPrice = pricePerNight * nights
      
      comparisons.push({
        resort: {
          id: resort.id,
          name: resort.name,
          type: resort.resort_type,
          category: resort.category
        },
        deal: {
          id: deal.id,
          title: deal.title,
          discount_percentage: deal.discount_percentage,
          price_per_night: pricePerNight,
          total_price: totalPrice,
          deal_code: deal.deal_code,
          source_url: deal.source_url,
          javari_score: deal.score?.[0]?.total_score || 0
        }
      })
    } else {
      // No active deal, use base pricing
      comparisons.push({
        resort: {
          id: resort.id,
          name: resort.name,
          type: resort.resort_type,
          category: resort.category
        },
        deal: null,
        estimated_price: getEstimatedPrice(resort.resort_type)
      })
    }
  }
  
  // Sort by total price
  comparisons.sort((a, b) => {
    const priceA = a.deal?.total_price || a.estimated_price || 999999
    const priceB = b.deal?.total_price || b.estimated_price || 999999
    return priceA - priceB
  })
  
  return NextResponse.json({
    comparisons,
    check_in,
    check_out,
    best_value: comparisons[0],
    best_deal_percentage: comparisons[0]?.deal?.discount_percentage || 0
  })
}

// Find flexible dates (cheapest nearby dates)
async function findFlexibleDates(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const target_date = searchParams.get('target_date')
  const nights = parseInt(searchParams.get('nights') || '7')
  const flex_days = parseInt(searchParams.get('flex_days') || '3')
  const resort_types = searchParams.get('resort_types')?.split(',')
  
  if (!target_date) {
    return NextResponse.json(
      { error: 'target_date required' },
      { status: 400 }
    )
  }
  
  const targetDate = new Date(target_date)
  const suggestions = []
  
  // Check dates within flex_days before and after
  for (let i = -flex_days; i <= flex_days; i++) {
    const checkIn = addDays(targetDate, i)
    const checkOut = addDays(checkIn, nights)
    
    const result = await findBestDealForDates(
      checkIn,
      checkOut,
      resort_types
    )
    
    if (result) {
      suggestions.push({
        check_in: format(checkIn, 'yyyy-MM-dd'),
        check_out: format(checkOut, 'yyyy-MM-dd'),
        days_difference: i,
        ...result
      })
    }
  }
  
  // Sort by price
  suggestions.sort((a, b) => a.total_price - b.total_price)
  
  const targetResult = suggestions.find(s => s.days_difference === 0)
  const bestAlternative = suggestions[0]
  
  return NextResponse.json({
    target_dates: targetResult,
    best_alternative: bestAlternative,
    all_suggestions: suggestions,
    potential_savings: targetResult && bestAlternative
      ? targetResult.total_price - bestAlternative.total_price
      : 0
  })
}

// Compare by week (find cheapest week in a month)
async function compareWeekly(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get('month') // YYYY-MM format
  const resort_types = searchParams.get('resort_types')?.split(',')
  
  if (!month) {
    return NextResponse.json(
      { error: 'month required (YYYY-MM format)' },
      { status: 400 }
    )
  }
  
  const [year, monthNum] = month.split('-').map(Number)
  const monthStart = new Date(year, monthNum - 1, 1)
  const monthEnd = new Date(year, monthNum, 0)
  
  const weeks = []
  let currentDate = startOfWeek(monthStart)
  
  while (currentDate <= monthEnd) {
    const weekEnd = endOfWeek(currentDate)
    
    const result = await findBestDealForDates(
      currentDate,
      weekEnd,
      resort_types
    )
    
    if (result) {
      weeks.push({
        week_start: format(currentDate, 'yyyy-MM-dd'),
        week_end: format(weekEnd, 'yyyy-MM-dd'),
        week_number: Math.ceil(currentDate.getDate() / 7),
        ...result
      })
    }
    
    currentDate = addDays(currentDate, 7)
  }
  
  weeks.sort((a, b) => a.total_price - b.total_price)
  
  return NextResponse.json({
    month,
    weeks,
    cheapest_week: weeks[0],
    most_expensive_week: weeks[weeks.length - 1],
    average_price: Math.round(
      weeks.reduce((sum, w) => sum + w.total_price, 0) / weeks.length
    )
  })
}

// Helper: Find best deal for specific dates
async function findBestDealForDates(
  checkIn: Date,
  checkOut: Date,
  resortTypes?: string[]
) {
  const checkInStr = format(checkIn, 'yyyy-MM-dd')
  const checkOutStr = format(checkOut, 'yyyy-MM-dd')
  
  let query = supabaseAdmin
    .from('deals')
    .select(`
      *,
      resort:resorts(*),
      score:deal_scores(*)
    `)
    .eq('is_active', true)
    .lte('travel_valid_from', checkInStr)
    .gte('travel_valid_to', checkOutStr)
  
  if (resortTypes && resortTypes.length > 0) {
    query = query.in('resort.resort_type', resortTypes)
  }
  
  const { data: deals } = await query
    .order('discount_percentage', { ascending: false })
    .limit(10)
  
  if (!deals || deals.length === 0) return null
  
  // Calculate best deal
  const nights = differenceInDays(checkOut, checkIn)
  
  const bestDeal = deals.reduce((best, deal) => {
    const pricePerNight = deal.deal_price || deal.original_price || 999999
    const totalPrice = pricePerNight * nights
    
    if (!best || totalPrice < best.total_price) {
      return {
        deal_id: deal.id,
        resort: deal.resort,
        title: deal.title,
        discount_percentage: deal.discount_percentage,
        price_per_night: pricePerNight,
        total_price: totalPrice,
        deal_code: deal.deal_code,
        source_url: deal.source_url,
        javari_score: deal.score?.[0]?.total_score || 0
      }
    }
    return best
  }, null as any)
  
  return bestDeal
}

// Helper: Estimate base pricing
function getEstimatedPrice(resortType: string): number {
  const basePrices = {
    value: 150,
    moderate: 250,
    deluxe: 450,
    villa: 550,
    partner: 200
  }
  
  return basePrices[resortType as keyof typeof basePrices] || 200
}

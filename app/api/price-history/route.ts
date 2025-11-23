import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const resort_id = searchParams.get('resort_id')
    const room_type = searchParams.get('room_type') || 'standard'
    const start_date = searchParams.get('start_date')
    const months = parseInt(searchParams.get('months') || '12')
    
    if (!resort_id) {
      return NextResponse.json(
        { error: 'resort_id required' },
        { status: 400 }
      )
    }
    
    const startDate = start_date ? new Date(start_date) : subMonths(new Date(), months)
    
    // Fetch price snapshots
    const { data: snapshots, error } = await supabaseAdmin
      .from('price_snapshots')
      .select('*')
      .eq('resort_id', resort_id)
      .eq('room_type', room_type)
      .gte('snapshot_date', startDate.toISOString())
      .order('snapshot_date', { ascending: true })
    
    if (error) throw error
    
    // Group by month and calculate averages
    const monthlyData = new Map<string, number[]>()
    
    snapshots?.forEach(snapshot => {
      const monthKey = format(new Date(snapshot.snapshot_date), 'yyyy-MM')
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, [])
      }
      monthlyData.get(monthKey)!.push(snapshot.price_per_night)
    })
    
    // Calculate statistics
    const data: any[] = []
    const allPrices: number[] = []
    
    monthlyData.forEach((prices, month) => {
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
      allPrices.push(...prices)
      
      data.push({
        date: `${month}-01`,
        price: Math.round(avgPrice),
        average: 0, // Will calculate after
        lowest: Math.min(...prices),
        highest: Math.max(...prices)
      })
    })
    
    // Calculate overall average
    const overallAverage = allPrices.length > 0
      ? Math.round(allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length)
      : 0
    
    // Add average to all data points
    data.forEach(point => {
      point.average = overallAverage
    })
    
    // Find best and worst months
    let bestMonth = ''
    let worstMonth = ''
    let lowestPrice = Infinity
    let highestPrice = 0
    
    data.forEach(point => {
      if (point.lowest < lowestPrice) {
        lowestPrice = point.lowest
        bestMonth = format(new Date(point.date), 'MMMM yyyy')
      }
      if (point.highest > highestPrice) {
        highestPrice = point.highest
        worstMonth = format(new Date(point.date), 'MMMM yyyy')
      }
    })
    
    // Current price (most recent)
    const currentPrice = data.length > 0 ? data[data.length - 1].price : 0
    
    // Calculate trend (% difference from average)
    const trend = overallAverage > 0
      ? ((currentPrice - overallAverage) / overallAverage * 100)
      : 0
    
    return NextResponse.json({
      data,
      stats: {
        current: currentPrice,
        average: overallAverage,
        lowest: Math.round(lowestPrice),
        highest: Math.round(highestPrice),
        trend: Math.round(trend * 10) / 10,
        bestMonth,
        worstMonth
      }
    })
    
  } catch (error) {
    console.error('[Price History API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Add price snapshot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabaseAdmin
      .from('price_snapshots')
      .insert([{
        resort_id: body.resort_id,
        room_type: body.room_type,
        check_in_date: body.check_in_date,
        nights: body.nights,
        price_per_night: body.price_per_night,
        total_price: body.total_price,
        source: body.source,
        deal_id: body.deal_id,
        availability: body.availability,
        special_offer: body.special_offer
      }])
      .select()
    
    if (error) throw error
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('[Price History API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

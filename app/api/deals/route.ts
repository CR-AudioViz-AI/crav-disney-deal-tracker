import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { DealWithResort } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Date range parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Filter parameters
    const resortTypes = searchParams.get('resortTypes')?.split(',').filter(Boolean)
    const dealTypes = searchParams.get('dealTypes')?.split(',').filter(Boolean)
    const minDiscount = searchParams.get('minDiscount')
    const maxPrice = searchParams.get('maxPrice')
    const passholderOnly = searchParams.get('passholderOnly') === 'true'
    const includePartnerHotels = searchParams.get('includePartnerHotels') !== 'false'
    
    // Build query
    let query = supabaseAdmin
      .from('deals')
      .select(`
        *,
        resort:resorts(*)
      `)
      .eq('is_active', true)

    // Date filtering
    if (startDate && endDate) {
      query = query
        .lte('travel_valid_from', endDate)
        .gte('travel_valid_to', startDate)
    }

    // Resort type filtering
    if (resortTypes && resortTypes.length > 0) {
      query = query.in('resort.resort_type', resortTypes)
    }

    // Deal type filtering
    if (dealTypes && dealTypes.length > 0) {
      query = query.in('deal_type', dealTypes)
    }

    // Discount filtering
    if (minDiscount) {
      query = query.gte('discount_percentage', parseFloat(minDiscount))
    }

    // Price filtering
    if (maxPrice) {
      query = query.lte('deal_price', parseFloat(maxPrice))
    }

    // Passholder filtering
    if (passholderOnly) {
      query = query.eq('deal_type', 'passholder_exclusive')
    }

    // Partner hotel filtering
    if (!includePartnerHotels) {
      query = query.eq('resort.official_disney', true)
    }

    // Order by priority and discount
    query = query.order('priority', { ascending: false })
      .order('discount_percentage', { ascending: false, nullsFirst: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching deals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deals: data || [] })
  } catch (error) {
    console.error('Unexpected error in deals API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint to create a new deal (manual entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.valid_from || !body.valid_to || !body.source_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('deals')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating deal:', error)
      return NextResponse.json(
        { error: 'Failed to create deal' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deal: data }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST deals API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

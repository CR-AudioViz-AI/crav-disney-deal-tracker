import * as cheerio from 'cheerio'
import { supabaseAdmin } from '@/lib/supabase/server'

interface ParsedDeal {
  title: string
  description: string
  deal_type: string
  discount_percentage: number | null
  valid_from: string
  valid_to: string
  travel_valid_from: string
  travel_valid_to: string
  source_url: string
  deal_code?: string
}

export async function aggregateDISboards() {
  console.log('[DISboards] Starting aggregation...')
  
  try {
    // Scrape the DIScounts forum page
    const response = await fetch('https://www.disboards.com/forums/budget-board.91/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const deals: ParsedDeal[] = []
    
    // Find thread titles that contain deal keywords
    $('.structItem-title a, .discussionListItem-title a, h3.title a').each((_, link) => {
      const $link = $(link)
      const title = $link.text().trim()
      const url = $link.attr('href')
      
      if (!title || !url || title.length < 10) return
      
      // Look for deal-related keywords
      const dealKeywords = [
        'discount', 'off', 'save', 'deal', 'offer', 'promo',
        'free dining', 'room rate', 'passholder', 'code',
        'special', '%', 'price'
      ]
      
      const titleLower = title.toLowerCase()
      const hasDealKeyword = dealKeywords.some(keyword => titleLower.includes(keyword))
      
      if (!hasDealKeyword) return
      
      // Parse deal from title
      const deal = parseDealFromTitle(title, url)
      if (deal) {
        deals.push(deal)
      }
    })
    
    console.log(`[DISboards] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'DISboards')
    }
    
    // Update source status
    await updateSourceStatus('DISboards', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[DISboards] Error:', error)
    await updateSourceStatus('DISboards', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function parseDealFromTitle(title: string, url: string): ParsedDeal | null {
  // Extract discount percentage
  const discountMatch = title.match(/(\d+)%\s*(?:off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract promo code
  const codeMatch = title.match(/code[:\s]+([A-Z0-9]+)/i)
  const dealCode = codeMatch ? codeMatch[1] : undefined
  
  // Extract date ranges if present
  const dateMatch = title.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*-\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i)
  
  let validFrom = new Date()
  let validTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Default 90 days
  
  if (dateMatch) {
    try {
      validFrom = new Date(dateMatch[1])
      validTo = new Date(dateMatch[2])
    } catch (e) {
      // Keep defaults
    }
  }
  
  // Determine deal type from title
  let dealType = 'other'
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('free dining')) {
    dealType = 'free_dining'
  } else if (titleLower.includes('room') && (titleLower.includes('discount') || titleLower.includes('rate'))) {
    dealType = 'room_discount'
  } else if (titleLower.includes('package')) {
    dealType = 'package_discount'
  } else if (titleLower.includes('passholder') || titleLower.includes('annual pass') || titleLower.includes('ap ')) {
    dealType = 'passholder_exclusive'
  } else if (titleLower.includes('upgrade')) {
    dealType = 'room_upgrade'
  }
  
  // Create description from title
  const description = `Community-shared deal from DISboards: ${title}`
  
  // Build full URL
  const fullUrl = url.startsWith('http') ? url : `https://www.disboards.com${url}`
  
  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    deal_type: dealType as any,
    discount_percentage: discount,
    valid_from: validFrom.toISOString().split('T')[0],
    valid_to: validTo.toISOString().split('T')[0],
    travel_valid_from: validFrom.toISOString().split('T')[0],
    travel_valid_to: validTo.toISOString().split('T')[0],
    source_url: fullUrl,
    deal_code: dealCode
  }
}

async function saveDeal(deal: ParsedDeal, sourceName: string) {
  try {
    // Get source ID
    const { data: source } = await supabaseAdmin
      .from('deal_sources')
      .select('id')
      .eq('name', sourceName)
      .single()
    
    if (!source) {
      console.error(`[${sourceName}] Source not found in database`)
      return
    }
    
    // Check if deal already exists (by source URL)
    const { data: existing } = await supabaseAdmin
      .from('deals')
      .select('id')
      .eq('source_url', deal.source_url)
      .single()
    
    if (existing) {
      // Update existing deal
      await supabaseAdmin
        .from('deals')
        .update({
          ...deal,
          source_id: source.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      console.log(`[${sourceName}] Updated existing deal: ${deal.title}`)
    } else {
      // Insert new deal
      await supabaseAdmin
        .from('deals')
        .insert([{
          ...deal,
          source_id: source.id,
          is_active: true,
          priority: 0,
          blackout_dates: [],
          ticket_required: false,
          dining_plan_included: deal.deal_type === 'free_dining'
        }])
      
      console.log(`[${sourceName}] Created new deal: ${deal.title}`)
    }
  } catch (error) {
    console.error(`[${sourceName}] Error saving deal:`, error)
  }
}

async function updateSourceStatus(sourceName: string, success: boolean, error?: string) {
  try {
    const { data: source } = await supabaseAdmin
      .from('deal_sources')
      .select('error_count')
      .eq('name', sourceName)
      .single()
    
    const updateData: any = {
      last_checked_at: new Date().toISOString(),
    }
    
    if (success) {
      updateData.error_count = 0
      updateData.last_error = null
    } else {
      updateData.error_count = (source?.error_count || 0) + 1
      updateData.last_error = error || 'Unknown error'
    }
    
    await supabaseAdmin
      .from('deal_sources')
      .update(updateData)
      .eq('name', sourceName)
  } catch (error) {
    console.error(`[${sourceName}] Error updating source status:`, error)
  }
}

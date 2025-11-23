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
  booking_deadline?: string
}

export async function aggregateDisneyTouristBlog() {
  console.log('[Disney Tourist Blog] Starting aggregation...')
  
  try {
    const response = await fetch('https://www.disneytouristblog.com/current-discounts-promos-disney-world-land/', {
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
    
    // Disney Tourist Blog structures deals in article sections with headings
    $('article, .entry-content').find('h2, h3').each((_, heading) => {
      const $heading = $(heading)
      const headingText = $heading.text().trim()
      
      // Skip navigation headers
      if (headingText.length < 15 || headingText.length > 250) return
      
      // Look for deal indicators in heading
      const isDeal = /discount|save|off|deal|offer|special|promo|free|%/i.test(headingText)
      if (!isDeal) return
      
      // Get content following this heading
      let description = ''
      let nextElement = $heading.next()
      let iterations = 0
      
      while (nextElement.length > 0 && iterations < 5) {
        const tagName = nextElement.prop('tagName')?.toLowerCase()
        
        // Stop at next heading
        if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') break
        
        // Collect paragraph text
        if (tagName === 'p' || tagName === 'ul' || tagName === 'ol') {
          description += nextElement.text().trim() + ' '
        }
        
        nextElement = nextElement.next()
        iterations++
      }
      
      description = description.trim()
      
      if (description.length < 30) return
      
      // Parse deal from heading and description
      const deal = parseDealFromContent(headingText, description)
      if (deal) {
        deals.push({
          ...deal,
          source_url: 'https://www.disneytouristblog.com/current-discounts-promos-disney-world-land/'
        })
      }
    })
    
    console.log(`[Disney Tourist Blog] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'Disney Tourist Blog')
    }
    
    // Update source status
    await updateSourceStatus('Disney Tourist Blog', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[Disney Tourist Blog] Error:', error)
    await updateSourceStatus('Disney Tourist Blog', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function parseDealFromContent(title: string, description: string): Omit<ParsedDeal, 'source_url'> | null {
  const combinedText = `${title} ${description}`
  
  // Extract discount percentage
  const discountMatch = combinedText.match(/(\d+)%\s*(?:off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract "up to X%" discounts
  const upToMatch = combinedText.match(/up\s+to\s+(\d+)%/i)
  const upToDiscount = upToMatch ? parseInt(upToMatch[1]) : null
  const finalDiscount = upToDiscount || discount
  
  // Extract booking deadline
  const bookingDeadlineMatch = combinedText.match(/book(?:ing)?\s+(?:by|through|until)\s+(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i)
  const bookingDeadline = bookingDeadlineMatch ? parseDate(bookingDeadlineMatch[1]) : undefined
  
  // Extract travel/stay dates
  const datePatterns = [
    // "January 1 - March 31, 2026"
    /(?:valid|stay|travel|arrival|check-in)?\s*(\w+\s+\d{1,2})(?:\s*,\s*\d{4})?\s*(?:-|through|to|until)\s*(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i,
    // "2025-2026" or "Fall 2025"
    /(?:for|through)\s+(\w+)\s+(\d{4})/i,
    // "Most nights from November 16 to November 29, 2025"
    /from\s+(\w+\s+\d{1,2})\s+to\s+(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i
  ]
  
  let validFrom = new Date()
  let validTo = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // Default 180 days
  
  for (const pattern of datePatterns) {
    const match = combinedText.match(pattern)
    if (match) {
      try {
        const fromStr = parseDate(match[1])
        const toStr = parseDate(match[2])
        
        if (fromStr) validFrom = new Date(fromStr)
        if (toStr) validTo = new Date(toStr)
        
        // Ensure valid date range
        if (validFrom > validTo) {
          // Swap if reversed
          [validFrom, validTo] = [validTo, validFrom]
        }
        break
      } catch (e) {
        // Continue with defaults if parsing fails
      }
    }
  }
  
  // Determine deal type
  let dealType = 'other'
  const textLower = combinedText.toLowerCase()
  
  if (textLower.includes('free dining') || textLower.includes('dining plan')) {
    dealType = 'free_dining'
  } else if (textLower.includes('room discount') || textLower.includes('resort discount') || textLower.includes('accommodation')) {
    dealType = 'room_discount'
  } else if (textLower.includes('package')) {
    dealType = 'package_discount'
  } else if (textLower.includes('free night') || textLower.includes('complimentary night')) {
    dealType = 'free_nights'
  } else if (textLower.includes('upgrade')) {
    dealType = 'room_upgrade'
  } else if (textLower.includes('annual pass') || textLower.includes('passholder') || textLower.includes('ap ')) {
    dealType = 'passholder_exclusive'
  }
  
  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    deal_type: dealType as any,
    discount_percentage: finalDiscount,
    valid_from: validFrom.toISOString().split('T')[0],
    valid_to: validTo.toISOString().split('T')[0],
    travel_valid_from: validFrom.toISOString().split('T')[0],
    travel_valid_to: validTo.toISOString().split('T')[0],
    booking_deadline: bookingDeadline
  }
}

function parseDate(dateStr: string): string {
  try {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    
    // Add year if not present
    if (!dateStr.includes(',') && !/\d{4}/.test(dateStr)) {
      // Determine if date should be current year or next year
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december']
      const currentMonth = new Date().getMonth()
      
      const dateMonth = monthNames.findIndex(m => dateStr.toLowerCase().includes(m))
      
      if (dateMonth !== -1 && dateMonth < currentMonth) {
        dateStr = `${dateStr}, ${nextYear}`
      } else {
        dateStr = `${dateStr}, ${currentYear}`
      }
    }
    
    const parsed = new Date(dateStr)
    return parsed.toISOString().split('T')[0]
  } catch (e) {
    return new Date().toISOString().split('T')[0]
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
    
    // Check if deal already exists (by title and source)
    const { data: existing } = await supabaseAdmin
      .from('deals')
      .select('id')
      .eq('title', deal.title)
      .eq('source_id', source.id)
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
          priority: 1, // Higher priority for comprehensive source
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

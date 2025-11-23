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

export async function aggregateAllEars() {
  console.log('[AllEars.net] Starting aggregation...')
  
  try {
    // AllEars has deals in their news section
    const response = await fetch('https://allears.net/category/walt-disney-world/wdw-planning/wdw-deals/', {
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
    
    // Find article cards or post entries
    $('.post, article, .entry, .card').each((_, element) => {
      const $element = $(element)
      
      // Get title
      const $title = $element.find('h2, h3, .entry-title, .post-title, .card-title').first()
      const title = $title.text().trim()
      
      // Get link
      const $link = $title.find('a').length > 0 ? $title.find('a') : $element.find('a').first()
      const url = $link.attr('href')
      
      // Get excerpt/description
      const $excerpt = $element.find('.excerpt, .entry-content, .card-text, p').first()
      const description = $excerpt.text().trim()
      
      if (!title || title.length < 10 || !url) return
      
      // Check if it's deal-related
      const dealKeywords = ['discount', 'save', 'deal', 'offer', 'promo', 'free', '%', 'special']
      const titleLower = title.toLowerCase()
      const isDeal = dealKeywords.some(keyword => titleLower.includes(keyword))
      
      if (!isDeal) return
      
      // Parse deal
      const deal = parseDealFromContent(title, description, url)
      if (deal) {
        deals.push(deal)
      }
    })
    
    console.log(`[AllEars.net] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'AllEars.net')
    }
    
    // Update source status
    await updateSourceStatus('AllEars.net', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[AllEars.net] Error:', error)
    await updateSourceStatus('AllEars.net', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function parseDealFromContent(title: string, description: string, url: string): ParsedDeal | null {
  const combinedText = `${title} ${description}`
  
  // Extract discount percentage
  const discountMatch = combinedText.match(/(\d+)%\s*(?:off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract "up to X%" discounts
  const upToMatch = combinedText.match(/up\s+to\s+(\d+)%/i)
  const upToDiscount = upToMatch ? parseInt(upToMatch[1]) : null
  const finalDiscount = upToDiscount || discount
  
  // Extract promo code
  const codeMatch = combinedText.match(/(?:code|promo)[:\s]+([A-Z0-9]+)/i)
  const dealCode = codeMatch ? codeMatch[1] : undefined
  
  // Extract date ranges
  const datePatterns = [
    /(\w+\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|through|to|until)\s*(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i,
    /(?:valid|stay)\s+(\w+\s+\d{1,2})\s*-\s*(\w+\s+\d{1,2})/i,
    /from\s+(\w+\s+\d{1,2})\s+to\s+(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i
  ]
  
  let validFrom = new Date()
  let validTo = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) // Default 120 days
  
  for (const pattern of datePatterns) {
    const match = combinedText.match(pattern)
    if (match) {
      try {
        const currentYear = new Date().getFullYear()
        const fromStr = match[1].includes(',') ? match[1] : `${match[1]}, ${currentYear}`
        const toStr = match[2].includes(',') ? match[2] : `${match[2]}, ${currentYear}`
        
        validFrom = new Date(fromStr)
        validTo = new Date(toStr)
        break
      } catch (e) {
        // Continue with defaults
      }
    }
  }
  
  // Determine deal type
  let dealType = 'other'
  const textLower = combinedText.toLowerCase()
  
  if (textLower.includes('free dining')) {
    dealType = 'free_dining'
  } else if (textLower.includes('room') && (textLower.includes('discount') || textLower.includes('rate'))) {
    dealType = 'room_discount'
  } else if (textLower.includes('package')) {
    dealType = 'package_discount'
  } else if (textLower.includes('free night')) {
    dealType = 'free_nights'
  } else if (textLower.includes('upgrade')) {
    dealType = 'room_upgrade'
  } else if (textLower.includes('passholder') || textLower.includes('annual pass')) {
    dealType = 'passholder_exclusive'
  }
  
  // Build full URL
  const fullUrl = url.startsWith('http') ? url : `https://allears.net${url}`
  
  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500) || title,
    deal_type: dealType as any,
    discount_percentage: finalDiscount,
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

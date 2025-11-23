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

export async function aggregateMouseSavers() {
  console.log('[MouseSavers] Starting aggregation...')
  
  try {
    const response = await fetch('https://www.mousesavers.com/disney-world-vacation-discounts/', {
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
    
    // MouseSavers typically lists deals in specific sections
    // Look for discount information in article content
    $('article, .entry-content, .post-content').each((_, element) => {
      const $element = $(element)
      const text = $element.text()
      
      // Look for deal patterns
      const dealPatterns = [
        /(\d+)%\s*off/gi,
        /save\s+up\s+to\s+(\d+)%/gi,
        /room\s+discount/gi,
        /special\s+offer/gi,
        /free\s+dining/gi
      ]
      
      let hasDeals = false
      dealPatterns.forEach(pattern => {
        if (pattern.test(text)) {
          hasDeals = true
        }
      })
      
      if (!hasDeals) return
      
      // Extract deal information
      $element.find('h2, h3, h4, strong').each((_, heading) => {
        const $heading = $(heading)
        const headingText = $heading.text().trim()
        
        if (headingText.length < 10 || headingText.length > 200) return
        
        // Get the content following this heading
        let description = ''
        let nextElement = $heading.next()
        let iterations = 0
        
        while (nextElement.length > 0 && iterations < 3) {
          const tagName = nextElement.prop('tagName')?.toLowerCase()
          if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') break
          
          description += nextElement.text().trim() + ' '
          nextElement = nextElement.next()
          iterations++
        }
        
        description = description.trim().substring(0, 500)
        
        if (description.length < 20) return
        
        // Parse deal details
        const deal = parseDealFromText(headingText, description)
        if (deal) {
          deals.push({
            ...deal,
            source_url: 'https://www.mousesavers.com/disney-world-vacation-discounts/'
          })
        }
      })
    })
    
    console.log(`[MouseSavers] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'MouseSavers')
    }
    
    // Update source status
    await updateSourceStatus('MouseSavers', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[MouseSavers] Error:', error)
    await updateSourceStatus('MouseSavers', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function parseDealFromText(title: string, description: string): Omit<ParsedDeal, 'source_url'> | null {
  const combinedText = `${title} ${description}`
  
  // Extract discount percentage
  const discountMatch = combinedText.match(/(\d+)%\s*(off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract promo code
  const codeMatch = combinedText.match(/code[:\s]+([A-Z0-9]+)/i)
  const dealCode = codeMatch ? codeMatch[1] : undefined
  
  // Extract date ranges
  const datePatterns = [
    /(\w+\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|through|to|until)\s*(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i,
    /valid\s+(\w+\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|through|to)\s*(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i
  ]
  
  let validFrom = new Date()
  let validTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  
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
        // Continue with defaults if parsing fails
      }
    }
  }
  
  // Determine deal type
  let dealType = 'other'
  const textLower = combinedText.toLowerCase()
  
  if (textLower.includes('free dining')) {
    dealType = 'free_dining'
  } else if (textLower.includes('room discount') || textLower.includes('room rate') || textLower.includes('resort discount')) {
    dealType = 'room_discount'
  } else if (textLower.includes('package')) {
    dealType = 'package_discount'
  } else if (textLower.includes('free night') || textLower.includes('complimentary night')) {
    dealType = 'free_nights'
  } else if (textLower.includes('upgrade')) {
    dealType = 'room_upgrade'
  } else if (textLower.includes('passholder') || textLower.includes('annual pass')) {
    dealType = 'passholder_exclusive'
  }
  
  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    deal_type: dealType as any,
    discount_percentage: discount,
    valid_from: validFrom.toISOString().split('T')[0],
    valid_to: validTo.toISOString().split('T')[0],
    travel_valid_from: validFrom.toISOString().split('T')[0],
    travel_valid_to: validTo.toISOString().split('T')[0],
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

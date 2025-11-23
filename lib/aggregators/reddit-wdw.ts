import { supabaseAdmin } from '@/lib/supabase/server'

interface RedditPost {
  data: {
    title: string
    selftext: string
    url: string
    permalink: string
    created_utc: number
    score: number
    num_comments: number
  }
}

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

export async function aggregateRedditWDW() {
  console.log('[Reddit r/WaltDisneyWorld] Starting aggregation...')
  
  try {
    // Fetch hot posts from Reddit JSON API
    const response = await fetch('https://www.reddit.com/r/WaltDisneyWorld/hot.json?limit=25', {
      headers: {
        'User-Agent': 'Disney-Deal-Tracker/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const json = await response.json()
    const posts: RedditPost[] = json.data?.children || []
    
    const deals: ParsedDeal[] = []
    
    for (const post of posts) {
      const { title, selftext, permalink, score } = post.data
      
      if (!title) continue
      
      // Look for deal indicators
      const dealKeywords = [
        'discount', 'save', 'deal', 'offer', 'promo', 'code',
        'free', '%', 'off', 'special', 'resort rate', 'room rate',
        'cheap', 'price', 'booking', 'passholder'
      ]
      
      const titleLower = title.toLowerCase()
      const textLower = selftext?.toLowerCase() || ''
      const combinedText = titleLower + ' ' + textLower
      
      const hasDealKeyword = dealKeywords.some(keyword => combinedText.includes(keyword))
      
      // Also check if post has good engagement (community validated)
      const hasGoodEngagement = score > 10 || post.data.num_comments > 5
      
      if (!hasDealKeyword && !hasGoodEngagement) continue
      
      // Parse deal from post
      const deal = parseDealFromPost(title, selftext || '', permalink)
      if (deal) {
        deals.push(deal)
      }
    }
    
    console.log(`[Reddit r/WaltDisneyWorld] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'Reddit WaltDisneyWorld')
    }
    
    // Update source status
    await updateSourceStatus('Reddit WaltDisneyWorld', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[Reddit r/WaltDisneyWorld] Error:', error)
    await updateSourceStatus('Reddit WaltDisneyWorld', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function parseDealFromPost(title: string, text: string, permalink: string): ParsedDeal | null {
  const combinedText = `${title} ${text}`
  
  // Extract discount percentage
  const discountMatch = combinedText.match(/(\d+)%\s*(?:off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract "up to X%" discounts
  const upToMatch = combinedText.match(/up\s+to\s+(\d+)%/i)
  const upToDiscount = upToMatch ? parseInt(upToMatch[1]) : null
  const finalDiscount = upToDiscount || discount
  
  // Extract promo code
  const codePatterns = [
    /(?:code|promo)[:\s]+([A-Z0-9]{4,15})/i,
    /use\s+([A-Z0-9]{4,15})/i,
    /\b([A-Z]{3,}\d{2,})\b/  // Pattern like ABC2025
  ]
  
  let dealCode: string | undefined
  for (const pattern of codePatterns) {
    const match = combinedText.match(pattern)
    if (match) {
      dealCode = match[1]
      break
    }
  }
  
  // Extract date ranges
  const datePatterns = [
    /(\w+\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|through|to|until)\s*(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /from\s+(\w+\s+\d{1,2})\s+to\s+(\w+\s+\d{1,2}(?:,\s*\d{4})?)/i
  ]
  
  let validFrom = new Date()
  let validTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Default 90 days
  
  for (const pattern of datePatterns) {
    const match = combinedText.match(pattern)
    if (match) {
      try {
        const currentYear = new Date().getFullYear()
        let fromStr = match[1]
        let toStr = match[2]
        
        // Add year if not present
        if (!fromStr.includes(',') && !fromStr.includes('/')) {
          fromStr = `${fromStr}, ${currentYear}`
        }
        if (!toStr.includes(',') && !toStr.includes('/')) {
          toStr = `${toStr}, ${currentYear}`
        }
        
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
  } else if (textLower.includes('passholder') || textLower.includes('annual pass') || textLower.includes(' ap ')) {
    dealType = 'passholder_exclusive'
  }
  
  // Build description
  const description = text.substring(0, 500) || `Reddit community post: ${title}`
  
  // Build full URL
  const fullUrl = `https://www.reddit.com${permalink}`
  
  return {
    title: title.substring(0, 200),
    description,
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

import Parser from 'rss-parser'
import { supabaseAdmin } from '@/lib/supabase/server'

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['dc:creator', 'creator']
    ]
  }
})

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
  resort_name?: string
}

export async function aggregateDisneyParksBlog() {
  console.log('[Disney Parks Blog] Starting aggregation...')
  
  try {
    // Fetch RSS feed
    const feed = await parser.parseURL('https://disneyparks.disney.go.com/blog/feed/')
    
    const deals: ParsedDeal[] = []
    
    for (const item of feed.items) {
      if (!item.title || !item.link) continue
      
      // Look for deal-related keywords in title
      const dealKeywords = [
        'discount', 'offer', 'special', 'save', 'deal', 
        'promotion', 'package', 'free dining', 'room rate',
        'passholder', 'annual pass'
      ]
      
      const titleLower = item.title.toLowerCase()
      const contentLower = (item.content || item.contentSnippet || '').toLowerCase()
      const isDealRelated = dealKeywords.some(keyword => 
        titleLower.includes(keyword) || contentLower.includes(keyword)
      )
      
      if (!isDealRelated) continue
      
      // Try to extract deal information
      const deal = await parseDealFromBlogPost(item)
      if (deal) {
        deals.push(deal)
      }
    }
    
    console.log(`[Disney Parks Blog] Found ${deals.length} potential deals`)
    
    // Save deals to database
    for (const deal of deals) {
      await saveDeal(deal, 'Disney Parks Blog')
    }
    
    // Update source last_checked_at
    await updateSourceStatus('Disney Parks Blog', true)
    
    return { success: true, dealsFound: deals.length }
  } catch (error) {
    console.error('[Disney Parks Blog] Error:', error)
    await updateSourceStatus('Disney Parks Blog', false, error instanceof Error ? error.message : 'Unknown error')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function parseDealFromBlogPost(item: any): Promise<ParsedDeal | null> {
  const title = item.title || ''
  const content = item.content || item.contentSnippet || ''
  const link = item.link || ''
  
  // Extract discount percentage if mentioned
  const discountMatch = content.match(/(\d+)%\s*(off|discount|savings)/i)
  const discount = discountMatch ? parseInt(discountMatch[1]) : null
  
  // Extract date ranges (common formats)
  const dateRangeMatch = content.match(/(\w+ \d+(?:, \d{4})?)\s*(?:-|through|to)\s*(\w+ \d+(?:, \d{4})?)/i)
  
  // Default to current year if not specified
  const currentYear = new Date().getFullYear()
  const validFrom = dateRangeMatch 
    ? new Date(dateRangeMatch[1].includes(',') ? dateRangeMatch[1] : `${dateRangeMatch[1]}, ${currentYear}`)
    : new Date()
  const validTo = dateRangeMatch
    ? new Date(dateRangeMatch[2].includes(',') ? dateRangeMatch[2] : `${dateRangeMatch[2]}, ${currentYear}`)
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Default 90 days
  
  // Determine deal type
  let dealType = 'other'
  if (content.toLowerCase().includes('free dining')) {
    dealType = 'free_dining'
  } else if (content.toLowerCase().includes('room discount') || content.toLowerCase().includes('room rate')) {
    dealType = 'room_discount'
  } else if (content.toLowerCase().includes('package')) {
    dealType = 'package_discount'
  } else if (content.toLowerCase().includes('passholder') || content.toLowerCase().includes('annual pass')) {
    dealType = 'passholder_exclusive'
  }
  
  // Extract resort name if mentioned
  const resortMatch = content.match(/Disney's\s+([A-Za-z\s&'-]+?)\s+Resort/i)
  const resortName = resortMatch ? `Disney's ${resortMatch[1]} Resort` : undefined
  
  return {
    title: title.substring(0, 200), // Limit title length
    description: content.substring(0, 500), // Limit description
    deal_type: dealType as any,
    discount_percentage: discount,
    valid_from: validFrom.toISOString().split('T')[0],
    valid_to: validTo.toISOString().split('T')[0],
    travel_valid_from: validFrom.toISOString().split('T')[0],
    travel_valid_to: validTo.toISOString().split('T')[0],
    source_url: link,
    resort_name: resortName
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
    
    // Get resort ID if resort name provided
    let resortId = null
    if (deal.resort_name) {
      const { data: resort } = await supabaseAdmin
        .from('resorts')
        .select('id')
        .ilike('name', `%${deal.resort_name}%`)
        .single()
      
      resortId = resort?.id || null
    }
    
    // Check if deal already exists (by title and source URL)
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
          resort_id: resortId,
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
          resort_id: resortId,
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
    const updateData: any = {
      last_checked_at: new Date().toISOString(),
    }
    
    if (success) {
      updateData.error_count = 0
      updateData.last_error = null
    } else {
      updateData.error_count = supabaseAdmin.raw('error_count + 1')
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

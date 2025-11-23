import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Javari Autonomous Deal Manager API
 * 
 * This endpoint allows Javari to:
 * - Learn from user behavior
 * - Generate recommendations
 * - Track decision patterns
 * - Improve over time
 */

// GET: Get Javari's current state and recommendations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    
    switch (action) {
      case 'recommendations':
        return await getRecommendations(request)
      
      case 'insights':
        return await getInsights(request)
      
      case 'metrics':
        return await getMetrics(request)
      
      case 'state':
        return await getJavariState(request)
      
      default:
        return await getDashboard(request)
    }
  } catch (error) {
    console.error('[Javari API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Record user actions for learning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'track_view':
        return await trackDealView(data)
      
      case 'track_action':
        return await trackUserAction(data)
      
      case 'provide_feedback':
        return await recordFeedback(data)
      
      case 'learn_preference':
        return await learnPreference(data)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Javari API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get personalized recommendations
async function getRecommendations(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '10')
  
  // Get all active deals
  const { data: deals, error } = await supabaseAdmin
    .from('deals')
    .select(`
      *,
      resort:resorts(*),
      score:deal_scores(*)
    `)
    .eq('is_active', true)
    .gte('valid_to', new Date().toISOString().split('T')[0])
    .order('priority', { ascending: false })
    .limit(50)
  
  if (error) {
    throw error
  }
  
  // Score and rank deals
  const scored_deals = await Promise.all(
    deals.map(async (deal) => {
      const recommendation = await supabaseAdmin
        .rpc('javari_generate_recommendation', { p_deal_id: deal.id })
      
      return {
        ...deal,
        javari_recommendation: recommendation.data
      }
    })
  )
  
  // Sort by recommendation quality
  const sorted = scored_deals.sort((a, b) => {
    const scoreA = a.javari_recommendation?.score || 0
    const scoreB = b.javari_recommendation?.score || 0
    return scoreB - scoreA
  })
  
  return NextResponse.json({
    recommendations: sorted.slice(0, limit),
    generated_at: new Date().toISOString()
  })
}

// Get proactive insights
async function getInsights(request: NextRequest) {
  const { data: insights, error } = await supabaseAdmin
    .from('javari_insights')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    throw error
  }
  
  return NextResponse.json({ insights })
}

// Get Javari performance metrics
async function getMetrics(request: NextRequest) {
  const { data: metrics, error } = await supabaseAdmin
    .from('javari_metrics')
    .select('*')
    .order('metric_date', { ascending: false })
    .limit(30)
  
  if (error) {
    throw error
  }
  
  // Calculate trends
  const latest = metrics[0]
  const previous = metrics[7] // Week ago
  
  const trends = {
    acceptance_rate_change: latest && previous 
      ? ((latest.acceptance_rate - previous.acceptance_rate) / previous.acceptance_rate * 100)
      : 0,
    accuracy_change: latest && previous
      ? ((latest.prediction_accuracy - previous.prediction_accuracy) / previous.prediction_accuracy * 100)
      : 0
  }
  
  return NextResponse.json({ metrics, trends })
}

// Get Javari's learned state
async function getJavariState(request: NextRequest) {
  const { data: state, error } = await supabaseAdmin
    .from('javari_state')
    .select('*')
    .single()
  
  if (error && error.code !== 'PGRST116') { // Not found is ok
    throw error
  }
  
  // Get pattern library
  const { data: patterns } = await supabaseAdmin
    .from('javari_pattern_library')
    .select('*')
    .eq('is_active', true)
    .order('confidence', { ascending: false })
  
  return NextResponse.json({
    state: state || {},
    patterns: patterns || [],
    learning_status: {
      patterns_discovered: patterns?.length || 0,
      average_confidence: patterns?.reduce((sum, p) => sum + (p.confidence || 0), 0) / (patterns?.length || 1),
      deals_analyzed: state?.deals_viewed || 0
    }
  })
}

// Get Javari dashboard summary
async function getDashboard(request: NextRequest) {
  const recommendations = await getRecommendations(request)
  const insights = await getInsights(request)
  const state = await getJavariState(request)
  
  return NextResponse.json({
    summary: {
      active_recommendations: (await recommendations.json()).recommendations.length,
      active_insights: (await insights.json()).insights.length,
      learning_progress: (await state.json()).learning_status
    }
  })
}

// Track when user views a deal
async function trackDealView(data: any) {
  const { deal_id, context } = data
  
  // Update Javari state
  await supabaseAdmin.rpc('increment', {
    table_name: 'javari_state',
    column_name: 'deals_viewed'
  })
  
  // Record in training data
  await supabaseAdmin
    .from('javari_training_data')
    .insert([{
      deal_id,
      user_context: context,
      user_action: 'viewed',
      action_timestamp: new Date().toISOString()
    }])
  
  return NextResponse.json({ success: true })
}

// Track user actions (book, save, dismiss)
async function trackUserAction(data: any) {
  const { deal_id, action, context, price_paid } = data
  
  // Record in training data
  const { data: training, error } = await supabaseAdmin
    .from('javari_training_data')
    .insert([{
      deal_id,
      user_context: context,
      user_action: action,
      action_timestamp: new Date().toISOString(),
      final_price_paid: price_paid
    }])
    .select()
    .single()
  
  if (error) {
    throw error
  }
  
  // Update Javari state counters
  if (action === 'booked') {
    await supabaseAdmin
      .from('javari_state')
      .update({ 
        deals_booked: supabaseAdmin.raw('deals_booked + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabaseAdmin.from('javari_state').select('id').single()).data?.id)
  } else if (action === 'saved') {
    await supabaseAdmin
      .from('javari_state')
      .update({ 
        deals_saved: supabaseAdmin.raw('deals_saved + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabaseAdmin.from('javari_state').select('id').single()).data?.id)
  }
  
  // Learn from this action
  await analyzeAndLearnFrom(training)
  
  return NextResponse.json({ success: true, learned: true })
}

// Record user feedback
async function recordFeedback(data: any) {
  const { recommendation_id, feedback, satisfaction_score } = data
  
  await supabaseAdmin
    .from('javari_recommendations')
    .update({
      user_feedback: feedback,
      updated_at: new Date().toISOString()
    })
    .eq('id', recommendation_id)
  
  // Update training data if linked
  if (satisfaction_score) {
    await supabaseAdmin
      .from('javari_training_data')
      .update({ user_satisfaction_score: satisfaction_score })
      .eq('deal_id', (await supabaseAdmin
        .from('javari_recommendations')
        .select('deal_id')
        .eq('id', recommendation_id)
        .single()).data?.deal_id)
  }
  
  return NextResponse.json({ success: true })
}

// Learn user preferences
async function learnPreference(data: any) {
  const { preference_type, preference_value } = data
  
  // Get or create Javari state
  let { data: state } = await supabaseAdmin
    .from('javari_state')
    .select('*')
    .single()
  
  if (!state) {
    // Create initial state
    const { data: newState } = await supabaseAdmin
      .from('javari_state')
      .insert([{}])
      .select()
      .single()
    
    state = newState
  }
  
  // Update preference
  const updates: any = {}
  
  switch (preference_type) {
    case 'resort_type':
      updates.preferred_resort_types = [...(state.preferred_resort_types || []), preference_value]
      break
    case 'deal_type':
      updates.preferred_deal_types = [...(state.preferred_deal_types || []), preference_value]
      break
    case 'budget':
      updates.max_budget_per_night = preference_value
      break
    case 'discount_threshold':
      updates.min_acceptable_discount = preference_value
      break
  }
  
  if (Object.keys(updates).length > 0) {
    await supabaseAdmin
      .from('javari_state')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', state.id)
  }
  
  return NextResponse.json({ success: true, learned: true })
}

// Analyze training data and discover patterns
async function analyzeAndLearnFrom(training: any) {
  // This would contain ML logic in production
  // For now, simple heuristics
  
  // Example: If user books high-discount deals, learn that preference
  if (training.user_action === 'booked') {
    const { data: deal } = await supabaseAdmin
      .from('deals')
      .select('discount_percentage')
      .eq('id', training.deal_id)
      .single()
    
    if (deal && deal.discount_percentage) {
      // Store pattern: User prefers deals with X% or higher
      await supabaseAdmin
        .from('javari_pattern_library')
        .insert([{
          pattern_type: 'discount_threshold',
          pattern_name: `High discount preference`,
          pattern_data: { min_discount: deal.discount_percentage },
          confidence: 75.0,
          observations_count: 1,
          description: `User tends to book deals with ${deal.discount_percentage}% or higher discounts`
        }])
        .onConflict('pattern_name')
        .merge({
          observations_count: supabaseAdmin.raw('observations_count + 1'),
          confidence: supabaseAdmin.raw('LEAST(confidence + 5, 95)'),
          last_observed_at: new Date().toISOString()
        })
    }
  }
}

import { supabaseAdmin } from '@/lib/supabase/server'
import { subYears, addDays, format, getMonth, getYear, differenceInDays } from 'date-fns'

/**
 * ML Deal Predictor
 * Analyzes historical patterns to predict:
 * - When deals will be announced
 * - Expected discount percentages
 * - Optimal booking windows
 * - Price trends
 */

interface PredictionResult {
  prediction_type: string
  confidence: number
  predicted_date?: string
  predicted_discount?: number
  reasoning: string
  supporting_data: any[]
}

export class DealPredictor {
  // Predict when a specific deal type will be announced
  static async predictDealAnnouncement(dealType: string): Promise<PredictionResult> {
    // Fetch historical data for this deal type
    const { data: historicalDeals } = await supabaseAdmin
      .from('deals')
      .select('*')
      .eq('deal_type', dealType)
      .gte('created_at', subYears(new Date(), 5).toISOString())
      .order('created_at', { ascending: true })
    
    if (!historicalDeals || historicalDeals.length < 3) {
      return {
        prediction_type: 'announcement',
        confidence: 0,
        reasoning: 'Insufficient historical data',
        supporting_data: []
      }
    }
    
    // Extract announcement dates
    const announcementDates = historicalDeals.map(deal => {
      const date = new Date(deal.created_at)
      return {
        year: getYear(date),
        month: getMonth(date) + 1, // 1-12
        day: date.getDate(),
        fullDate: date
      }
    })
    
    // Calculate average announcement month/day
    const avgMonth = Math.round(
      announcementDates.reduce((sum, d) => sum + d.month, 0) / announcementDates.length
    )
    
    const sameMonthDates = announcementDates.filter(d => d.month === avgMonth)
    const avgDay = sameMonthDates.length > 0
      ? Math.round(sameMonthDates.reduce((sum, d) => sum + d.day, 0) / sameMonthDates.length)
      : 15
    
    // Calculate confidence based on consistency
    const monthVariance = this.calculateVariance(announcementDates.map(d => d.month))
    const confidence = Math.max(0, Math.min(100, 100 - (monthVariance * 20)))
    
    // Predict next announcement
    const currentYear = getYear(new Date())
    const predictedDate = new Date(currentYear, avgMonth - 1, avgDay)
    
    // If date has passed, predict next year
    if (predictedDate < new Date()) {
      predictedDate.setFullYear(currentYear + 1)
    }
    
    return {
      prediction_type: 'announcement',
      confidence: Math.round(confidence),
      predicted_date: format(predictedDate, 'yyyy-MM-dd'),
      reasoning: `Based on ${historicalDeals.length} historical announcements, ${dealType} deals are typically announced in ${this.getMonthName(avgMonth)} (average day ${avgDay}). Pattern consistency: ${Math.round(confidence)}%`,
      supporting_data: announcementDates.map(d => ({
        year: d.year,
        announced: format(d.fullDate, 'yyyy-MM-dd')
      }))
    }
  }
  
  // Predict expected discount percentage for a resort
  static async predictDiscount(
    resortId: string,
    travelDate: Date
  ): Promise<PredictionResult> {
    const { data: historicalDeals } = await supabaseAdmin
      .from('deals')
      .select('*')
      .eq('resort_id', resortId)
      .gte('created_at', subYears(new Date(), 3).toISOString())
      .not('discount_percentage', 'is', null)
    
    if (!historicalDeals || historicalDeals.length < 5) {
      return {
        prediction_type: 'discount',
        confidence: 0,
        reasoning: 'Insufficient historical discount data',
        supporting_data: []
      }
    }
    
    // Group by season
    const travelMonth = getMonth(travelDate)
    const season = this.getSeason(travelMonth)
    
    // Filter deals for same season
    const seasonalDeals = historicalDeals.filter(deal => {
      const dealMonth = getMonth(new Date(deal.travel_valid_from))
      return this.getSeason(dealMonth) === season
    })
    
    if (seasonalDeals.length === 0) {
      return {
        prediction_type: 'discount',
        confidence: 20,
        predicted_discount: Math.round(
          historicalDeals.reduce((sum, d) => sum + (d.discount_percentage || 0), 0) / historicalDeals.length
        ),
        reasoning: 'Using average discount across all seasons (limited seasonal data)',
        supporting_data: []
      }
    }
    
    // Calculate statistics
    const discounts = seasonalDeals.map(d => d.discount_percentage!)
    const avgDiscount = discounts.reduce((sum, d) => sum + d, 0) / discounts.length
    const minDiscount = Math.min(...discounts)
    const maxDiscount = Math.max(...discounts)
    const variance = this.calculateVariance(discounts)
    
    // Confidence based on sample size and consistency
    const sampleSizeConfidence = Math.min(100, (seasonalDeals.length / 10) * 100)
    const consistencyConfidence = Math.max(0, 100 - (variance * 10))
    const confidence = (sampleSizeConfidence + consistencyConfidence) / 2
    
    return {
      prediction_type: 'discount',
      confidence: Math.round(confidence),
      predicted_discount: Math.round(avgDiscount),
      reasoning: `Based on ${seasonalDeals.length} ${season} deals over the past 3 years. Typical range: ${Math.round(minDiscount)}%-${Math.round(maxDiscount)}%. Average: ${Math.round(avgDiscount)}%`,
      supporting_data: seasonalDeals.map(d => ({
        year: getYear(new Date(d.created_at)),
        discount: d.discount_percentage,
        deal: d.title
      }))
    }
  }
  
  // Predict optimal booking window
  static async predictOptimalBookingWindow(
    resortType: string,
    travelDate: Date
  ): Promise<PredictionResult> {
    // Fetch all bookings with outcomes
    const { data: trainingData } = await supabaseAdmin
      .from('javari_training_data')
      .select(`
        *,
        deal:deals(*)
      `)
      .eq('user_action', 'booked')
    
    if (!trainingData || trainingData.length < 10) {
      return {
        prediction_type: 'booking_window',
        confidence: 50,
        reasoning: 'Using industry standard recommendation (insufficient personal data)',
        supporting_data: [{
          recommendation: 'Book 90-120 days in advance for best selection and pricing'
        }]
      }
    }
    
    // Calculate days between booking and travel
    const bookingWindows = trainingData
      .filter(t => t.deal?.resort?.resort_type === resortType)
      .map(t => {
        const bookingDate = new Date(t.action_timestamp)
        const travelDate = new Date(t.deal.travel_valid_from)
        return differenceInDays(travelDate, bookingDate)
      })
      .filter(days => days > 0 && days < 365) // Filter outliers
    
    if (bookingWindows.length === 0) {
      return {
        prediction_type: 'booking_window',
        confidence: 50,
        reasoning: 'No historical bookings for this resort type',
        supporting_data: []
      }
    }
    
    // Calculate average booking window
    const avgWindow = Math.round(
      bookingWindows.reduce((sum, w) => sum + w, 0) / bookingWindows.length
    )
    
    const variance = this.calculateVariance(bookingWindows)
    const confidence = Math.max(40, Math.min(95, 100 - (variance / 10)))
    
    // Calculate optimal booking date
    const optimalBookingDate = addDays(travelDate, -avgWindow)
    
    return {
      prediction_type: 'booking_window',
      confidence: Math.round(confidence),
      predicted_date: format(optimalBookingDate, 'yyyy-MM-dd'),
      reasoning: `Based on your ${bookingWindows.length} past bookings for ${resortType} resorts, you typically book ${avgWindow} days in advance. This gives you the best balance of selection and pricing.`,
      supporting_data: [{
        average_window: avgWindow,
        earliest: Math.min(...bookingWindows),
        latest: Math.max(...bookingWindows),
        sample_size: bookingWindows.length
      }]
    }
  }
  
  // Predict price trends
  static async predictPriceTrend(
    resortId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PredictionResult> {
    const { data: priceHistory } = await supabaseAdmin
      .from('price_snapshots')
      .select('*')
      .eq('resort_id', resortId)
      .gte('check_in_date', subYears(startDate, 2).toISOString())
      .lte('check_in_date', startDate.toISOString())
      .order('check_in_date', { ascending: true })
    
    if (!priceHistory || priceHistory.length < 20) {
      return {
        prediction_type: 'price_trend',
        confidence: 30,
        reasoning: 'Insufficient price history for accurate prediction',
        supporting_data: []
      }
    }
    
    // Calculate moving averages
    const prices = priceHistory.map(p => p.price_per_night)
    const recentPrices = prices.slice(-10)
    const olderPrices = prices.slice(-30, -10)
    
    const recentAvg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length
    const olderAvg = olderPrices.reduce((sum, p) => sum + p, 0) / olderPrices.length
    
    // Calculate trend
    const trendPercentage = ((recentAvg - olderAvg) / olderAvg) * 100
    
    let trendDirection = 'stable'
    if (trendPercentage < -5) trendDirection = 'decreasing'
    if (trendPercentage > 5) trendDirection = 'increasing'
    
    // Predict future price
    const predictedPrice = Math.round(recentAvg * (1 + (trendPercentage / 100)))
    
    return {
      prediction_type: 'price_trend',
      confidence: 75,
      predicted_discount: predictedPrice,
      reasoning: `Prices are ${trendDirection} (${trendPercentage > 0 ? '+' : ''}${trendPercentage.toFixed(1)}%). Recent average: $${Math.round(recentAvg)}, predicted: $${predictedPrice}`,
      supporting_data: [{
        trend: trendDirection,
        trend_percentage: Math.round(trendPercentage * 10) / 10,
        recent_average: Math.round(recentAvg),
        historical_average: Math.round(olderAvg),
        sample_size: prices.length
      }]
    }
  }
  
  // Helper: Calculate variance
  private static calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length)
  }
  
  // Helper: Get season
  private static getSeason(month: number): string {
    if (month >= 3 && month <= 5) return 'spring'
    if (month >= 6 && month <= 8) return 'summer'
    if (month >= 9 && month <= 11) return 'fall'
    return 'winter'
  }
  
  // Helper: Get month name
  private static getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    return months[month - 1]
  }
}

// Export for API use
export default DealPredictor

import { supabaseAdmin } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

interface PriceDropAlert {
  alert_id: string
  deal_id: string
  deal_title: string
  old_price: number
  new_price: number
  savings: number
  savings_percentage: number
}

export async function checkPriceDropAlerts() {
  console.log('[Price Alerts] Checking for price drops...')
  
  try {
    // Get all active alerts
    const { data: alerts, error } = await supabaseAdmin
      .from('user_alerts')
      .select('*')
      .eq('is_active', true)
      .eq('alert_type', 'price_drop')
    
    if (error) throw error
    
    const alertsTriggered: PriceDropAlert[] = []
    
    for (const alert of alerts || []) {
      // Find matching deals
      const { data: deals } = await supabaseAdmin
        .from('deals')
        .select(`
          *,
          resort:resorts(*)
        `)
        .eq('is_active', true)
        .gte('deal_price', 0)
        .order('deal_price', { ascending: true })
      
      if (!deals) continue
      
      for (const deal of deals) {
        // Check if deal matches alert criteria
        if (!matchesAlertCriteria(deal, alert)) continue
        
        // Check if price dropped
        const priceHistory = await getPriceHistory(deal.id)
        if (!priceHistory || priceHistory.length < 2) continue
        
        const previousPrice = priceHistory[priceHistory.length - 2].deal_price
        const currentPrice = deal.deal_price
        
        if (currentPrice < previousPrice) {
          const savings = previousPrice - currentPrice
          const savingsPercentage = (savings / previousPrice) * 100
          
          // Only alert if significant drop (>5% or >$50)
          if (savingsPercentage >= 5 || savings >= 50) {
            alertsTriggered.push({
              alert_id: alert.id,
              deal_id: deal.id,
              deal_title: deal.title,
              old_price: previousPrice,
              new_price: currentPrice,
              savings,
              savings_percentage: savingsPercentage
            })
            
            // Send notification
            await sendPriceDropNotification(alert, deal, savings, savingsPercentage)
            
            // Log alert match
            await supabaseAdmin
              .from('alert_matches')
              .insert([{
                alert_id: alert.id,
                deal_id: deal.id,
                match_score: Math.min(100, Math.floor(savingsPercentage * 2)),
                was_notified: true,
                notified_at: new Date().toISOString()
              }])
          }
        }
      }
    }
    
    console.log(`[Price Alerts] ${alertsTriggered.length} alerts triggered`)
    return { success: true, alertsTriggered: alertsTriggered.length }
    
  } catch (error) {
    console.error('[Price Alerts] Error:', error)
    return { success: false, error }
  }
}

function matchesAlertCriteria(deal: any, alert: any): boolean {
  // Date range check
  if (alert.target_check_in_date && alert.target_check_out_date) {
    const dealStart = new Date(deal.travel_valid_from)
    const dealEnd = new Date(deal.travel_valid_to)
    const alertStart = new Date(alert.target_check_in_date)
    const alertEnd = new Date(alert.target_check_out_date)
    
    // Check if dates overlap
    if (dealEnd < alertStart || dealStart > alertEnd) {
      return false
    }
  }
  
  // Resort type check
  if (alert.resort_types && alert.resort_types.length > 0) {
    if (!alert.resort_types.includes(deal.resort?.resort_type)) {
      return false
    }
  }
  
  // Discount check
  if (alert.min_discount_percentage) {
    if (!deal.discount_percentage || deal.discount_percentage < alert.min_discount_percentage) {
      return false
    }
  }
  
  // Price check
  if (alert.max_price_per_night) {
    const pricePerNight = deal.deal_price || deal.original_price
    if (pricePerNight > alert.max_price_per_night) {
      return false
    }
  }
  
  return true
}

async function getPriceHistory(dealId: string) {
  const { data } = await supabaseAdmin
    .from('price_snapshots')
    .select('deal_price, snapshot_date')
    .eq('deal_id', dealId)
    .order('snapshot_date', { ascending: true })
  
  return data
}

async function sendPriceDropNotification(
  alert: any,
  deal: any,
  savings: number,
  savingsPercentage: number
) {
  const channels = alert.notification_channels || ['email']
  
  for (const channel of channels) {
    if (channel === 'email') {
      await sendEmailNotification(alert, deal, savings, savingsPercentage)
    } else if (channel === 'sms') {
      await sendSMSNotification(alert, deal, savings, savingsPercentage)
    }
  }
  
  // Update alert last notified
  await supabaseAdmin
    .from('user_alerts')
    .update({
      last_notified_at: new Date().toISOString()
    })
    .eq('id', alert.id)
}

async function sendEmailNotification(
  alert: any,
  deal: any,
  savings: number,
  savingsPercentage: number
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('[Email] SMTP not configured, skipping email')
    return
  }
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
  
  const emailContent = `
    <h2>🎉 Price Drop Alert!</h2>
    <p><strong>${deal.title}</strong></p>
    
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="font-size: 24px; margin: 0; color: #0369a1;">
        Save $${savings.toFixed(2)} (${savingsPercentage.toFixed(1)}% off)
      </p>
    </div>
    
    <p><strong>New Price:</strong> $${deal.deal_price}/night</p>
    <p><strong>Was:</strong> <s>$${(deal.deal_price + savings).toFixed(2)}/night</s></p>
    
    ${deal.resort ? `<p><strong>Resort:</strong> ${deal.resort.name}</p>` : ''}
    ${deal.deal_code ? `<p><strong>Promo Code:</strong> ${deal.deal_code}</p>` : ''}
    
    <p><strong>Valid:</strong> ${deal.travel_valid_from} to ${deal.travel_valid_to}</p>
    
    <p style="margin-top: 30px;">
      <a href="${deal.source_url}" style="background: #0063B2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Book Now
      </a>
    </p>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      This deal matches your alert: ${alert.alert_name}
    </p>
  `
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: `🎉 Price Drop: Save $${savings.toFixed(2)} on ${deal.title}`,
      html: emailContent,
    })
    
    console.log(`[Email] Sent price drop alert for deal ${deal.id}`)
    
    // Log notification
    await supabaseAdmin
      .from('alert_notifications')
      .insert([{
        alert_id: alert.id,
        deal_id: deal.id,
        notification_type: 'email',
        subject: `Price Drop: Save $${savings.toFixed(2)}`,
        message: emailContent,
        status: 'sent'
      }])
      
  } catch (error) {
    console.error('[Email] Error sending:', error)
    
    // Log failed notification
    await supabaseAdmin
      .from('alert_notifications')
      .insert([{
        alert_id: alert.id,
        deal_id: deal.id,
        notification_type: 'email',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }])
  }
}

async function sendSMSNotification(
  alert: any,
  deal: any,
  savings: number,
  savingsPercentage: number
) {
  // SMS implementation would go here (Twilio, AWS SNS, etc.)
  console.log(`[SMS] Would send SMS for deal ${deal.id} (not implemented)`)
  
  // For now, just log it
  await supabaseAdmin
    .from('alert_notifications')
    .insert([{
      alert_id: alert.id,
      deal_id: deal.id,
      notification_type: 'sms',
      message: `🎉 Disney Deal Alert: Save $${savings.toFixed(2)} (${savingsPercentage.toFixed(1)}% off) on ${deal.title}. Book now!`,
      status: 'pending'
    }])
}

// Export for use in cron job
export default checkPriceDropAlerts

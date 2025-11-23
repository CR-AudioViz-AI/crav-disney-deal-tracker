import { supabaseAdmin } from '@/lib/supabase/server'
import { addDays, format, isBefore, differenceInDays } from 'date-fns'
import nodemailer from 'nodemailer'

/**
 * Booking Reminders System
 * Automatically reminds users of:
 * - Booking deadlines
 * - Final payment due dates
 * - Deal expiration warnings
 * - Optimal booking windows
 */

export async function checkBookingReminders() {
  console.log('[Booking Reminders] Checking reminders...')
  
  try {
    const now = new Date()
    
    // Get all active reminders that are due
    const { data: reminders, error } = await supabaseAdmin
      .from('booking_reminders')
      .select(`
        *,
        deal:deals(*)
      `)
      .eq('is_active', true)
      .eq('notification_sent', false)
      .lte('remind_at', now.toISOString())
    
    if (error) throw error
    
    for (const reminder of reminders || []) {
      await sendReminder(reminder)
      
      // Mark as sent
      await supabaseAdmin
        .from('booking_reminders')
        .update({
          reminded_at: now.toISOString(),
          notification_sent: true
        })
        .eq('id', reminder.id)
    }
    
    // Auto-create new reminders from active deals
    await createAutoReminders()
    
    console.log(`[Booking Reminders] Processed ${reminders?.length || 0} reminders`)
    return { success: true, count: reminders?.length || 0 }
    
  } catch (error) {
    console.error('[Booking Reminders] Error:', error)
    return { success: false, error }
  }
}

async function sendReminder(reminder: any) {
  const { deal } = reminder
  
  let emailContent = ''
  let subject = ''
  
  switch (reminder.reminder_type) {
    case 'booking_deadline':
      subject = `⏰ Booking Deadline: ${deal.title}`
      emailContent = `
        <h2>⏰ Booking Deadline Approaching!</h2>
        <p><strong>${deal.title}</strong></p>
        
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;">
            <strong>Book by: ${format(new Date(deal.booking_deadline), 'MMMM d, yyyy')}</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #92400E;">
            Only ${differenceInDays(new Date(deal.booking_deadline), new Date())} days left!
          </p>
        </div>
        
        ${deal.discount_percentage ? `<p><strong>Discount:</strong> ${deal.discount_percentage}% off</p>` : ''}
        ${deal.deal_code ? `<p><strong>Promo Code:</strong> <code style="background: #F3F4F6; padding: 4px 8px; border-radius: 4px;">${deal.deal_code}</code></p>` : ''}
        
        <p><strong>Valid Travel Dates:</strong> ${deal.travel_valid_from} to ${deal.travel_valid_to}</p>
        
        <p style="margin-top: 30px;">
          <a href="${deal.source_url}" style="background: #0063B2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Book Now
          </a>
        </p>
      `
      break
      
    case 'payment_due':
      subject = `💳 Payment Due: ${deal.title}`
      emailContent = `
        <h2>💳 Final Payment Due Soon</h2>
        <p>Your final payment is due for:</p>
        <p><strong>${deal.title}</strong></p>
        
        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #991B1B;">
            <strong>Payment due: ${reminder.message}</strong>
          </p>
        </div>
        
        <p>Make sure to submit your payment before the deadline to keep your reservation!</p>
      `
      break
      
    case 'deal_expiring':
      subject = `⚠️ Deal Expiring: ${deal.title}`
      emailContent = `
        <h2>⚠️ Deal Expiring Soon!</h2>
        <p><strong>${deal.title}</strong></p>
        
        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #991B1B;">
            This deal expires on ${format(new Date(deal.valid_to), 'MMMM d, yyyy')}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #991B1B;">
            Only ${differenceInDays(new Date(deal.valid_to), new Date())} days left to book!
          </p>
        </div>
        
        ${deal.discount_percentage ? `<p><strong>Save ${deal.discount_percentage}% on your stay!</strong></p>` : ''}
        
        <p style="margin-top: 30px;">
          <a href="${deal.source_url}" style="background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Book Before It's Gone
          </a>
        </p>
      `
      break
  }
  
  // Send email
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject,
      html: emailContent,
    })
    
    console.log(`[Booking Reminders] Sent: ${subject}`)
  }
}

// Auto-create reminders for deals with deadlines
async function createAutoReminders() {
  const { data: deals } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('is_active', true)
    .not('booking_deadline', 'is', null)
  
  if (!deals) return
  
  for (const deal of deals) {
    const deadline = new Date(deal.booking_deadline)
    const now = new Date()
    
    // Check if reminder already exists
    const { data: existing } = await supabaseAdmin
      .from('booking_reminders')
      .select('id')
      .eq('deal_id', deal.id)
      .eq('reminder_type', 'booking_deadline')
      .single()
    
    if (existing) continue
    
    // Create reminders at different intervals
    const reminders = []
    
    // 7 days before
    const sevenDaysBefore = addDays(deadline, -7)
    if (isBefore(now, sevenDaysBefore)) {
      reminders.push({
        deal_id: deal.id,
        reminder_type: 'booking_deadline',
        title: `Book ${deal.title} - 7 days left`,
        message: `Booking deadline in 7 days: ${format(deadline, 'MMMM d, yyyy')}`,
        remind_at: sevenDaysBefore.toISOString()
      })
    }
    
    // 3 days before
    const threeDaysBefore = addDays(deadline, -3)
    if (isBefore(now, threeDaysBefore)) {
      reminders.push({
        deal_id: deal.id,
        reminder_type: 'booking_deadline',
        title: `Book ${deal.title} - 3 days left`,
        message: `Booking deadline in 3 days: ${format(deadline, 'MMMM d, yyyy')}`,
        remind_at: threeDaysBefore.toISOString()
      })
    }
    
    // 1 day before
    const oneDayBefore = addDays(deadline, -1)
    if (isBefore(now, oneDayBefore)) {
      reminders.push({
        deal_id: deal.id,
        reminder_type: 'booking_deadline',
        title: `URGENT: Book ${deal.title} - Last Day!`,
        message: `Booking deadline tomorrow: ${format(deadline, 'MMMM d, yyyy')}`,
        remind_at: oneDayBefore.toISOString()
      })
    }
    
    if (reminders.length > 0) {
      await supabaseAdmin
        .from('booking_reminders')
        .insert(reminders)
    }
  }
}

// API endpoint to manually create reminder
export async function createReminder(data: {
  deal_id: string
  reminder_type: string
  title: string
  message: string
  remind_at: string
}) {
  const { data: reminder, error } = await supabaseAdmin
    .from('booking_reminders')
    .insert([data])
    .select()
    .single()
  
  if (error) throw error
  
  return reminder
}

export default checkBookingReminders

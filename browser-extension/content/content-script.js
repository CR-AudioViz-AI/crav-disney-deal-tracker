// Disney Deal Tracker - Content Script
// Runs on Disney.com to inject deal information and auto-apply codes

const API_BASE = 'https://crav-disney-deal-tracker.vercel.app/api'

// Initialize extension
async function init() {
  console.log('[Disney Deal Tracker] Extension loaded')
  
  // Check what page we're on
  const url = window.location.href
  
  if (url.includes('/resorts/')) {
    await handleResortPage()
  } else if (url.includes('/booking') || url.includes('/cart')) {
    await handleBookingPage()
  }
  
  // Add persistent price tracker button
  addPriceTrackerButton()
}

// Handle resort detail pages
async function handleResortPage() {
  const resortName = extractResortName()
  if (!resortName) return
  
  console.log('[Disney Deal Tracker] Resort page detected:', resortName)
  
  // Fetch deals for this resort
  const deals = await fetchDealsForResort(resortName)
  
  if (deals && deals.length > 0) {
    injectDealOverlay(deals)
    showNotification(`${deals.length} deal(s) available for ${resortName}!`)
  }
}

// Handle booking/checkout pages
async function handleBookingPage() {
  console.log('[Disney Deal Tracker] Booking page detected')
  
  // Look for promo code field
  const promoField = findPromoCodeField()
  
  if (promoField) {
    // Fetch best available code
    const bestCode = await fetchBestPromoCode()
    
    if (bestCode) {
      // Auto-apply code
      autoApplyPromoCode(promoField, bestCode)
    }
  }
  
  // Show price history for selected dates
  const dates = extractBookingDates()
  if (dates) {
    await showPriceHistory(dates)
  }
}

// Extract resort name from page
function extractResortName() {
  // Try multiple selectors
  const selectors = [
    'h1.resort-name',
    '[data-resort-name]',
    'h1',
    '.title'
  ]
  
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element && element.textContent) {
      return element.textContent.trim()
    }
  }
  
  // Fallback: extract from URL
  const match = window.location.pathname.match(/resorts\/([^\/]+)/)
  return match ? match[1].replace(/-/g, ' ') : null
}

// Fetch deals from API
async function fetchDealsForResort(resortName) {
  try {
    const response = await fetch(`${API_BASE}/deals?resort_name=${encodeURIComponent(resortName)}`)
    if (!response.ok) return null
    
    const data = await response.json()
    return data.deals || []
  } catch (error) {
    console.error('[Disney Deal Tracker] Error fetching deals:', error)
    return null
  }
}

// Inject deal overlay on page
function injectDealOverlay(deals) {
  // Remove existing overlay if present
  const existing = document.getElementById('disney-deal-overlay')
  if (existing) existing.remove()
  
  const overlay = document.createElement('div')
  overlay.id = 'disney-deal-overlay'
  overlay.className = 'disney-deal-overlay'
  
  // Sort by Javari score
  deals.sort((a, b) => (b.javari_score || 0) - (a.javari_score || 0))
  const bestDeal = deals[0]
  
  overlay.innerHTML = `
    <div class="deal-card">
      <div class="deal-header">
        <div class="deal-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          BEST DEAL
        </div>
        <button class="close-btn" onclick="document.getElementById('disney-deal-overlay').remove()">×</button>
      </div>
      
      <h3 class="deal-title">${bestDeal.title}</h3>
      
      ${bestDeal.discount_percentage ? `
        <div class="discount-badge">
          ${bestDeal.discount_percentage}% OFF
        </div>
      ` : ''}
      
      <div class="deal-details">
        ${bestDeal.deal_code ? `
          <div class="promo-code">
            <span class="label">Promo Code:</span>
            <code class="code">${bestDeal.deal_code}</code>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${bestDeal.deal_code}'); this.textContent='Copied!'">
              Copy
            </button>
          </div>
        ` : ''}
        
        <div class="deal-info">
          <p><strong>Valid:</strong> ${bestDeal.travel_valid_from} to ${bestDeal.travel_valid_to}</p>
          ${bestDeal.booking_deadline ? `
            <p><strong>Book by:</strong> ${bestDeal.booking_deadline}</p>
          ` : ''}
        </div>
        
        ${bestDeal.javari_score ? `
          <div class="javari-score">
            <span class="label">Javari Score:</span>
            <div class="score ${getScoreClass(bestDeal.javari_score)}">
              ${bestDeal.javari_score}/100
            </div>
          </div>
        ` : ''}
      </div>
      
      ${deals.length > 1 ? `
        <button class="view-all-btn" onclick="window.open('${API_BASE}/deals?resort=${encodeURIComponent(bestDeal.resort?.name)}', '_blank')">
          View All ${deals.length} Deals
        </button>
      ` : ''}
    </div>
  `
  
  document.body.appendChild(overlay)
  
  // Animate in
  setTimeout(() => overlay.classList.add('show'), 10)
}

// Find promo code input field
function findPromoCodeField() {
  const selectors = [
    'input[name*="promo"]',
    'input[name*="code"]',
    'input[placeholder*="promo"]',
    'input[placeholder*="code"]',
    '#promoCode',
    '#promotionCode'
  ]
  
  for (const selector of selectors) {
    const field = document.querySelector(selector)
    if (field) return field
  }
  
  return null
}

// Fetch best promo code for current context
async function fetchBestPromoCode() {
  try {
    const dates = extractBookingDates()
    const resort = extractResortName()
    
    const params = new URLSearchParams()
    if (dates?.checkIn) params.append('check_in', dates.checkIn)
    if (dates?.checkOut) params.append('check_out', dates.checkOut)
    if (resort) params.append('resort', resort)
    
    const response = await fetch(`${API_BASE}/deals/best-code?${params}`)
    if (!response.ok) return null
    
    const data = await response.json()
    return data.code
  } catch (error) {
    console.error('[Disney Deal Tracker] Error fetching promo code:', error)
    return null
  }
}

// Auto-apply promo code
function autoApplyPromoCode(field, code) {
  // Fill the field
  field.value = code
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
  
  // Highlight the field
  field.style.border = '2px solid #10B981'
  field.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)'
  
  // Show success message
  showNotification(`Promo code ${code} applied automatically!`, 'success')
  
  // Look for apply button and click it
  const applyButton = findApplyButton(field)
  if (applyButton) {
    setTimeout(() => applyButton.click(), 500)
  }
}

// Find apply button near promo field
function findApplyButton(promoField) {
  const parent = promoField.parentElement
  if (!parent) return null
  
  const buttons = parent.querySelectorAll('button, input[type="submit"]')
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || button.value?.toLowerCase() || ''
    if (text.includes('apply') || text.includes('submit')) {
      return button
    }
  }
  
  return null
}

// Extract booking dates from page
function extractBookingDates() {
  // Try to find date inputs
  const checkInSelectors = ['input[name*="checkIn"]', 'input[name*="arrival"]', '[data-check-in]']
  const checkOutSelectors = ['input[name*="checkOut"]', 'input[name*="departure"]', '[data-check-out]']
  
  let checkIn = null
  let checkOut = null
  
  for (const selector of checkInSelectors) {
    const field = document.querySelector(selector)
    if (field && field.value) {
      checkIn = field.value
      break
    }
  }
  
  for (const selector of checkOutSelectors) {
    const field = document.querySelector(selector)
    if (field && field.value) {
      checkOut = field.value
      break
    }
  }
  
  return checkIn && checkOut ? { checkIn, checkOut } : null
}

// Show price history overlay
async function showPriceHistory(dates) {
  try {
    const resort = extractResortName()
    if (!resort) return
    
    const response = await fetch(`${API_BASE}/price-history?resort=${encodeURIComponent(resort)}&check_in=${dates.checkIn}&check_out=${dates.checkOut}`)
    if (!response.ok) return
    
    const data = await response.json()
    
    // Inject price history indicator
    injectPriceHistoryBadge(data)
  } catch (error) {
    console.error('[Disney Deal Tracker] Error fetching price history:', error)
  }
}

// Inject price history badge
function injectPriceHistoryBadge(data) {
  const badge = document.createElement('div')
  badge.className = 'price-history-badge'
  badge.innerHTML = `
    <div class="badge-content">
      <div class="badge-title">Price Trend</div>
      <div class="badge-value ${data.trend < 0 ? 'good' : 'bad'}">
        ${data.trend > 0 ? '+' : ''}${data.trend}%
      </div>
      <div class="badge-subtitle">vs 12-month average</div>
    </div>
  `
  
  // Find price display and add badge near it
  const priceElement = document.querySelector('.price, [class*="price"]')
  if (priceElement) {
    priceElement.appendChild(badge)
  }
}

// Add persistent price tracker button
function addPriceTrackerButton() {
  const button = document.createElement('button')
  button.id = 'disney-deal-tracker-btn'
  button.className = 'tracker-btn'
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  `
  button.title = 'Disney Deal Tracker'
  button.onclick = () => {
    window.open('https://crav-disney-deal-tracker.vercel.app', '_blank')
  }
  
  document.body.appendChild(button)
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div')
  notification.className = `deal-notification ${type}`
  notification.textContent = message
  
  document.body.appendChild(notification)
  
  setTimeout(() => notification.classList.add('show'), 10)
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 300)
  }, 5000)
}

// Utility: Get score class
function getScoreClass(score) {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'great'
  if (score >= 50) return 'good'
  return 'fair'
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Track user actions for Javari learning
function trackAction(action, data) {
  fetch(`${API_BASE}/javari`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'track_action',
      data: {
        action,
        context: {
          url: window.location.href,
          resort: extractResortName(),
          dates: extractBookingDates()
        },
        ...data
      }
    })
  }).catch(err => console.error('Tracking error:', err))
}

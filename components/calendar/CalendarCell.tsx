'use client'

import { format, isSameDay } from 'date-fns'
import type { DealCalendarDay } from '@/lib/types/database'
import { TrendingDown, Gift, Star } from 'lucide-react'
import { clsx } from 'clsx'

interface CalendarCellProps {
  day: DealCalendarDay
  isCurrentMonth: boolean
  isToday: boolean
  onClick: () => void
}

export function CalendarCell({ day, isCurrentMonth, isToday, onClick }: CalendarCellProps) {
  const hasDeals = day.dealCount > 0
  
  // Determine background color based on deal quality
  const getQualityColor = () => {
    if (!hasDeals) return 'bg-white'
    switch (day.dealQuality) {
      case 'excellent':
        return 'bg-gradient-to-br from-red-50 to-red-100/50'
      case 'great':
        return 'bg-gradient-to-br from-orange-50 to-orange-100/50'
      case 'good':
        return 'bg-gradient-to-br from-yellow-50 to-yellow-100/50'
      case 'standard':
        return 'bg-gradient-to-br from-green-50 to-green-100/50'
      default:
        return 'bg-white'
    }
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'calendar-cell min-h-[100px] md:min-h-[120px] p-2',
        getQualityColor(),
        !isCurrentMonth && 'opacity-40',
        isToday && 'ring-2 ring-disney-blue ring-inset',
        hasDeals && 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200',
        !hasDeals && 'cursor-default'
      )}
    >
      {/* Date Number */}
      <div className="flex items-start justify-between mb-1">
        <span className={clsx(
          'text-sm font-semibold',
          isToday ? 'text-disney-blue' : 'text-gray-700',
          !isCurrentMonth && 'text-gray-400'
        )}>
          {format(day.date, 'd')}
        </span>
        
        {isToday && (
          <span className="text-xs bg-disney-blue text-white px-1.5 py-0.5 rounded">
            Today
          </span>
        )}
      </div>

      {/* Deal Information */}
      {hasDeals ? (
        <div className="space-y-1">
          {/* Deal Count Badge */}
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-gray-600" />
            <span className="text-xs font-bold text-gray-900">
              {day.dealCount} {day.dealCount === 1 ? 'deal' : 'deals'}
            </span>
          </div>

          {/* Best Discount */}
          {day.bestDiscount && day.bestDiscount > 0 && (
            <div className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded inline-block',
              day.dealQuality === 'excellent' && 'bg-deal-excellent/20 text-deal-excellent',
              day.dealQuality === 'great' && 'bg-deal-great/20 text-deal-great',
              day.dealQuality === 'good' && 'bg-deal-good/20 text-deal-good',
              day.dealQuality === 'standard' && 'bg-deal-standard/20 text-deal-standard'
            )}>
              {day.bestDiscount.toFixed(0)}% off
            </div>
          )}

          {/* Deal Type Icons (show top 3 types) */}
          <div className="flex items-center gap-1 mt-1">
            {day.deals.slice(0, 3).map((deal, idx) => (
              <DealTypeIcon key={idx} dealType={deal.deal_type} />
            ))}
            {day.deals.length > 3 && (
              <span className="text-xs text-gray-500">+{day.deals.length - 3}</span>
            )}
          </div>

          {/* Quality Indicator Dot */}
          <div className="absolute bottom-2 right-2">
            <span className={clsx(
              'deal-quality-dot',
              `deal-quality-${day.dealQuality}`
            )}></span>
          </div>
        </div>
      ) : (
        <div className="text-center mt-4">
          <span className="text-xs text-gray-400">No deals</span>
        </div>
      )}
    </div>
  )
}

// Deal Type Icon Component
function DealTypeIcon({ dealType }: { dealType: string }) {
  const iconClass = "h-3 w-3"
  
  switch (dealType) {
    case 'free_dining':
      return <Gift className={`${iconClass} text-purple-600`} title="Free Dining" />
    case 'room_upgrade':
      return <Star className={`${iconClass} text-blue-600`} title="Room Upgrade" />
    case 'room_discount':
      return <TrendingDown className={`${iconClass} text-red-600`} title="Room Discount" />
    case 'passholder_exclusive':
      return <Star className={`${iconClass} text-yellow-600`} title="Passholder" />
    default:
      return <TrendingDown className={`${iconClass} text-gray-600`} />
  }
}

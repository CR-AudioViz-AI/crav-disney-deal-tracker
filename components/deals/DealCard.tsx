'use client'

import { format } from 'date-fns'
import { ExternalLink, Calendar, Tag, Hotel, Ticket, Users, Clock } from 'lucide-react'
import type { DealWithResort } from '@/lib/types/database'
import { clsx } from 'clsx'

interface DealCardProps {
  deal: DealWithResort
}

export function DealCard({ deal }: DealCardProps) {
  const resortTypeColors = {
    value: 'bg-green-50 text-green-700 border-green-200',
    moderate: 'bg-blue-50 text-blue-700 border-blue-200',
    deluxe: 'bg-purple-50 text-purple-700 border-purple-200',
    villa: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    partner: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  const dealTypeLabels = {
    room_discount: 'Room Discount',
    free_dining: 'Free Dining',
    room_upgrade: 'Room Upgrade',
    package_discount: 'Package Discount',
    free_nights: 'Free Nights',
    passholder_exclusive: 'Passholder Exclusive',
    other: 'Special Offer',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 mb-1">
            {deal.title}
          </h4>
          {deal.resort && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Hotel className="h-4 w-4" />
              <span>{deal.resort.name}</span>
              <span className={clsx(
                'px-2 py-0.5 text-xs font-medium rounded border capitalize',
                resortTypeColors[deal.resort.resort_type]
              )}>
                {deal.resort.resort_type}
              </span>
            </div>
          )}
        </div>

        {/* Discount Badge */}
        {deal.discount_percentage && deal.discount_percentage > 0 && (
          <div className="flex-shrink-0">
            <div className={clsx(
              'px-3 py-2 rounded-lg text-center',
              deal.discount_percentage >= 30 && 'bg-deal-excellent/10 border border-deal-excellent/20',
              deal.discount_percentage >= 20 && deal.discount_percentage < 30 && 'bg-deal-great/10 border border-deal-great/20',
              deal.discount_percentage >= 10 && deal.discount_percentage < 20 && 'bg-deal-good/10 border border-deal-good/20',
              deal.discount_percentage < 10 && 'bg-deal-standard/10 border border-deal-standard/20'
            )}>
              <div className={clsx(
                'text-2xl font-bold',
                deal.discount_percentage >= 30 && 'text-deal-excellent',
                deal.discount_percentage >= 20 && deal.discount_percentage < 30 && 'text-deal-great',
                deal.discount_percentage >= 10 && deal.discount_percentage < 20 && 'text-deal-good',
                deal.discount_percentage < 10 && 'text-deal-standard'
              )}>
                {deal.discount_percentage.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-600">off</div>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {deal.description && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
          {deal.description}
        </p>
      )}

      {/* Deal Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        {/* Deal Type */}
        <div className="flex items-center gap-2 text-gray-600">
          <Tag className="h-4 w-4" />
          <span>{dealTypeLabels[deal.deal_type]}</span>
        </div>

        {/* Travel Dates */}
        {deal.travel_valid_from && deal.travel_valid_to && (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(deal.travel_valid_from), 'MMM d')} - {format(new Date(deal.travel_valid_to), 'MMM d')}
            </span>
          </div>
        )}

        {/* Minimum Nights */}
        {deal.minimum_nights && (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{deal.minimum_nights}+ nights</span>
          </div>
        )}

        {/* Booking Deadline */}
        {deal.booking_deadline && (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Book by {format(new Date(deal.booking_deadline), 'MMM d')}</span>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-2 mb-3">
        {deal.dining_plan_included && (
          <span className="deal-badge deal-badge-perk">
            Free Dining
          </span>
        )}
        {deal.ticket_required && (
          <span className="deal-badge bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/20">
            <Ticket className="h-3 w-3 inline mr-1" />
            Tickets Required
          </span>
        )}
        {deal.deal_code && (
          <span className="deal-badge bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-700/20">
            Code: {deal.deal_code}
          </span>
        )}
      </div>

      {/* Pricing */}
      {(deal.original_price || deal.deal_price) && (
        <div className="flex items-baseline gap-2 mb-3">
          {deal.original_price && (
            <span className="text-sm text-gray-500 line-through">
              ${deal.original_price.toFixed(2)}
            </span>
          )}
          {deal.deal_price && (
            <span className="text-xl font-bold text-disney-blue">
              ${deal.deal_price.toFixed(2)}
            </span>
          )}
          {deal.discount_amount && (
            <span className="text-sm text-green-600 font-medium">
              Save ${deal.discount_amount.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Valid: {format(new Date(deal.valid_from), 'MMM d')} - {format(new Date(deal.valid_to), 'MMM d, yyyy')}
        </div>
        <a
          href={deal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-4 py-2 bg-disney-blue text-white text-sm font-medium rounded-lg hover:bg-disney-darkblue transition-colors"
        >
          View Deal
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}

'use client'

import { format } from 'date-fns'
import { X, ExternalLink, Calendar, Tag, Ticket, Hotel, Gift } from 'lucide-react'
import type { DealWithResort } from '@/lib/types/database'
import { DealCard } from './DealCard'

interface DealModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  deals: DealWithResort[]
}

export function DealModal({ isOpen, onClose, date, deals }: DealModalProps) {
  if (!isOpen || !date) return null

  // Group deals by quality
  const groupedDeals = deals.reduce((acc, deal) => {
    const quality = calculateDealQuality(deal.discount_percentage || 0)
    if (!acc[quality]) acc[quality] = []
    acc[quality].push(deal)
    return acc
  }, {} as Record<string, DealWithResort[]>)

  const qualityOrder = ['excellent', 'great', 'good', 'standard']

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {deals.length} {deals.length === 1 ? 'deal' : 'deals'} available
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {deals.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-1">No deals for this date</p>
                <p className="text-gray-600">Check back later for new offers</p>
              </div>
            ) : (
              <div className="space-y-6">
                {qualityOrder.map(quality => {
                  const dealsInCategory = groupedDeals[quality]
                  if (!dealsInCategory || dealsInCategory.length === 0) return null

                  return (
                    <div key={quality}>
                      {/* Quality Section Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`deal-quality-dot deal-quality-${quality}`}></span>
                        <h3 className="text-lg font-semibold text-gray-900 capitalize">
                          {quality} Deals ({dealsInCategory.length})
                        </h3>
                      </div>

                      {/* Deal Cards */}
                      <div className="space-y-3">
                        {dealsInCategory.map(deal => (
                          <DealCard key={deal.id} deal={deal} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Hotel className="h-4 w-4" />
                  <span>{new Set(deals.map(d => d.resort_id)).size} resorts</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  <span>{new Set(deals.map(d => d.deal_type)).size} deal types</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-disney-blue text-white rounded-lg hover:bg-disney-darkblue transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function calculateDealQuality(discountPercentage: number): 'excellent' | 'great' | 'good' | 'standard' {
  if (discountPercentage >= 30) return 'excellent'
  if (discountPercentage >= 20) return 'great'
  if (discountPercentage >= 10) return 'good'
  return 'standard'
}

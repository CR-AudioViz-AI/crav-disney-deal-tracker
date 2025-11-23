'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { TrendingDown, Clock, Star, Gift } from 'lucide-react'
import { format, addDays } from 'date-fns'
import type { DealWithResort } from '@/lib/types/database'
import Link from 'next/link'

export function DealSidebar() {
  const [bestDeal, setBestDeal] = useState<DealWithResort | null>(null)
  const [expiringDeals, setExpiringDeals] = useState<DealWithResort[]>([])
  const [newDeals, setNewDeals] = useState<DealWithResort[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSidebarData()
  }, [])

  async function fetchSidebarData() {
    try {
      const today = new Date()
      const sevenDaysFromNow = addDays(today, 7)
      const sevenDaysAgo = addDays(today, -7)

      // Fetch best deal
      const { data: bestDealData } = await supabase
        .from('deals')
        .select(`*, resort:resorts(*)`)
        .eq('is_active', true)
        .gte('valid_to', format(today, 'yyyy-MM-dd'))
        .order('discount_percentage', { ascending: false, nullsFirst: false })
        .limit(1)
        .single()

      if (bestDealData) {
        setBestDeal(bestDealData as DealWithResort)
      }

      // Fetch expiring soon deals
      const { data: expiringData } = await supabase
        .from('deals')
        .select(`*, resort:resorts(*)`)
        .eq('is_active', true)
        .gte('valid_to', format(today, 'yyyy-MM-dd'))
        .lte('valid_to', format(sevenDaysFromNow, 'yyyy-MM-dd'))
        .order('valid_to', { ascending: true })
        .limit(3)

      if (expiringData) {
        setExpiringDeals(expiringData as DealWithResort[])
      }

      // Fetch new deals
      const { data: newData } = await supabase
        .from('deals')
        .select(`*, resort:resorts(*)`)
        .eq('is_active', true)
        .gte('created_at', format(sevenDaysAgo, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false })
        .limit(3)

      if (newData) {
        setNewDeals(newData as DealWithResort[])
      }
    } catch (error) {
      console.error('Error fetching sidebar data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <SidebarSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Best Deal */}
      {bestDeal && (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg shadow-sm border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Best Deal Today</h3>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-red-600">
              {bestDeal.discount_percentage?.toFixed(0)}% OFF
            </div>
            <div className="text-sm font-medium text-gray-900 line-clamp-2">
              {bestDeal.title}
            </div>
            {bestDeal.resort && (
              <div className="text-xs text-gray-600">
                {bestDeal.resort.name}
              </div>
            )}
            <a
              href={bestDeal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
            >
              View Deal
            </a>
          </div>
        </div>
      )}

      {/* Expiring Soon */}
      {expiringDeals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Expiring Soon</h3>
          </div>
          <div className="space-y-3">
            {expiringDeals.map(deal => (
              <div key={deal.id} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">
                  {deal.title}
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  {deal.resort?.name}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-600 font-medium">
                    Expires {format(new Date(deal.valid_to), 'MMM d')}
                  </span>
                  {deal.discount_percentage && (
                    <span className="text-xs font-bold text-red-600">
                      {deal.discount_percentage.toFixed(0)}% off
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New This Week */}
      {newDeals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">New This Week</h3>
          </div>
          <div className="space-y-3">
            {newDeals.map(deal => (
              <div key={deal.id} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">
                  {deal.title}
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  {deal.resort?.name}
                </div>
                {deal.discount_percentage && (
                  <span className="text-xs font-bold text-green-600">
                    {deal.discount_percentage.toFixed(0)}% off
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
        <div className="space-y-2 text-sm">
          <Link href="/deals" className="block text-disney-blue hover:underline">
            Browse All Deals →
          </Link>
          <Link href="/alerts" className="block text-disney-blue hover:underline">
            Manage Alerts →
          </Link>
          <Link href="/settings" className="block text-disney-blue hover:underline">
            Settings →
          </Link>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-sm">
        <p className="text-blue-900 font-medium mb-1">💡 Pro Tip</p>
        <p className="text-blue-800">
          Click any date on the calendar to see all available deals for that specific date. Set up alerts to get notified when deals match your preferences!
        </p>
      </div>
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-4/5"></div>
        </div>
      </div>
    </div>
  )
}

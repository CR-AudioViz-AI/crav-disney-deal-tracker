import { DealCalendar } from '@/components/calendar/DealCalendar'
import { DealSidebar } from '@/components/deals/DealSidebar'
import { CalendarControls } from '@/components/calendar/CalendarControls'
import { Suspense } from 'react'
import { CalendarSkeleton } from '@/components/calendar/CalendarSkeleton'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Revalidate every 5 minutes

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string }
}) {
  const currentDate = searchParams.date ? new Date(searchParams.date) : new Date()
  const viewMode = (searchParams.view as 'month' | 'week' | 'year') || 'month'

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Disney Deal Tracker
        </h1>
        <p className="text-lg text-gray-600">
          Monitor resort deals and pricing for your Disney World vacations
        </p>
      </div>

      {/* Calendar Controls */}
      <div className="mb-6">
        <CalendarControls initialDate={currentDate} initialView={viewMode} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar - Main Content (3/4 width on large screens) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <Suspense fallback={<CalendarSkeleton />}>
              <DealCalendar initialDate={currentDate} viewMode={viewMode} />
            </Suspense>
          </div>
        </div>

        {/* Sidebar (1/4 width on large screens) */}
        <div className="lg:col-span-1">
          <Suspense fallback={<SidebarSkeleton />}>
            <DealSidebar />
          </Suspense>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickStat
          title="Active Deals"
          value="0"
          subtitle="Currently available"
          color="blue"
        />
        <QuickStat
          title="Best Discount"
          value="0%"
          subtitle="Highest savings"
          color="red"
        />
        <QuickStat
          title="Expiring Soon"
          value="0"
          subtitle="Within 7 days"
          color="orange"
        />
        <QuickStat
          title="New This Week"
          value="0"
          subtitle="Fresh deals"
          color="green"
        />
      </div>
    </div>
  )
}

function QuickStat({
  title,
  value,
  subtitle,
  color,
}: {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'red' | 'orange' | 'green'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClasses[color]}`}>
            {value}
          </p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-4/5"></div>
      </div>
    </div>
  )
}

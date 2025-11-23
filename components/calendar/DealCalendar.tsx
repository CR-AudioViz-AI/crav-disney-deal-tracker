'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { CalendarCell } from './CalendarCell'
import { DealModal } from '../deals/DealModal'
import { supabase } from '@/lib/supabase/client'
import type { DealCalendarDay, DealWithResort } from '@/lib/types/database'

interface DealCalendarProps {
  initialDate: Date
  viewMode: 'month' | 'week' | 'year'
}

export function DealCalendar({ initialDate, viewMode }: DealCalendarProps) {
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [calendarData, setCalendarData] = useState<DealCalendarDay[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDeals, setSelectedDeals] = useState<DealWithResort[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch calendar data from Supabase
  useEffect(() => {
    fetchCalendarData()
  }, [currentDate, viewMode])

  async function fetchCalendarData() {
    setIsLoading(true)
    try {
      // Calculate date range based on view mode
      let startDate: Date
      let endDate: Date

      if (viewMode === 'month') {
        startDate = startOfWeek(startOfMonth(currentDate))
        endDate = endOfWeek(endOfMonth(currentDate))
      } else if (viewMode === 'week') {
        startDate = startOfWeek(currentDate)
        endDate = endOfWeek(currentDate)
      } else {
        // Year view - get first and last day of year
        startDate = new Date(currentDate.getFullYear(), 0, 1)
        endDate = new Date(currentDate.getFullYear(), 11, 31)
      }

      // Fetch calendar cache data
      const { data: cacheData, error: cacheError } = await supabase
        .from('deal_calendar_cache')
        .select('*')
        .gte('cache_date', format(startDate, 'yyyy-MM-dd'))
        .lte('cache_date', format(endDate, 'yyyy-MM-dd'))

      if (cacheError) throw cacheError

      // Fetch actual deals for the date range
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select(`
          *,
          resort:resorts(*)
        `)
        .eq('is_active', true)
        .gte('travel_valid_to', format(startDate, 'yyyy-MM-dd'))
        .lte('travel_valid_from', format(endDate, 'yyyy-MM-dd'))
        .order('discount_percentage', { ascending: false, nullsFirst: false })

      if (dealsError) throw dealsError

      // Build calendar day data
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      const calendarDays: DealCalendarDay[] = days.map(day => {
        const dateString = format(day, 'yyyy-MM-dd')
        const cache = cacheData?.find(c => c.cache_date === dateString)
        
        // Filter deals valid for this specific date
        const dealsForDay = (dealsData || []).filter(deal => {
          const dealStart = new Date(deal.travel_valid_from || deal.valid_from)
          const dealEnd = new Date(deal.travel_valid_to || deal.valid_to)
          return day >= dealStart && day <= dealEnd
        }) as DealWithResort[]

        return {
          date: day,
          dateString,
          dealCount: cache?.deal_count || dealsForDay.length,
          bestDiscount: cache?.best_discount_percentage || Math.max(...dealsForDay.map(d => d.discount_percentage || 0), 0),
          dealQuality: cache?.deal_quality || calculateDealQuality(dealsForDay),
          deals: dealsForDay,
        }
      })

      setCalendarData(calendarDays)
    } catch (error) {
      console.error('Error fetching calendar data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function calculateDealQuality(deals: DealWithResort[]): 'excellent' | 'great' | 'good' | 'standard' | 'none' {
    if (deals.length === 0) return 'none'
    const bestDiscount = Math.max(...deals.map(d => d.discount_percentage || 0))
    if (bestDiscount >= 30) return 'excellent'
    if (bestDiscount >= 20) return 'great'
    if (bestDiscount >= 10) return 'good'
    return 'standard'
  }

  function handleDateClick(day: DealCalendarDay) {
    setSelectedDate(day.date)
    setSelectedDeals(day.deals)
    setIsModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  // Render based on view mode
  if (viewMode === 'month') {
    return (
      <>
        <MonthView 
          calendarData={calendarData} 
          currentDate={currentDate}
          onDateClick={handleDateClick}
        />
        <DealModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={selectedDate}
          deals={selectedDeals}
        />
      </>
    )
  }

  if (viewMode === 'week') {
    return (
      <>
        <WeekView 
          calendarData={calendarData} 
          currentDate={currentDate}
          onDateClick={handleDateClick}
        />
        <DealModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={selectedDate}
          deals={selectedDeals}
        />
      </>
    )
  }

  // Year view
  return (
    <>
      <YearView 
        calendarData={calendarData} 
        currentDate={currentDate}
        onDateClick={handleDateClick}
      />
      <DealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        deals={selectedDeals}
      />
    </>
  )
}

// Month View Component
function MonthView({ 
  calendarData, 
  currentDate,
  onDateClick 
}: { 
  calendarData: DealCalendarDay[]
  currentDate: Date
  onDateClick: (day: DealCalendarDay) => void
}) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  return (
    <div>
      {/* Month Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
        {weekDays.map(day => (
          <div key={day} className="bg-gray-50 p-2 text-center">
            <span className="text-sm font-semibold text-gray-700">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
        {calendarData.map(day => (
          <CalendarCell
            key={day.dateString}
            day={day}
            isCurrentMonth={isSameMonth(day.date, currentDate)}
            isToday={isSameDay(day.date, new Date())}
            onClick={() => onDateClick(day)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="deal-quality-dot deal-quality-excellent"></span>
          <span className="text-gray-600">Excellent (30%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="deal-quality-dot deal-quality-great"></span>
          <span className="text-gray-600">Great (20-29%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="deal-quality-dot deal-quality-good"></span>
          <span className="text-gray-600">Good (10-19%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="deal-quality-dot deal-quality-standard"></span>
          <span className="text-gray-600">Standard (<10%)</span>
        </div>
      </div>
    </div>
  )
}

// Week View Component
function WeekView({ 
  calendarData, 
  currentDate,
  onDateClick 
}: { 
  calendarData: DealCalendarDay[]
  currentDate: Date
  onDateClick: (day: DealCalendarDay) => void
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Week of {format(calendarData[0]?.date || currentDate, 'MMMM d, yyyy')}
        </h2>
      </div>

      <div className="space-y-2">
        {calendarData.map(day => (
          <div
            key={day.dateString}
            onClick={() => onDateClick(day)}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {format(day.date, 'EEEE, MMMM d')}
                </div>
                {isSameDay(day.date, new Date()) && (
                  <span className="text-xs text-disney-blue font-medium">Today</span>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{day.dealCount}</div>
                <div className="text-xs text-gray-500">deals</div>
              </div>
            </div>

            {day.dealCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`deal-quality-dot deal-quality-${day.dealQuality}`}></span>
                <span className="text-sm text-gray-600">
                  Best: {day.bestDiscount}% off
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Year View Component (Heat Map)
function YearView({ 
  calendarData, 
  currentDate,
  onDateClick 
}: { 
  calendarData: DealCalendarDay[]
  currentDate: Date
  onDateClick: (day: DealCalendarDay) => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentDate.getFullYear()} - Deal Overview
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(month => {
          const monthStart = startOfMonth(month)
          const monthEnd = endOfMonth(month)
          const monthDays = calendarData.filter(d => 
            d.date >= monthStart && d.date <= monthEnd
          )
          const totalDeals = monthDays.reduce((sum, d) => sum + d.dealCount, 0)
          const avgDiscount = monthDays.length > 0
            ? monthDays.reduce((sum, d) => sum + (d.bestDiscount || 0), 0) / monthDays.length
            : 0

          return (
            <div
              key={format(month, 'yyyy-MM')}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="text-lg font-semibold text-gray-900 mb-2">
                {format(month, 'MMMM')}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-disney-blue">{totalDeals}</div>
                <div className="text-xs text-gray-500">total deals</div>
                <div className="text-sm text-gray-600">
                  Avg: {avgDiscount.toFixed(1)}% off
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

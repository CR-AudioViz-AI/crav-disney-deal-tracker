'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { format, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react'
import { useState } from 'react'

interface CalendarControlsProps {
  initialDate: Date
  initialView: 'month' | 'week' | 'year'
}

export function CalendarControls({ initialDate, initialView }: CalendarControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year'>(initialView)

  function navigate(direction: 'prev' | 'next' | 'today') {
    let newDate: Date

    if (direction === 'today') {
      newDate = new Date()
    } else {
      const increment = direction === 'next' ? 1 : -1
      if (viewMode === 'month') {
        newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
      } else if (viewMode === 'week') {
        newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
      } else {
        newDate = direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1)
      }
    }

    setCurrentDate(newDate)
    updateURL(newDate, viewMode)
  }

  function changeView(view: 'month' | 'week' | 'year') {
    setViewMode(view)
    updateURL(currentDate, view)
  }

  function updateURL(date: Date, view: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', format(date, 'yyyy-MM-dd'))
    params.set('view', view)
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5 text-gray-700" />
        </button>

        <button
          onClick={() => navigate('today')}
          className="px-4 py-2 text-sm font-medium text-disney-blue hover:bg-disney-blue/10 rounded-lg transition-colors"
        >
          Today
        </button>

        <button
          onClick={() => navigate('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5 text-gray-700" />
        </button>

        {/* Current Period Display */}
        <div className="ml-4 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-gray-500" />
          <span className="text-lg font-semibold text-gray-900">
            {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
            {viewMode === 'week' && `Week of ${format(currentDate, 'MMM d, yyyy')}`}
            {viewMode === 'year' && format(currentDate, 'yyyy')}
          </span>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => changeView('month')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-disney-blue text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => changeView('week')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-x border-gray-200 ${
              viewMode === 'week'
                ? 'bg-disney-blue text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => changeView('year')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'year'
                ? 'bg-disney-blue text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Year
          </button>
        </div>

        {/* Filter Button */}
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          title="Filters (Coming soon)"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>
    </div>
  )
}

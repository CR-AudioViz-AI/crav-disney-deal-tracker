export function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-4">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden mb-px">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-gray-100 p-2">
            <div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-white p-2 min-h-[100px] md:min-h-[120px]">
            <div className="h-4 bg-gray-200 rounded w-6 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-12 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

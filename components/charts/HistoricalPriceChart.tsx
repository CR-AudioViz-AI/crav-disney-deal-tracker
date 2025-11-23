'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'
import { format, subMonths } from 'date-fns'

interface PriceChartProps {
  resortId: string
  roomType?: string
  months?: number
}

interface PriceData {
  date: string
  price: number
  average: number
  lowest: number
  highest: number
}

export default function HistoricalPriceChart({ resortId, roomType = 'standard', months = 12 }: PriceChartProps) {
  const [data, setData] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    current: 0,
    average: 0,
    lowest: 0,
    highest: 0,
    trend: 0,
    bestMonth: '',
    worstMonth: ''
  })
  
  useEffect(() => {
    fetchPriceHistory()
  }, [resortId, roomType, months])
  
  async function fetchPriceHistory() {
    try {
      setLoading(true)
      
      const startDate = format(subMonths(new Date(), months), 'yyyy-MM-dd')
      const response = await fetch(
        `/api/price-history?resort_id=${resortId}&room_type=${roomType}&start_date=${startDate}`
      )
      
      if (!response.ok) throw new Error('Failed to fetch')
      
      const result = await response.json()
      
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      console.error('Error fetching price history:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }
  
  const getTrendColor = (trend: number) => {
    if (trend < -5) return 'text-green-600'
    if (trend > 5) return 'text-red-600'
    return 'text-gray-600'
  }
  
  const getTrendIcon = (trend: number) => {
    if (trend < 0) return <TrendingDown className="w-5 h-5" />
    if (trend > 0) return <TrendingUp className="w-5 h-5" />
    return null
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">
          Price History
        </h3>
        <div className={`flex items-center gap-2 ${getTrendColor(stats.trend)}`}>
          {getTrendIcon(stats.trend)}
          <span className="text-sm font-semibold">
            {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(1)}% vs avg
          </span>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Current"
          value={`$${stats.current}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label="12-Mo Average"
          value={`$${stats.average}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="gray"
        />
        <StatCard
          label="Lowest"
          value={`$${stats.lowest}`}
          sublabel={stats.bestMonth}
          icon={<TrendingDown className="w-4 h-4" />}
          color="green"
        />
        <StatCard
          label="Highest"
          value={`$${stats.highest}`}
          sublabel={stats.worstMonth}
          icon={<TrendingUp className="w-4 h-4" />}
          color="red"
        />
      </div>
      
      {/* Price Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0063B2" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0063B2" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6B7280" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6B7280" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              tickFormatter={(date) => format(new Date(date), 'MMM yy')}
            />
            <YAxis
              stroke="#6B7280"
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#0063B2', strokeWidth: 1 }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#0063B2"
              fill="url(#colorPrice)"
              strokeWidth={2}
              name="Price per Night"
            />
            <Area
              type="monotone"
              dataKey="average"
              stroke="#6B7280"
              fill="url(#colorAverage)"
              strokeWidth={1}
              strokeDasharray="5 5"
              name="12-Month Average"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Range Indicator */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Price Range (Last 12 Months)</span>
          <span className="text-sm font-semibold text-gray-900">
            ${stats.lowest} - ${stats.highest}
          </span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
            style={{ width: '100%' }}
          />
          {/* Current price indicator */}
          <div
            className="absolute top-0 h-full w-1 bg-blue-600"
            style={{
              left: `${((stats.current - stats.lowest) / (stats.highest - stats.lowest)) * 100}%`
            }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-blue-600">
              Current
            </div>
          </div>
        </div>
      </div>
      
      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Booking Insights
        </h4>
        <ul className="space-y-1 text-sm text-blue-800">
          {stats.current <= stats.average && (
            <li>✅ Current price is {Math.abs(stats.trend).toFixed(0)}% below average - Good time to book!</li>
          )}
          {stats.current > stats.average && (
            <li>⏸️ Current price is {Math.abs(stats.trend).toFixed(0)}% above average - Consider waiting</li>
          )}
          <li>📊 Best prices typically in {stats.bestMonth}</li>
          <li>💰 You could save ${stats.highest - stats.lowest} by booking at the right time</li>
        </ul>
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel, icon, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {sublabel && (
        <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
      <div className="text-sm font-semibold text-gray-900">
        {format(new Date(label), 'MMMM d, yyyy')}
      </div>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold" style={{ color: entry.color }}>
            ${entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

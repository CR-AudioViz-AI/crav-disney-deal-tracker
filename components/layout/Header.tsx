import Link from 'next/link'
import { Calendar, Bell, Settings, TrendingDown } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and Title */}
        <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-disney-blue">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Disney Deal Tracker</h1>
            <p className="text-xs text-gray-500">Personal Resort Monitor</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link 
            href="/" 
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-disney-blue transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar</span>
          </Link>
          
          <Link 
            href="/deals" 
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-disney-blue transition-colors"
          >
            <TrendingDown className="h-4 w-4" />
            <span>All Deals</span>
          </Link>
          
          <Link 
            href="/alerts" 
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-disney-blue transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span>My Alerts</span>
          </Link>
          
          <Link 
            href="/settings" 
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-disney-blue transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  )
}

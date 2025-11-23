'use client'

import { useState } from 'react'

export default function HomePage() {
  const [currentDate] = useState(new Date())

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🏰 Disney Deal Tracker
          </h1>
          <p className="text-gray-600 mt-2">
            AI-Powered Disney World Resort Deal Monitoring
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Your Personal Deal Tracker
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              MVP Version 1.0 - Core infrastructure deployed successfully!
            </p>
            <div className="flex justify-center gap-4">
              <div className="bg-green-100 text-green-800 px-6 py-3 rounded-lg font-semibold">
                ✅ System Live
              </div>
              <div className="bg-blue-100 text-blue-800 px-6 py-3 rounded-lg font-semibold">
                ✅ Database Ready
              </div>
              <div className="bg-purple-100 text-purple-800 px-6 py-3 rounded-lg font-semibold">
                ✅ API Active
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <FeatureCard
            icon="📅"
            title="Calendar View"
            description="Track deals across dates"
            status="Ready"
          />
          <FeatureCard
            icon="💰"
            title="Price Tracking"
            description="Monitor price changes"
            status="Ready"
          />
          <FeatureCard
            icon="🤖"
            title="Javari AI"
            description="Autonomous learning system"
            status="Ready"
          />
          <FeatureCard
            icon="📊"
            title="Deal Analytics"
            description="Historical price charts"
            status="Ready"
          />
          <FeatureCard
            icon="🔔"
            title="Price Alerts"
            description="Email notifications"
            status="Ready"
          />
          <FeatureCard
            icon="🎯"
            title="Deal Scoring"
            description="AI-powered recommendations"
            status="Ready"
          />
        </div>

        {/* Phase 2 Coming Soon */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">🚀 Phase 2: Deal Aggregators</h3>
          <p className="text-blue-100 mb-4">
            Coming next: 6 automated deal aggregators scanning Disney sources 24/7
          </p>
          <ul className="space-y-2 text-blue-100">
            <li>✨ Disney Parks Blog</li>
            <li>✨ MouseSavers</li>
            <li>✨ Disney Tourist Blog</li>
            <li>✨ DISboards</li>
            <li>✨ AllEars.net</li>
            <li>✨ Reddit r/WaltDisneyWorld</li>
          </ul>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <StatusItem label="Vercel Deployment" status="success" />
            <StatusItem label="Supabase Database" status="ready" />
            <StatusItem label="API Endpoints" status="success" />
            <StatusItem label="Cron Jobs" status="configured" />
            <StatusItem label="Deal Aggregators" status="phase2" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Built with Next.js 14 • Powered by Javari AI</p>
          <p className="text-sm mt-2">MVP Version 1.0 - Deployed {currentDate.toLocaleDateString()}</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, status }: any) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-3">{description}</p>
      <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
        {status}
      </span>
    </div>
  )
}

function StatusItem({ label, status }: any) {
  const statusConfig: any = {
    success: { color: 'green', text: 'Operational', icon: '✅' },
    ready: { color: 'blue', text: 'Ready', icon: '🟦' },
    configured: { color: 'purple', text: 'Configured', icon: '⚙️' },
    phase2: { color: 'yellow', text: 'Coming in Phase 2', icon: '⏳' }
  }
  
  const config = statusConfig[status]
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-gray-700 font-medium">{label}</span>
      <span className={`text-${config.color}-600 font-semibold flex items-center gap-2`}>
        <span>{config.icon}</span>
        {config.text}
      </span>
    </div>
  )
}

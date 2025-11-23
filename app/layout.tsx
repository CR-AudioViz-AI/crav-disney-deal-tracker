import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Disney Deal Tracker | Monitor Disney World Resort Deals',
  description: 'Personal Disney World resort deal tracker. Monitor prices, get alerts for best deals on resorts and partner hotels. Built for passholders.',
  keywords: 'Disney World, resort deals, hotel discounts, Disney vacation, passholder deals',
  authors: [{ name: 'CR AudioViz AI' }],
  creator: 'Roy - CR AudioViz AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Disney Deal Tracker',
    description: 'Monitor Disney World resort deals and prices',
    siteName: 'Disney Deal Tracker',
  },
  robots: {
    index: false, // Private personal tool
    follow: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 bg-gray-50">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}

import './globals.css'
import Script from 'next/script';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disney Deal Tracker - MVP',
  description: 'AI-Powered Disney World Resort Deal Monitoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}        {/* Javari AI */}
        <Script src="https://javariai.com/embed.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}

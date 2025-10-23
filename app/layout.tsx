import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'g0t-phish - AI-Powered Phishing Detection',
  description: 'Automated email phishing detection using Claude AI, Vercel, and Resend',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

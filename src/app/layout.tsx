import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import { GlobalBettingSlipWrapper } from '@/components/picks/global-betting-slip-wrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Deep Pick - Sports Prediction Platform',
  description: 'Data-driven sports predictions for betting, fantasy sports, and daily fantasy platforms',
  keywords: ['sports betting', 'fantasy sports', 'predictions', 'analytics', 'draftkings', 'prizepicks'],
  authors: [{ name: 'Deep Pick Team' }],
  creator: 'Deep Pick',
  publisher: 'Deep Pick',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://deeppick.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://deeppick.app',
    title: 'Deep Pick - Sports Prediction Platform',
    description: 'Data-driven sports predictions for betting, fantasy sports, and daily fantasy platforms',
    siteName: 'Deep Pick',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deep Pick - Sports Prediction Platform',
    description: 'Data-driven sports predictions for betting, fantasy sports, and daily fantasy platforms',
    creator: '@deeppick',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-200">
            {children}
          </div>
          <GlobalBettingSlipWrapper />
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}

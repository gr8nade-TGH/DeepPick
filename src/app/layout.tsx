import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import { GlobalBettingSlipWrapper } from '@/components/picks/global-betting-slip-wrapper'
import { BettingSlipProvider } from '@/contexts/betting-slip-context'
import { AuthProvider } from '@/contexts/auth-context'
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner'
import { NavBar } from '@/components/navigation/nav-bar'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering - don't cache this layout with user data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sharp Siege - Elite Sports Betting Intelligence',
  description: 'Advanced AI-powered sports betting predictions with multi-capper analysis and real-time insights',
  keywords: ['sports betting', 'AI predictions', 'betting analytics', 'sharp betting', 'sports intelligence', 'NBA picks', 'NFL picks'],
  authors: [{ name: 'Sharp Siege Team' }],
  creator: 'Sharp Siege',
  publisher: 'Sharp Siege',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://sharpsiege.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sharpsiege.app',
    title: 'Sharp Siege - Elite Sports Betting Intelligence',
    description: 'Advanced AI-powered sports betting predictions with multi-capper analysis and real-time insights',
    siteName: 'Sharp Siege',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sharp Siege - Elite Sports Betting Intelligence',
    description: 'Advanced AI-powered sports betting predictions with multi-capper analysis and real-time insights',
    creator: '@sharpsiege',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get initial user state from server
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get initial profile from server if user exists
  let initialProfile = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    initialProfile = profile
  }

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <AuthProvider initialUser={user} initialProfile={initialProfile}>
            <BettingSlipProvider>
              <EmailVerificationBanner />
              <NavBar />
              <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-200">
                {children}
              </div>
              <GlobalBettingSlipWrapper />
              <Toaster />
            </BettingSlipProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}

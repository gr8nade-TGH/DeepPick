'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Mail, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export function EmailVerificationBanner() {
  const { user, profile } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Don't show if user is not logged in, email is verified, or banner is dismissed
  if (!user || !profile || profile.email_verified || dismissed) {
    return null
  }

  // Don't show for OAuth users (they're auto-verified)
  const isOAuthUser = user.app_metadata?.provider !== 'email'
  if (isOAuthUser) {
    return null
  }

  const handleResendEmail = async () => {
    setResending(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
      })

      if (error) {
        console.error('Error resending email:', error)
        alert('Failed to resend verification email. Please try again.')
      } else {
        setResent(true)
        setTimeout(() => setResent(false), 5000)
      }
    } catch (error) {
      console.error('Error resending email:', error)
      alert('Failed to resend verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-white">
                Please verify your email address
              </p>
              <p className="text-xs text-slate-300">
                Check your inbox for a verification link. Can't find it?{' '}
                <button
                  onClick={handleResendEmail}
                  disabled={resending || resent}
                  className="text-yellow-400 hover:text-yellow-300 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? 'Sending...' : resent ? 'Email sent!' : 'Resend email'}
                </button>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}


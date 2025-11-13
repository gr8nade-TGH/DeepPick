'use client'

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Crown, Zap, TrendingUp, Target, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function UpgradePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  // Redirect if already a capper or admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'free') {
      router.push('/')
    }
  }, [profile, loading, router])

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // Only show "Sign In Required" if we're done loading AND there's no user
  // This prevents the flash when profile is temporarily null during auth state changes
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Sign In Required</CardTitle>
            <CardDescription>Please sign in to upgrade your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If we have a user but no profile yet, show loading
  // This handles the case where profile is still being fetched
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading your profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
            Become a Capper
          </h1>
          <p className="text-xl text-slate-300">
            Unlock the power to make picks and compete on the leaderboard
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* FREE Plan */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl text-white">Free</CardTitle>
                <div className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-sm">
                  Current Plan
                </div>
              </div>
              <CardDescription className="text-3xl font-bold text-white">
                $0<span className="text-lg text-slate-400">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 mt-0.5" />
                  <span className="text-slate-300">View generated picks from AI cappers</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 mt-0.5" />
                  <span className="text-slate-300">Access to leaderboard (view only)</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 mt-0.5" />
                  <span className="text-slate-300">View performance analytics</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CAPPER Plan */}
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/50 border-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-1 text-sm font-semibold">
              POPULAR
            </div>
            <CardHeader className="pt-8">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                <CardTitle className="text-2xl text-white">Capper</CardTitle>
              </div>
              <CardDescription className="text-3xl font-bold text-white">
                $19.99<span className="text-lg text-slate-400">/month</span>
              </CardDescription>
              <p className="text-sm text-yellow-400 mt-2">Coming Soon - Payment Integration</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <span className="text-white font-semibold">Everything in Free, plus:</span>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <span className="text-slate-200">Make your own picks via betting slip</span>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <span className="text-slate-200">Ranked on the leaderboard</span>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <span className="text-slate-200">Track your performance & ROI</span>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <span className="text-slate-200">Featured on main dashboard</span>
                </div>
              </div>

              <Button
                disabled
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold text-lg py-6 disabled:opacity-50"
              >
                Coming Soon
              </Button>

              <p className="text-xs text-slate-400 text-center">
                Payment integration will be added soon. For now, contact an admin to upgrade.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ / Info Section */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Why Become a Capper?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🎯 Compete & Prove Your Skills</h3>
              <p>
                Show the world your sports betting expertise. Make picks, track your performance, and climb the leaderboard
                to become the top capper.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">📊 Advanced Analytics</h3>
              <p>
                Get detailed insights into your picking performance. Track your ROI, win rate, and see which bet types
                work best for you.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🏆 Build Your Reputation</h3>
              <p>
                Successful cappers get featured on the main dashboard. Build a following and establish yourself as a
                trusted voice in sports betting.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-800">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}


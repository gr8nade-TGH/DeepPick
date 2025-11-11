'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { UserProfileData } from '@/types/admin'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileStatsOverview } from '@/components/profile/profile-stats-overview'
import { PicksHistory } from '@/components/profile/picks-history'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const params = useParams()
  const userId = params.userId as string

  const [profileData, setProfileData] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch profile')
      }

      if (data.success) {
        setProfileData(data)
      } else {
        throw new Error(data.error || 'Failed to fetch profile')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchProfile()
    }
  }, [userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="bg-slate-800/50 border-slate-700 max-w-md">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">
                  {error === 'Profile not available for FREE users' 
                    ? 'Profile Not Available' 
                    : 'Error Loading Profile'}
                </h2>
                <p className="text-slate-400 mb-6">
                  {error}
                </p>
                <Link href="/leaderboard">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Leaderboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Back button */}
        <div className="flex items-center justify-between">
          <Link href="/leaderboard">
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={fetchProfile}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Profile header */}
        <ProfileHeader profile={profileData.profile} />

        {/* Stats overview */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Performance Overview</h2>
          <ProfileStatsOverview stats={profileData.stats} />
        </div>

        {/* Picks history */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Picks History
            <span className="text-slate-500 text-lg ml-2">
              ({profileData.picks.length} total)
            </span>
          </h2>
          <PicksHistory picks={profileData.picks} />
        </div>

        {/* Last updated */}
        <div className="text-center text-xs text-slate-500">
          Last updated: {new Date(profileData.last_updated).toLocaleString()}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  User, 
  Mail, 
  AtSign, 
  FileText, 
  Twitter, 
  Instagram,
  Save,
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    twitter_url: '',
    instagram_url: ''
  })

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form with current profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        twitter_url: profile.twitter_url || '',
        instagram_url: profile.instagram_url || ''
      })
    }
  }, [profile])

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError(null)

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      if (data.success) {
        setSuccess(true)
        // Refresh profile in context
        await refreshProfile()
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      } else {
        throw new Error(data.error || 'Failed to update profile')
      }
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(false)
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/profile/${user.id}`}>
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-slate-400">Customize your public profile</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400">Profile updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Your name and username visible to other users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <Label htmlFor="email" className="text-slate-300 flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email || ''}
                  disabled
                  className="bg-slate-900/50 border-slate-700 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Full Name */}
              <div>
                <Label htmlFor="full_name" className="text-slate-300 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="Enter your full name"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              {/* Username */}
              <div>
                <Label htmlFor="username" className="text-slate-300 flex items-center gap-2 mb-2">
                  <AtSign className="w-4 h-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="Enter your username"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">Your unique username (letters, numbers, underscores)</p>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Bio
              </CardTitle>
              <CardDescription className="text-slate-400">
                Tell others about yourself
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Write a short bio about yourself..."
                rows={4}
                maxLength={500}
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                {formData.bio.length} / 500 characters
              </p>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Social Links</CardTitle>
              <CardDescription className="text-slate-400">
                Connect your social media profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Twitter */}
              <div>
                <Label htmlFor="twitter_url" className="text-slate-300 flex items-center gap-2 mb-2">
                  <Twitter className="w-4 h-4" />
                  Twitter / X
                </Label>
                <Input
                  id="twitter_url"
                  type="url"
                  value={formData.twitter_url}
                  onChange={(e) => handleChange('twitter_url', e.target.value)}
                  placeholder="https://twitter.com/yourusername"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              {/* Instagram */}
              <div>
                <Label htmlFor="instagram_url" className="text-slate-300 flex items-center gap-2 mb-2">
                  <Instagram className="w-4 h-4" />
                  Instagram
                </Label>
                <Input
                  id="instagram_url"
                  type="url"
                  value={formData.instagram_url}
                  onChange={(e) => handleChange('instagram_url', e.target.value)}
                  placeholder="https://instagram.com/yourusername"
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Link href={`/profile/${user.id}`}>
              <Button type="button" variant="outline" className="border-slate-700 hover:bg-slate-800">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}


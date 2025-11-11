'use client'

import { PublicUserProfile } from '@/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Crown, Shield, User, Calendar, Twitter, Instagram, Settings } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface ProfileHeaderProps {
  profile: PublicUserProfile
  isOwnProfile?: boolean
  currentUserId?: string
}

const ROLE_CONFIG = {
  free: {
    label: 'FREE',
    icon: User,
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    gradient: 'from-slate-500 to-slate-600'
  },
  capper: {
    label: 'CAPPER',
    icon: Crown,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    gradient: 'from-blue-500 to-cyan-500'
  },
  admin: {
    label: 'ADMIN',
    icon: Shield,
    color: 'bg-red-500/20 text-red-400 border-red-500/50',
    gradient: 'from-red-500 to-orange-500'
  }
}

export function ProfileHeader({ profile, isOwnProfile = false, currentUserId }: ProfileHeaderProps) {
  const roleConfig = ROLE_CONFIG[profile.role]
  const RoleIcon = roleConfig.icon

  // Get initials for avatar
  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (profile.username) {
      return profile.username.slice(0, 2).toUpperCase()
    }
    return profile.email.slice(0, 2).toUpperCase()
  }

  const displayName = profile.full_name || profile.username || profile.email.split('@')[0]

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${roleConfig.gradient} opacity-5`} />

      <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar */}
        <div className="relative">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-24 h-24 rounded-full border-4 border-slate-700"
            />
          ) : (
            <div className={`w-24 h-24 rounded-full border-4 border-slate-700 bg-gradient-to-br ${roleConfig.gradient} flex items-center justify-center text-2xl font-bold text-white`}>
              {getInitials()}
            </div>
          )}

          {/* Role badge on avatar */}
          <div className="absolute -bottom-2 -right-2">
            <div className={`p-2 rounded-full border-2 border-slate-800 ${roleConfig.color}`}>
              <RoleIcon className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">
            {displayName}
          </h1>

          {profile.username && profile.full_name && (
            <p className="text-slate-400 mb-3">@{profile.username}</p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
            {/* Role badge */}
            <Badge className={`${roleConfig.color} border`}>
              <RoleIcon className="w-3 h-3 mr-1" />
              {roleConfig.label}
            </Badge>

            {/* Join date */}
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>Joined {format(new Date(profile.created_at), 'MMM yyyy')}</span>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-slate-300 text-sm mt-3 max-w-2xl">
              {profile.bio}
            </p>
          )}

          {/* Social Links */}
          {(profile.twitter_url || profile.instagram_url) && (
            <div className="flex items-center gap-3 mt-4">
              {profile.twitter_url && (
                <a
                  href={profile.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm text-slate-300 hover:text-white"
                >
                  <Twitter className="w-4 h-4" />
                  Twitter
                </a>
              )}
              {profile.instagram_url && (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm text-slate-300 hover:text-white"
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </a>
              )}
            </div>
          )}

          {/* Edit Profile Button (only for own profile) */}
          {isOwnProfile && (
            <div className="mt-4">
              <Link href="/settings/profile">
                <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserRoleSelector } from '@/components/admin/user-role-selector'
import { UserStatsCard } from '@/components/admin/user-stats-card'
import {
  Users,
  Search,
  RefreshCw,
  Shield,
  User,
  Crown,
  Loader2,
  Mail,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { UserWithStats, UserRole } from '@/types/admin'
import { useToast } from '@/hooks/use-toast'

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'total_picks' | 'net_units' | 'email'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Redirect if not admin
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/')
    }
  }, [profile, router])

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        role: roleFilter,
        search: searchQuery,
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch users',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers()
    }
  }, [profile, roleFilter, sortBy, sortOrder])

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: `User role updated to ${newRole.toUpperCase()}`,
        })
        // Refresh users list
        fetchUsers()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update role',
          variant: 'destructive'
        })
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error updating role:', error)
      throw error
    }
  }

  // Handle search
  const handleSearch = () => {
    fetchUsers()
  }

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  // Get role badge config
  const getRoleBadge = (role: UserRole) => {
    const config = {
      free: { icon: User, color: 'bg-slate-500/20 text-slate-400 border-slate-500/50', label: 'FREE' },
      capper: { icon: Crown, color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'CAPPER' },
      admin: { icon: Shield, color: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'ADMIN' }
    }
    return config[role]
  }

  // Stats summary
  const totalUsers = users.length
  const freeUsers = users.filter(u => u.role === 'free').length
  const capperUsers = users.filter(u => u.role === 'capper').length
  const adminUsers = users.filter(u => u.role === 'admin').length

  if (!profile || profile.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-slate-400 text-sm mt-1">Manage user roles and view statistics</p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">{totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Free Users</p>
                  <p className="text-2xl font-bold text-slate-300">{freeUsers}</p>
                </div>
                <User className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Cappers</p>
                  <p className="text-2xl font-bold text-blue-400">{capperUsers}</p>
                </div>
                <Crown className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Admins</p>
                  <p className="text-2xl font-bold text-red-400">{adminUsers}</p>
                </div>
                <Shield className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by email, username, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-slate-900 border-slate-700"
                  />
                </div>
                <Button onClick={handleSearch} variant="outline">
                  Search
                </Button>
              </div>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="free">FREE</SelectItem>
                  <SelectItem value="capper">CAPPER</SelectItem>
                  <SelectItem value="admin">ADMIN</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Join Date</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="total_picks">Total Picks</SelectItem>
                  <SelectItem value="net_units">Net Units</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Button onClick={toggleSortOrder} variant="outline" className="w-24">
                {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronUp className="w-4 h-4 mr-2" />}
                {sortOrder === 'desc' ? 'Desc' : 'Asc'}
              </Button>

              {/* Refresh */}
              <Button onClick={fetchUsers} variant="outline" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        {loading ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const roleBadge = getRoleBadge(user.role)
              const RoleIcon = roleBadge.icon
              const isExpanded = expandedUserId === user.id

              return (
                <Card key={user.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
                  <CardContent className="p-4">
                    {/* User Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {user.email.charAt(0).toUpperCase()}
                        </div>

                        {/* User Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">
                              {user.full_name || user.username || 'Unnamed User'}
                            </h3>
                            <Badge className={`${roleBadge.color} border flex items-center gap-1`}>
                              <RoleIcon className="w-3 h-3" />
                              {roleBadge.label}
                            </Badge>
                            {/* View Profile link for CAPPER and ADMIN */}
                            {(user.role === 'capper' || user.role === 'admin') && (
                              <Link href={`/profile/${user.id}`} target="_blank">
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View Profile
                                </Button>
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Joined {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="hidden lg:block">
                          <UserStatsCard stats={user.stats} compact />
                        </div>

                        {/* Role Selector */}
                        <UserRoleSelector
                          userId={user.id}
                          currentRole={user.role}
                          userEmail={user.email}
                          onRoleChange={handleRoleChange}
                        />

                        {/* Expand Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Stats */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <UserStatsCard stats={user.stats} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


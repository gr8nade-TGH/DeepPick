'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Shield, User, Crown, Loader2 } from 'lucide-react'
import type { UserRole } from '@/types/admin'

interface UserRoleSelectorProps {
  userId: string
  currentRole: UserRole
  userEmail: string
  onRoleChange: (userId: string, newRole: UserRole) => Promise<void>
}

const ROLE_CONFIG = {
  free: {
    label: 'FREE',
    icon: User,
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    description: 'Can view dashboard and leaderboard (read-only)'
  },
  capper: {
    label: 'CAPPER',
    icon: Crown,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    description: 'Can make picks and appear on leaderboard'
  },
  admin: {
    label: 'ADMIN',
    icon: Shield,
    color: 'bg-red-500/20 text-red-400 border-red-500/50',
    description: 'Full access to all features and user management'
  }
}

export function UserRoleSelector({
  userId,
  currentRole,
  userEmail,
  onRoleChange
}: UserRoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role)
    if (role !== currentRole) {
      setShowConfirmDialog(true)
    }
  }

  const handleConfirmChange = async () => {
    setIsUpdating(true)
    try {
      await onRoleChange(userId, selectedRole)
      setShowConfirmDialog(false)
    } catch (error) {
      console.error('Failed to update role:', error)
      // Reset to current role on error
      setSelectedRole(currentRole)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelChange = () => {
    setSelectedRole(currentRole)
    setShowConfirmDialog(false)
  }

  const CurrentRoleIcon = ROLE_CONFIG[currentRole].icon
  const NewRoleIcon = ROLE_CONFIG[selectedRole].icon

  return (
    <>
      <Select value={selectedRole} onValueChange={handleRoleSelect}>
        <SelectTrigger className="w-32">
          <SelectValue>
            <div className="flex items-center gap-2">
              <CurrentRoleIcon className="w-4 h-4" />
              <span>{ROLE_CONFIG[currentRole].label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => {
            const Icon = config.icon
            return (
              <SelectItem key={role} value={role}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{config.label}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the role for <strong>{userEmail}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Role */}
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-400 w-20">Current:</div>
              <Badge className={`${ROLE_CONFIG[currentRole].color} border flex items-center gap-2`}>
                <CurrentRoleIcon className="w-4 h-4" />
                {ROLE_CONFIG[currentRole].label}
              </Badge>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-3">
              <div className="w-20"></div>
              <div className="text-2xl text-slate-600">↓</div>
            </div>

            {/* New Role */}
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-400 w-20">New:</div>
              <Badge className={`${ROLE_CONFIG[selectedRole].color} border flex items-center gap-2`}>
                <NewRoleIcon className="w-4 h-4" />
                {ROLE_CONFIG[selectedRole].label}
              </Badge>
            </div>

            {/* Description */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-4">
              <p className="text-sm text-slate-300">
                {ROLE_CONFIG[selectedRole].description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelChange}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmChange}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


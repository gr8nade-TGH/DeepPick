import { createClient } from '@/lib/supabase/client'
import { ApiResponse, PaginatedResponse } from '@/types'

class ApiClient {
  private supabase = createClient()

  // Generic API methods
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred')
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      return {
        data: null as T,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // User methods
  async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user
  }

  async getUserProfile(userId: string) {
    return this.request(`/users/${userId}`)
  }

  async updateUserProfile(userId: string, data: any) {
    return this.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Pick methods
  async getPicks(filters?: any, pagination?: any) {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }
    
    if (pagination) {
      Object.entries(pagination).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    return this.request(`/picks?${params.toString()}`)
  }

  async getPick(pickId: string) {
    return this.request(`/picks/${pickId}`)
  }

  async createPick(data: any) {
    return this.request('/picks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePick(pickId: string, data: any) {
    return this.request(`/picks/${pickId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deletePick(pickId: string) {
    return this.request(`/picks/${pickId}`, {
      method: 'DELETE',
    })
  }

  // Game methods
  async getGames(filters?: any, pagination?: any) {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }
    
    if (pagination) {
      Object.entries(pagination).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    return this.request(`/games?${params.toString()}`)
  }

  async getGame(gameId: string) {
    return this.request(`/games/${gameId}`)
  }

  // Team methods
  async getTeams(sport?: string) {
    const params = sport ? `?sport=${sport}` : ''
    return this.request(`/teams${params}`)
  }

  async getTeam(teamId: string) {
    return this.request(`/teams/${teamId}`)
  }

  // Performance methods
  async getPerformanceMetrics(period: string = 'all_time') {
    return this.request(`/performance?period=${period}`)
  }

  async getPerformanceChart(period: string = 'all_time') {
    return this.request(`/performance/chart?period=${period}`)
  }

  // Notification methods
  async getNotifications(pagination?: any) {
    const params = new URLSearchParams()
    
    if (pagination) {
      Object.entries(pagination).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    return this.request(`/notifications?${params.toString()}`)
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    })
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PATCH',
    })
  }

  // Search methods
  async search(query: string, type: string = 'all') {
    return this.request(`/search?q=${encodeURIComponent(query)}&type=${type}`)
  }

  // External API methods
  async getExternalPicks(platform: string) {
    return this.request(`/external/${platform}/picks`)
  }

  async syncExternalPick(externalPickId: string) {
    return this.request(`/external/sync/${externalPickId}`, {
      method: 'POST',
    })
  }

  // Analytics methods
  async getAnalytics(period: string = 'all_time') {
    return this.request(`/analytics?period=${period}`)
  }

  async getTrends(sport?: string, betType?: string) {
    const params = new URLSearchParams()
    if (sport) params.append('sport', sport)
    if (betType) params.append('bet_type', betType)
    
    return this.request(`/analytics/trends?${params.toString()}`)
  }

  // Real-time subscriptions
  subscribeToPicks(callback: (payload: any) => void) {
    return this.supabase
      .channel('picks')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'picks' },
        callback
      )
      .subscribe()
  }

  subscribeToGames(callback: (payload: any) => void) {
    return this.supabase
      .channel('games')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'games' },
        callback
      )
      .subscribe()
  }

  subscribeToNotifications(callback: (payload: any) => void) {
    return this.supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        callback
      )
      .subscribe()
  }

  // Utility methods
  async uploadFile(file: File, bucket: string) {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(`${Date.now()}-${file.name}`, file)

    if (error) throw error
    return data
  }

  async getFileUrl(bucket: string, path: string) {
    const { data } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  }
}

export const apiClient = new ApiClient()

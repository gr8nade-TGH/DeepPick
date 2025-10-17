'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/components/auth/auth-provider'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Target, Activity } from 'lucide-react'

export function Dashboard() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gradient">
              Welcome to Deep Pick
            </CardTitle>
            <CardDescription>
              Data-driven sports predictions for betting, fantasy sports, and daily fantasy platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" variant="neon">
              Get Started
            </Button>
            <Button className="w-full" variant="outline">
              Learn More
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-200">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-gradient">
                Deep Pick
              </div>
              <div className="hidden md:block text-sm text-muted-foreground">
                Sports Prediction Platform
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Welcome, {user.email}
              </div>
              <Button variant="outline" size="sm">
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Performance Overview */}
          <Card className="glass-effect neon-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Units
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-neon-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-green">+12.5</div>
              <p className="text-xs text-muted-foreground">
                +2.1% from last week
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-blue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Win Rate
              </CardTitle>
              <Target className="h-4 w-4 text-neon-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-blue">68.2%</div>
              <p className="text-xs text-muted-foreground">
                +5.3% from last week
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-purple">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Picks
              </CardTitle>
              <Activity className="h-4 w-4 text-neon-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-purple">47</div>
              <p className="text-xs text-muted-foreground">
                12 this week
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-pink">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                ROI
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-neon-pink" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-pink">+24.7%</div>
              <p className="text-xs text-muted-foreground">
                +3.2% from last week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Picks */}
        <div className="mt-8">
          <Card className="glass-effect">
            <CardHeader>
              <CardTitle>Recent Picks</CardTitle>
              <CardDescription>
                Your latest predictions and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">🏈</div>
                    <div>
                      <div className="font-medium">Chiefs -3.5</div>
                      <div className="text-sm text-muted-foreground">NFL • Spread</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-neon-green font-bold">WON</div>
                    <div className="text-sm text-muted-foreground">+2.1 units</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">🏀</div>
                    <div>
                      <div className="font-medium">Lakers Over 225.5</div>
                      <div className="text-sm text-muted-foreground">NBA • Total</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-bold">LOST</div>
                    <div className="text-sm text-muted-foreground">-1.0 units</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">⚾</div>
                    <div>
                      <div className="font-medium">Yankees ML</div>
                      <div className="text-sm text-muted-foreground">MLB • Moneyline</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold">PENDING</div>
                    <div className="text-sm text-muted-foreground">1.5 units</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="glass-effect">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Create new picks and manage your predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Button variant="neon" className="h-20 flex-col space-y-2">
                  <div className="text-2xl">🎯</div>
                  <div>Create Pick</div>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <div className="text-2xl">📊</div>
                  <div>View Analytics</div>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <div className="text-2xl">⚙️</div>
                  <div>Settings</div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

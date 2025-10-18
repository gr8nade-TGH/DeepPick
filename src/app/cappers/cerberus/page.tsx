'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Home, Shield } from 'lucide-react'

export default function CerberusCapperPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">CERBERUS</h1>
              <p className="text-gray-400">Multi-Model Consensus</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Strategy Card */}
        <Card className="glass-effect border-red-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">Algorithm Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Core Philosophy</h3>
              <p>"Three heads are better than one. Consensus reduces risk."</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Three Internal Models</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Model A (Momentum):</strong> Recent form, streaks, hot/cold teams</li>
                <li><strong>Model B (Value):</strong> Odds value, market inefficiencies</li>
                <li><strong>Model C (Situational):</strong> Matchup-specific factors</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Consensus Logic</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>All 3 agree → 90% confidence (STRONG SIGNAL)</li>
                <li>2 agree → 70% confidence (MODERATE SIGNAL)</li>
                <li>No agreement → No pick (CONFLICTING SIGNALS)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
              <p className="text-yellow-400">⚠️ Algorithm logic not yet implemented</p>
              <p className="text-sm text-gray-400 mt-2">
                This page is ready for algorithm development. Implement the three internal models and consensus logic.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon */}
        <Card className="glass-effect border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-2xl text-gray-400">Algorithm Development In Progress</p>
            <p className="text-gray-500 mt-2">Check back soon for live picks and analysis</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Home, Sparkles } from 'lucide-react'

export default function DeepPickCapperPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">DEEPPICK</h1>
              <p className="text-gray-400">Meta-Algorithm Aggregator</p>
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
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-400">Algorithm Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Core Philosophy</h3>
              <p>"Wisdom of the crowd. Aggregate the best minds."</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">How It Works</h3>
              <p>DeepPick aggregates picks from all other cappers:</p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li><strong>Nexus:</strong> Pattern recognition</li>
                <li><strong>Shiva:</strong> Statistical analysis</li>
                <li><strong>Cerberus:</strong> Multi-model consensus</li>
                <li><strong>Ifrit:</strong> Value hunting</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Consensus Logic</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>4 cappers agree → 95% confidence (UNANIMOUS)</li>
                <li>3 cappers agree → 80% confidence (STRONG CONSENSUS)</li>
                <li>2 cappers agree → 60% confidence (MODERATE CONSENSUS)</li>
                <li>No consensus → No pick</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
              <p className="text-yellow-400">⚠️ Algorithm logic not yet implemented</p>
              <p className="text-sm text-gray-400 mt-2">
                This page is ready for algorithm development. Will aggregate picks once other cappers are functional.
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

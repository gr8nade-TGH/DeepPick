'use client'

import { SpecTree } from './spec-tree'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useState } from 'react'

export default function AvatarSpecTreePage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-dark-100 p-8">
      <div className="max-w-7xl mx-auto">
        <Card className="bg-dark-200 border-dark-300">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">
              Character Spec Tree
            </CardTitle>
            <CardDescription className="text-gray-400">
              Customize your capper's abilities by investing points into MOBILITY, CONDITIONING, and SURVIVAL branches.
              Click on unlocked nodes to level them up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SpecTree
              onNodeClick={(nodeId) => {
                setSelectedNode(nodeId)
                console.log('Node clicked:', nodeId)
              }}
              onLevelUp={(nodeId) => {
                console.log('Node leveled up:', nodeId)
              }}
            />
          </CardContent>
        </Card>

        {selectedNode && (
          <Card className="mt-4 bg-dark-200 border-dark-300">
            <CardHeader>
              <CardTitle className="text-lg text-white">Node Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Selected: {selectedNode}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


export type SpecBranch = 'mobility' | 'conditioning' | 'survival'

export interface SpecNode {
  id: string
  name: string
  icon: string // Icon identifier or emoji
  branch: SpecBranch
  tier: number // 0 = starting, 1 = first tier, 2 = second tier, etc.
  maxLevel: number
  currentLevel: number
  locked: boolean
  prerequisites: string[] // IDs of nodes that must be unlocked first
  x: number // Position for rendering
  y: number // Position for rendering
  connections: string[] // IDs of connected nodes
}

export interface SpecTreeData {
  branches: {
    mobility: SpecNode[]
    conditioning: SpecNode[]
    survival: SpecNode[]
  }
  branchLevels: {
    mobility: number
    conditioning: number
    survival: number
  }
}

export interface SpecTreeProps {
  data?: SpecTreeData
  onNodeClick?: (nodeId: string) => void
  onLevelUp?: (nodeId: string) => void
}


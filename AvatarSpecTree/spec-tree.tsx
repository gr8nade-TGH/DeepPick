'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { SpecNode, SpecBranch, SpecTreeProps, SpecTreeData } from './types'
import { createInitialSpecTree } from './spec-tree-data'
import { cn } from '@/lib/utils'

interface NodeComponentProps {
  node: SpecNode
  branchColor: string
  isUnlocked: boolean
  onClick: () => void
  onLevelUp: () => void
}

const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  branchColor,
  isUnlocked,
  onClick,
  onLevelUp,
}) => {
  const isActive = node.currentLevel > 0
  const isLocked = !isUnlocked && node.currentLevel === 0 && node.tier > 0
  const canLevelUp = isUnlocked && !isLocked && node.currentLevel < node.maxLevel

  // Calculate node colors based on state
  const getNodeFill = () => {
    if (isLocked) return '#374151' // Dark gray for locked
    if (isActive) {
      // Active nodes use branch color with opacity
      if (node.branch === 'mobility') return '#fbbf24' // yellow
      if (node.branch === 'conditioning') return '#4ade80' // green
      if (node.branch === 'survival') return '#f87171' // red
    }
    return '#1f2937' // Dark gray for unlocked but not leveled
  }

  const getNodeStroke = () => {
    if (isLocked) return '#6b7280' // Gray border for locked
    return branchColor
  }

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (canLevelUp) {
      onLevelUp()
    } else if (!isLocked) {
      onClick()
    }
  }, [canLevelUp, isLocked, onClick, onLevelUp])

  return (
    <g
      className={cn(
        'cursor-pointer transition-all duration-200',
        canLevelUp && 'hover:scale-110',
        isLocked && 'opacity-60'
      )}
      onClick={handleClick}
    >
      {/* Node circle - larger size for better visibility */}
      <circle
        cx={node.x}
        cy={node.y}
        r="4"
        fill={getNodeFill()}
        stroke={getNodeStroke()}
        strokeWidth={isActive ? '0.4' : '0.25'}
        className="transition-all"
      />

      {/* Icon in center */}
      <text
        x={node.x}
        y={node.y + 1.2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="3"
        fill={isLocked ? '#9ca3af' : '#ffffff'}
        className="pointer-events-none select-none"
        style={{ userSelect: 'none' }}
      >
        {node.icon}
      </text>

      {/* Lock icon for locked nodes - positioned at top */}
      {isLocked && (
        <g>
          {/* Small lock icon */}
          <circle
            cx={node.x + 3}
            cy={node.y - 3}
            r="1.5"
            fill="#fbbf24"
            stroke="#fbbf24"
            strokeWidth="0.1"
            opacity="0.9"
          />
          <text
            x={node.x + 3}
            y={node.y - 2.8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="1.5"
            fill="#1f2937"
            className="pointer-events-none select-none"
            style={{ userSelect: 'none' }}
          >
            🔒
          </text>
        </g>
      )}

      {/* Progress indicator - only show if not locked */}
      {!isLocked && (
        <text
          x={node.x}
          y={node.y + 5.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="1.8"
          fill={isActive ? branchColor : '#9ca3af'}
          className="pointer-events-none select-none font-mono"
          style={{ userSelect: 'none', fontFamily: 'monospace' }}
          fontWeight="600"
        >
          {node.currentLevel}/{node.maxLevel}
        </text>
      )}

      {/* Node name below progress */}
      <text
        x={node.x}
        y={node.y + 7.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="1.5"
        fill={isActive ? branchColor : isLocked ? '#9ca3af' : '#9ca3af'}
        className="pointer-events-none select-none"
        style={{ userSelect: 'none' }}
        fontWeight={isActive ? '600' : '400'}
      >
        {node.name.length > 14 ? node.name.substring(0, 12) + '...' : node.name}
      </text>
    </g>
  )
}

interface ConnectionLineProps {
  from: SpecNode
  to: SpecNode
  color: string
  isActive: boolean
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ from, to, color, isActive }) => {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={isActive ? color : '#4b5563'}
      strokeWidth={isActive ? '0.3' : '0.15'}
      opacity={isActive ? 1 : 0.4}
      className="pointer-events-none"
    />
  )
}

export const SpecTree: React.FC<SpecTreeProps> = ({
  data: initialData,
  onNodeClick,
  onLevelUp,
}) => {
  const [treeData, setTreeData] = useState<SpecTreeData>(
    initialData || createInitialSpecTree()
  )

  const allNodes = useMemo(() => {
    return [
      ...treeData.branches.mobility,
      ...treeData.branches.conditioning,
      ...treeData.branches.survival,
    ]
  }, [treeData])

  // Check if a node is unlocked (all prerequisites are met)
  const isNodeUnlocked = useCallback((node: SpecNode): boolean => {
    if (node.prerequisites.length === 0) return true
    return node.prerequisites.every((prereqId) => {
      const prereqNode = allNodes.find((n) => n.id === prereqId)
      return prereqNode && prereqNode.currentLevel > 0
    })
  }, [allNodes])

  // Update node unlock status
  const updateNodeLocks = useCallback((nodes: SpecNode[]): SpecNode[] => {
    return nodes.map((node) => {
      const unlocked = isNodeUnlocked(node)
      return {
        ...node,
        locked: !unlocked && node.currentLevel === 0 && node.tier > 0,
      }
    })
  }, [isNodeUnlocked])

  // Get branch color
  const getBranchColor = useCallback((branch: SpecBranch): string => {
    switch (branch) {
      case 'mobility':
        return '#fbbf24' // yellow-400
      case 'conditioning':
        return '#4ade80' // green-400
      case 'survival':
        return '#f87171' // red-400
      default:
        return '#9ca3af'
    }
  }, [])

  // Handle level up
  const handleLevelUp = useCallback((nodeId: string) => {
    setTreeData((prev) => {
      const updatedNodes = allNodes.map((node) => {
        if (node.id === nodeId && isNodeUnlocked(node) && node.currentLevel < node.maxLevel) {
          return {
            ...node,
            currentLevel: node.currentLevel + 1,
            locked: false,
          }
        }
        return node
      })

      // Update locks based on prerequisites
      const mobilityUpdated = updateNodeLocks(
        updatedNodes.filter((n) => n.branch === 'mobility')
      )
      const conditioningUpdated = updateNodeLocks(
        updatedNodes.filter((n) => n.branch === 'conditioning')
      )
      const survivalUpdated = updateNodeLocks(
        updatedNodes.filter((n) => n.branch === 'survival')
      )

      // Recalculate branch levels
      const mobilityLevel = Math.max(
        0,
        ...mobilityUpdated.map((n) => (n.currentLevel > 0 ? n.tier : 0))
      )
      const conditioningLevel = Math.max(
        0,
        ...conditioningUpdated.map((n) => (n.currentLevel > 0 ? n.tier : 0))
      )
      const survivalLevel = Math.max(
        0,
        ...survivalUpdated.map((n) => (n.currentLevel > 0 ? n.tier : 0))
      )

      return {
        branches: {
          mobility: mobilityUpdated,
          conditioning: conditioningUpdated,
          survival: survivalUpdated,
        },
        branchLevels: {
          mobility: mobilityLevel,
          conditioning: conditioningLevel,
          survival: survivalLevel,
        },
      }
    })

    onLevelUp?.(nodeId)
  }, [allNodes, isNodeUnlocked, updateNodeLocks, onLevelUp])

  // Check if connection should be active
  const isConnectionActive = useCallback((from: SpecNode, to: SpecNode): boolean => {
    const fromActive = from.currentLevel > 0
    const toUnlocked = isNodeUnlocked(to)
    return fromActive && (to.currentLevel > 0 || toUnlocked)
  }, [isNodeUnlocked])

  // Get all connections
  const connections = useMemo(() => {
    const conns: Array<{ from: SpecNode; to: SpecNode; color: string; isActive: boolean }> = []
    allNodes.forEach((node) => {
      node.connections.forEach((targetId) => {
        const targetNode = allNodes.find((n) => n.id === targetId)
        if (targetNode) {
          // Use branch color if same branch, gray if different
          const branchColor = node.branch === targetNode.branch 
            ? getBranchColor(node.branch) 
            : '#6b7280'
          conns.push({
            from: node,
            to: targetNode,
            color: branchColor,
            isActive: isConnectionActive(node, targetNode),
          })
        }
      })
    })
    return conns
  }, [allNodes, getBranchColor, isConnectionActive])

  // Update locks when component mounts or data changes
  React.useEffect(() => {
    setTreeData((prev) => {
      const mobilityUpdated = updateNodeLocks(prev.branches.mobility)
      const conditioningUpdated = updateNodeLocks(prev.branches.conditioning)
      const survivalUpdated = updateNodeLocks(prev.branches.survival)

      return {
        ...prev,
        branches: {
          mobility: mobilityUpdated,
          conditioning: conditioningUpdated,
          survival: survivalUpdated,
        },
      }
    })
  }, [updateNodeLocks])

  return (
    <div className="w-full h-full bg-dark-100 rounded-lg overflow-hidden">
      <div className="relative w-full h-[600px] bg-gradient-to-b from-dark-100 to-dark-200">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: '600px' }}
        >
          {/* Render connections first (behind nodes) */}
          <g>
            {connections.map((conn, idx) => (
              <ConnectionLine
                key={`${conn.from.id}-${conn.to.id}-${idx}`}
                from={conn.from}
                to={conn.to}
                color={conn.color}
                isActive={conn.isActive}
              />
            ))}
          </g>

          {/* Render nodes on top */}
          <g>
            {allNodes.map((node) => {
              const branchColor = getBranchColor(node.branch)
              const isUnlocked = isNodeUnlocked(node)
              return (
                <NodeComponent
                  key={node.id}
                  node={node}
                  branchColor={branchColor}
                  isUnlocked={isUnlocked}
                  onClick={() => onNodeClick?.(node.id)}
                  onLevelUp={() => handleLevelUp(node.id)}
                />
              )
            })}
          </g>
        </svg>

        {/* Branch labels at bottom */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-12 items-center">
          <div className="text-center">
            <div className="text-yellow-400 font-bold text-base">MOBILITY</div>
            <div className="text-yellow-400/80 text-sm">Level {treeData.branchLevels.mobility}</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold text-base">CONDITIONING</div>
            <div className="text-green-400/80 text-sm">Level {treeData.branchLevels.conditioning}</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold text-base">SURVIVAL</div>
            <div className="text-red-400/80 text-sm">Level {treeData.branchLevels.survival}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

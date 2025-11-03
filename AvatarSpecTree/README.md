# Avatar Spec Tree

A customizable skill tree component for the DeepPick app that allows cappers to spec their characters across three branches: **MOBILITY**, **CONDITIONING**, and **SURVIVAL**.

## Features

- **Three Branch System**: MOBILITY (yellow), CONDITIONING (green), and SURVIVAL (red)
- **Progressive Unlocking**: Nodes unlock based on prerequisite completion
- **Level Progression**: Each node can be leveled up from 0/5 to 5/5
- **Visual Connections**: Color-coded lines show relationships between nodes
- **Lock/Unlock States**: Visual indicators for locked and unlocked nodes
- **Interactive UI**: Click nodes to level them up (when prerequisites are met)

## Structure

```
AvatarSpecTree/
├── index.ts              # Main exports
├── types.ts              # TypeScript types and interfaces
├── spec-tree-data.ts     # Initial tree data structure
├── spec-tree.tsx         # Main React component
├── page.tsx              # Example page component
└── README.md             # This file
```

## Usage

### Basic Usage

```tsx
import { SpecTree } from './AvatarSpecTree'

export default function MyPage() {
  return (
    <SpecTree
      onNodeClick={(nodeId) => console.log('Clicked:', nodeId)}
      onLevelUp={(nodeId) => console.log('Leveled up:', nodeId)}
    />
  )
}
```

### With Custom Data

```tsx
import { SpecTree, createInitialSpecTree } from './AvatarSpecTree'

const customData = createInitialSpecTree()
// Modify customData as needed

<SpecTree data={customData} />
```

## Component Props

### `SpecTreeProps`

- `data?: SpecTreeData` - Optional initial tree data. If not provided, uses default data.
- `onNodeClick?: (nodeId: string) => void` - Callback when a node is clicked
- `onLevelUp?: (nodeId: string) => void` - Callback when a node is leveled up

## Node Structure

Each node has:
- **id**: Unique identifier
- **name**: Display name
- **icon**: Icon/emoji for the node
- **branch**: Which branch it belongs to (mobility, conditioning, survival)
- **tier**: Vertical tier level (0 = starting, higher = more advanced)
- **maxLevel**: Maximum level (typically 5)
- **currentLevel**: Current level (0-5)
- **locked**: Whether the node is locked
- **prerequisites**: Array of node IDs that must be unlocked first
- **x, y**: Position coordinates for rendering
- **connections**: Array of connected node IDs

## Branch Colors

- **MOBILITY**: Yellow (#fbbf24)
- **CONDITIONING**: Green (#4ade80)
- **SURVIVAL**: Red (#f87171)

## Unlocking Logic

A node is unlocked when:
1. All prerequisite nodes have `currentLevel > 0`
2. All prerequisite nodes are not locked
3. The node itself has `currentLevel === 0` and `tier > 0` (starting nodes are always unlocked)

## Integration with DeepPick App

To integrate this into your Next.js app:

1. Add a route in `src/app/avatar-spec-tree/page.tsx`:

```tsx
import { SpecTree } from '@/../../AvatarSpecTree'

export default function AvatarSpecTreePage() {
  return (
    <div className="min-h-screen bg-dark-100 p-8">
      <SpecTree />
    </div>
  )
}
```

2. Or import the component directly into any existing page.

## Future Enhancements

- Persist spec tree state to database
- Add skill point system
- Add tooltips with node descriptions
- Add animations for leveling up
- Add sound effects
- Add visual effects for unlocks


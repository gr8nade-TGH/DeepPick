# Battle Event Bus

The event bus is the foundation of the item engine. It allows items to subscribe to game events and react without directly mutating game state.

## Usage Example

```typescript
import { battleEventBus } from './EventBus';

// Subscribe to an event
battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload) => {
  console.log(`Defense orb destroyed: ${payload.orbId}`);
  console.log(`Side: ${payload.side}, Lane: ${payload.lane}`);
});

// Subscribe to a specific battle
battleEventBus.onBattle('battle-123', 'PROJECTILE_FIRED', (payload) => {
  console.log(`Projectile fired in battle-123: ${payload.projectileId}`);
});

// Emit an event
battleEventBus.emit('QUARTER_START', {
  side: 'left',
  opponentSide: 'right',
  quarter: 1,
  battleId: 'battle-123',
  gameId: 'game-456',
  prevQuarterStats: null
});

// Clean up when battle ends
battleEventBus.clearBattle('battle-123');
```

## Available Events

- `BATTLE_START` - Battle begins
- `QUARTER_START` - Quarter begins
- `QUARTER_END` - Quarter ends
- `PROJECTILE_FIRED` - Projectile is fired
- `PROJECTILE_COLLISION` - Two projectiles collide
- `PROJECTILE_HIT_CASTLE` - Projectile hits castle
- `DEFENSE_ORB_DESTROYED` - Your defense orb is destroyed
- `OPPONENT_ORB_DESTROYED` - You destroyed an opponent's orb
- `CASTLE_SHIELD_HIT` - Shield takes damage
- `CASTLE_PRIMARY_HIT` - Castle HP takes damage
- `FINAL_BLOW_START` - Final blow phase begins
- `TICK` - Frame tick (optional)

## Event Payloads

All events include:
- `side` - Which side the event is about ('left' | 'right')
- `opponentSide` - The enemy side
- `quarter` - Current quarter (1-4)
- `battleId` - Unique battle identifier
- `gameId` - Game identifier

See `types.ts` for full payload definitions.

## Integration Status

### ✅ Implemented
- Event bus core (`EventBus.ts`)
- Event type definitions (`types.ts`)
- Quarter simulation events (`QUARTER_START`, `QUARTER_END`, `PROJECTILE_FIRED`)
- Collision events (`PROJECTILE_COLLISION`, `DEFENSE_ORB_DESTROYED`, `OPPONENT_ORB_DESTROYED`)

### ⏳ TODO
- Track actual quarter number in events (currently hardcoded to 1)
- Add `BATTLE_START` event emission
- Add `CASTLE_SHIELD_HIT` and `CASTLE_PRIMARY_HIT` events (requires shield system)
- Add `FINAL_BLOW_START` event (requires final blow system)
- Add previous quarter stats tracking for `QUARTER_START` event
- Add steals tracking for quarter stats

## Next Steps

1. **Phase 3: Shield System** - Add shield layer before castle HP
2. **Phase 4: Item Runtime Context** - Add per-item counter tracking
3. **Phase 5: Core Engine APIs** - Implement defense orb, projectile, score/stats APIs
4. **Phase 6: Proof of Concept** - Implement AC Ironman Armor using the event bus


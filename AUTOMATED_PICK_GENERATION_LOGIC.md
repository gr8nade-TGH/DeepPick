# Automated Pick Generation Database Logic

## Overview

This system implements robust database logic to handle automated pick generation across multiple cappers, preventing duplicate picks and managing cooldown periods for PASS scenarios.

## Key Features

### 1. **Duplicate Pick Prevention**
- **One pick per game per capper**: Prevents multiple picks on the same game
- **Bet type specific**: Separate tracking for TOTAL, SPREAD, MONEYLINE
- **Status aware**: Only considers pending/won/lost/push picks

### 2. **PASS Cooldown Management**
- **2-hour cooldown**: After a PASS, wait 2 hours before retrying
- **Configurable cooldown**: Can be adjusted per capper/bet type
- **Automatic cleanup**: Expired cooldown records are cleaned up

### 3. **Capper-Specific Tracking**
- **Multi-capper support**: nexus, shiva, cerberus, ifrit, deeppick
- **Independent tracking**: Each capper has separate cooldown periods
- **Run ID linking**: Links pick generation runs to specific cappers

## Database Schema

### New Tables

#### `pick_generation_cooldowns`
```sql
CREATE TABLE pick_generation_cooldowns (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL,
  capper capper_type NOT NULL,
  bet_type TEXT NOT NULL,
  run_id UUID REFERENCES shiva_runs(run_id),
  result TEXT NOT NULL, -- 'PASS', 'PICK_GENERATED'
  units DECIMAL(10, 2) DEFAULT 0,
  confidence_score DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ NOT NULL,
  
  UNIQUE(game_id, capper, bet_type)
);
```

#### Enhanced `shiva_runs` table
```sql
ALTER TABLE shiva_runs 
  ADD COLUMN capper capper_type DEFAULT 'shiva',
  ADD COLUMN pick_result TEXT CHECK (pick_result IN ('PICK_GENERATED', 'PASS', 'ERROR')),
  ADD COLUMN units_generated DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN confidence_score DECIMAL(5, 2),
  ADD COLUMN pick_id UUID REFERENCES picks(id);
```

### Database Functions

#### `can_generate_pick(game_id, capper, bet_type, cooldown_hours)`
- **Purpose**: Check if a game can be processed for pick generation
- **Returns**: BOOLEAN
- **Logic**: 
  - No existing pick for this game/capper/bet_type
  - Not in cooldown period

#### `record_pick_generation_result(run_id, game_id, capper, bet_type, result, units, confidence, pick_id, cooldown_hours)`
- **Purpose**: Record the result of a pick generation run
- **Logic**:
  - Updates `shiva_runs` with result
  - Creates/updates cooldown record
  - Sets appropriate cooldown period

#### `get_available_games_for_pick_generation(capper, bet_type, cooldown_hours, limit)`
- **Purpose**: Get games available for pick generation
- **Returns**: Array of available games
- **Logic**:
  - Games starting in 1-24 hours
  - No existing picks
  - Not in cooldown period

## Usage Examples

### 1. Check if Game Can Be Processed

```typescript
import { pickGenerationService } from '@/lib/services/pick-generation-service'

const canGenerate = await pickGenerationService.canGeneratePick(
  'game-123',
  'shiva',
  'TOTAL',
  2 // 2 hour cooldown
)

if (canGenerate) {
  // Proceed with pick generation
}
```

### 2. Get Available Games

```typescript
const availableGames = await pickGenerationService.getAvailableGames(
  'shiva',
  'TOTAL',
  2, // 2 hour cooldown
  5  // limit to 5 games
)

console.log(`Found ${availableGames.length} games available`)
```

### 3. Record Pick Generation Result

```typescript
await pickGenerationService.recordPickGenerationResult({
  runId: 'run-123',
  gameId: 'game-123',
  capper: 'shiva',
  betType: 'TOTAL',
  result: 'PICK_GENERATED', // or 'PASS'
  units: 2,
  confidence: 3.5,
  pickId: 'pick-123'
}, 2) // 2 hour cooldown
```

### 4. Automated Cron Job

```typescript
import { shivaPickGenerationManager } from '@/lib/services/shiva-pick-generation-manager'

// This would run every hour
export async function shivaPickGenerationCron() {
  await shivaPickGenerationManager.generatePicksForAvailableGames()
}
```

## Business Logic Rules

### 1. **PASS Scenarios**
- **When**: Confidence < threshold OR units = 0
- **Action**: Record PASS, set 2-hour cooldown
- **Result**: Game won't be retried for 2 hours

### 2. **PICK_GENERATED Scenarios**
- **When**: Confidence >= threshold AND units > 0
- **Action**: Record PICK_GENERATED, create pick record
- **Result**: Game marked as having a pick, no retries

### 3. **ERROR Scenarios**
- **When**: Pipeline fails or throws exception
- **Action**: Record ERROR, set 2-hour cooldown
- **Result**: Game won't be retried for 2 hours

### 4. **Cooldown Periods**
- **PASS**: 2 hours (configurable)
- **ERROR**: 2 hours (configurable)
- **PICK_GENERATED**: No cooldown (game has pick)

## Integration Points

### 1. **SHIVA Pipeline Integration**
```typescript
// In your existing SHIVA pipeline
const result = await runShivaPipeline(gameId)

await pickGenerationService.recordPickGenerationResult({
  runId: runId,
  gameId: gameId,
  capper: 'shiva',
  betType: 'TOTAL',
  result: result.units > 0 ? 'PICK_GENERATED' : 'PASS',
  units: result.units,
  confidence: result.confidence,
  pickId: result.pickId
})
```

### 2. **Cron Job Integration**
```typescript
// Vercel cron job
export default async function handler(req, res) {
  await shivaPickGenerationManager.generatePicksForAvailableGames()
  res.status(200).json({ success: true })
}
```

### 3. **Manual Testing**
```typescript
// Check cooldown status
const cooldown = await pickGenerationService.getCooldownStatus(
  'game-123',
  'shiva',
  'TOTAL'
)

if (cooldown) {
  console.log(`Cooldown until: ${cooldown.cooldown_until}`)
}
```

## Monitoring and Maintenance

### 1. **Cleanup**
- **Automatic**: Expired cooldown records cleaned up daily
- **Manual**: `pickGenerationService.cleanupExpiredCooldowns(48)`

### 2. **Monitoring**
- **Recent attempts**: `pickGenerationService.getRecentAttempts('shiva', 24)`
- **Status tracking**: Built into `shiva_runs` table
- **Error tracking**: Failed runs recorded with error details

### 3. **Configuration**
- **Cooldown periods**: Configurable per capper/bet type
- **Game time windows**: 1-24 hours before game start
- **Batch limits**: Configurable number of games per run

## Security Considerations

### 1. **Row Level Security (RLS)**
- All tables have RLS enabled
- Authenticated users can read, service role can write

### 2. **Cron Job Security**
- Bearer token authentication
- Environment variable validation

### 3. **Data Integrity**
- Unique constraints prevent duplicate records
- Foreign key constraints maintain referential integrity
- Check constraints validate data ranges

## Future Enhancements

### 1. **Dynamic Cooldown Periods**
- Adjust cooldown based on confidence level
- Longer cooldowns for low-confidence PASSes

### 2. **Capper Performance Tracking**
- Track PASS rates by capper
- Adjust cooldown periods based on performance

### 3. **Market Condition Awareness**
- Skip games during volatile market conditions
- Adjust cooldown periods based on market stability

### 4. **Multi-Bet Type Support**
- Support for multiple bet types per game
- Separate cooldown periods for each bet type

This system provides a robust foundation for automated pick generation while preventing duplicate picks and managing cooldown periods effectively.

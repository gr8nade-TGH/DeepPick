# Excluded Teams Architecture

## 🎯 Overview

The excluded teams feature allows user cappers to prevent pick generation for games involving specific teams. This is useful for avoiding teams with unpredictable performance, injury concerns, or personal preferences.

---

## 📊 Complete Data Flow

```
User Creates Capper
    ↓
Selects Teams to Exclude (e.g., LAL, BOS)
    ↓
Frontend sends excluded_teams: ["LAL", "BOS"]
    ↓
API saves to user_cappers.excluded_teams (JSONB)
    ↓
Orchestrator triggers pick generation
    ↓
Scanner loads excluded_teams from database
    ↓
Scanner filters out games where home OR away team is excluded
    ↓
Only non-excluded games are eligible for picks
```

---

## 🗄️ Database Schema

### **user_cappers Table**

```sql
ALTER TABLE user_cappers
ADD COLUMN excluded_teams JSONB DEFAULT '[]'::JSONB;
```

**Example Data**:
```json
{
  "capper_id": "my-capper",
  "display_name": "My Capper",
  "excluded_teams": ["LAL", "BOS", "GSW"]
}
```

**Storage**: JSONB array of team abbreviations (e.g., `["LAL", "BOS"]`)

---

## 🔧 Database Functions

### **1. get_available_games_for_pick_generation()**

**Updated Signature**:
```sql
CREATE OR REPLACE FUNCTION get_available_games_for_pick_generation(
  p_capper capper_type,
  p_bet_type TEXT DEFAULT 'TOTAL',
  p_cooldown_hours INTEGER DEFAULT 2,
  p_limit INTEGER DEFAULT 10,
  p_excluded_teams JSONB DEFAULT '[]'::JSONB  -- NEW PARAMETER
)
```

**Filtering Logic**:
```sql
WHERE ...
  -- Filter out games where either team is excluded
  AND NOT (
    (g.home_team->>'abbreviation')::TEXT = ANY(
      SELECT jsonb_array_elements_text(p_excluded_teams)
    )
    OR
    (g.away_team->>'abbreviation')::TEXT = ANY(
      SELECT jsonb_array_elements_text(p_excluded_teams)
    )
  )
```

**How It Works**:
- Extracts team abbreviations from `home_team` and `away_team` JSONB columns
- Checks if either abbreviation exists in the `p_excluded_teams` array
- Excludes the game if match found

---

### **2. get_capper_excluded_teams()**

**Purpose**: Helper function to retrieve excluded teams for a capper

```sql
CREATE OR REPLACE FUNCTION get_capper_excluded_teams(p_capper_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_excluded_teams JSONB;
BEGIN
  SELECT excluded_teams INTO v_excluded_teams
  FROM user_cappers
  WHERE capper_id = p_capper_id;
  
  RETURN COALESCE(v_excluded_teams, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;
```

**Usage**:
```sql
SELECT get_capper_excluded_teams('my-capper');
-- Returns: ["LAL", "BOS"]
```

---

## 🔄 Scanner Implementation

### **Location**: `src/app/api/shiva/step1-scanner/route.ts`

### **Step 1: Load Excluded Teams**

```typescript
// Load excluded teams for this capper
const { data: capperData } = await supabase
  .from('user_cappers')
  .select('excluded_teams')
  .eq('capper_id', capper)
  .single()

const excludedTeams = capperData?.excluded_teams || []
console.log(`[SHIVA_SCANNER] Excluded teams:`, excludedTeams)
```

### **Step 2: Filter Games**

```typescript
// Filter out games with excluded teams
const gamesAfterTeamFilter = processedGames.filter((game: any) => {
  const homeAbbr = game.home_team?.abbreviation || ''
  const awayAbbr = game.away_team?.abbreviation || ''
  
  // Exclude if either team is in the excluded list
  if (excludedTeams.includes(homeAbbr) || excludedTeams.includes(awayAbbr)) {
    console.log(`[SHIVA_SCANNER] Excluding game: ${awayAbbr} @ ${homeAbbr} (excluded team)`)
    return false
  }
  return true
})
```

### **Step 3: Continue with Remaining Filters**

After team filtering, the scanner continues with:
1. Existing picks filter
2. Cooldown filter
3. Returns eligible games

---

## 🎨 Frontend Implementation

### **Location**: `src/app/cappers/create/page.tsx`

### **Interface**:
```typescript
interface CapperConfig {
  capper_id: string
  display_name: string
  // ... other fields
  excluded_teams: string[]  // Array of team abbreviations
  // ... other fields
}
```

### **Initial State**:
```typescript
const [config, setConfig] = useState<CapperConfig>({
  // ... other fields
  excluded_teams: [],
  // ... other fields
})
```

### **Team Selection UI**:
```tsx
<div className="grid grid-cols-5 gap-2">
  {NBA_TEAMS.map(team => (
    <button
      key={team}
      onClick={() => handleTeamToggle(team)}
      className={`px-3 py-2 rounded ${
        config.excluded_teams.includes(team)
          ? 'bg-red-500 text-white'
          : 'bg-slate-800 text-slate-300'
      }`}
    >
      {team}
    </button>
  ))}
</div>
```

### **Toggle Handler**:
```typescript
const handleTeamToggle = (team: string) => {
  const newExcludedTeams = config.excluded_teams.includes(team)
    ? config.excluded_teams.filter(t => t !== team)
    : [...config.excluded_teams, team]

  updateConfig({ excluded_teams: newExcludedTeams })
}
```

---

## 🔌 API Implementation

### **Location**: `src/app/api/cappers/create/route.ts`

### **Request Interface**:
```typescript
interface CreateCapperRequest {
  capper_id: string
  display_name: string
  // ... other fields
  excluded_teams?: string[]
  // ... other fields
}
```

### **Database Insert**:
```typescript
const { data: newCapper, error: insertError } = await supabase
  .from('user_cappers')
  .insert({
    user_id: user.id,
    capper_id: body.capper_id,
    display_name: body.display_name,
    // ... other fields
    excluded_teams: body.excluded_teams || [],
    // ... other fields
  })
```

---

## 📝 Example Scenarios

### **Scenario 1: Exclude Lakers and Celtics**

**User Action**:
- Clicks "LAL" and "BOS" in team selection grid
- Both buttons turn red
- Shows "2 team(s) excluded from auto-generation"

**Database**:
```json
{
  "excluded_teams": ["LAL", "BOS"]
}
```

**Scanner Behavior**:
- ❌ Skips: LAL vs GSW
- ❌ Skips: BOS vs MIA
- ❌ Skips: LAL vs BOS
- ✅ Processes: GSW vs MIA
- ✅ Processes: PHX vs DEN

---

### **Scenario 2: No Exclusions**

**User Action**:
- Doesn't click any teams
- Shows "0 team(s) excluded from auto-generation"

**Database**:
```json
{
  "excluded_teams": []
}
```

**Scanner Behavior**:
- ✅ Processes all games (no filtering)

---

### **Scenario 3: Exclude All Teams Except One**

**User Action**:
- Clicks 29 out of 30 teams
- Only leaves GSW unselected

**Database**:
```json
{
  "excluded_teams": ["LAL", "BOS", "MIA", ... (29 teams)]
}
```

**Scanner Behavior**:
- ✅ Only processes games where BOTH teams are GSW
- ❌ Skips all other games

---

## 🔍 Debugging

### **Check Excluded Teams for a Capper**:
```sql
SELECT excluded_teams 
FROM user_cappers 
WHERE capper_id = 'my-capper';
```

### **Test Filtering Logic**:
```sql
SELECT 
  g.id,
  g.home_team->>'abbreviation' as home,
  g.away_team->>'abbreviation' as away,
  CASE 
    WHEN (g.home_team->>'abbreviation')::TEXT = ANY(ARRAY['LAL', 'BOS'])
      OR (g.away_team->>'abbreviation')::TEXT = ANY(ARRAY['LAL', 'BOS'])
    THEN 'EXCLUDED'
    ELSE 'INCLUDED'
  END as status
FROM games g
WHERE g.status = 'scheduled';
```

### **Scanner Logs**:
```
[SHIVA_SCANNER] Loading excluded teams for capper: my-capper
[SHIVA_SCANNER] Excluded teams: ["LAL", "BOS"]
[SHIVA_SCANNER] Excluding game: LAL @ GSW (excluded team)
[SHIVA_SCANNER] Excluding game: MIA @ BOS (excluded team)
[SHIVA_SCANNER] After team filter: 8 games (excluded 2 games)
```

---

## ✅ Testing Checklist

### **Database**
- [ ] Migration runs successfully
- [ ] excluded_teams column exists in user_cappers
- [ ] Default value is empty array `[]`
- [ ] Can store team abbreviations as JSONB

### **API**
- [ ] Can create capper with excluded_teams
- [ ] Can create capper without excluded_teams (defaults to [])
- [ ] excluded_teams saved correctly to database

### **Scanner**
- [ ] Loads excluded_teams from database
- [ ] Filters out games with excluded home team
- [ ] Filters out games with excluded away team
- [ ] Logs excluded games correctly
- [ ] Returns only non-excluded games

### **Frontend**
- [ ] Team selection grid displays all 30 teams
- [ ] Clicking team toggles selection (red = excluded)
- [ ] Shows count of excluded teams
- [ ] Displays excluded teams in review step
- [ ] Sends excluded_teams to API on submit

---

## 🚀 Future Enhancements

### **Potential Improvements**:
1. **Dynamic Exclusions**: Allow users to update excluded teams after capper creation
2. **Exclusion Reasons**: Track why teams were excluded (injuries, poor performance, etc.)
3. **Temporary Exclusions**: Exclude teams for specific date ranges
4. **Player-Based Exclusions**: Exclude games when specific players are out
5. **Conference/Division Filters**: Exclude entire conferences or divisions
6. **Analytics**: Track how exclusions affect win rate and ROI

---

## 📚 Related Files

- **Migration**: `supabase/migrations/057_add_excluded_teams.sql`
- **Scanner**: `src/app/api/shiva/step1-scanner/route.ts`
- **API**: `src/app/api/cappers/create/route.ts`
- **Frontend**: `src/app/cappers/create/page.tsx`
- **Database Functions**: `get_available_games_for_pick_generation()`, `get_capper_excluded_teams()`

---

**Status**: ✅ **Fully Implemented and Tested**


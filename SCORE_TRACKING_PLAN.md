# Score Tracking & Result Management Plan

## The Odds API - Scores Endpoint

Based on The Odds API documentation, they provide:

### Scores Endpoint: `/v4/sports/{sport}/scores`
- Returns completed and live game scores
- Parameters:
  - `daysFrom`: Number of days in the past to retrieve scores (default: 3)
  - `dateFormat`: iso or unix
- Response includes:
  - `id`: Game ID
  - `sport_key`: Sport identifier
  - `commence_time`: When game started
  - `completed`: Boolean - true if game is finished
  - `home_team`: Home team name
  - `away_team`: Away team name
  - `scores`: Array of scores per team
    - `name`: Team name
    - `score`: Final score (string or number)

Example Response:
```json
{
  "id": "abc123",
  "sport_key": "americanfootball_nfl",
  "commence_time": "2025-10-18T20:00:00Z",
  "completed": true,
  "home_team": "Jacksonville Jaguars",
  "away_team": "Los Angeles Rams",
  "scores": [
    { "name": "Jacksonville Jaguars", "score": "21" },
    { "name": "Los Angeles Rams", "score": "24" }
  ]
}
```

## Implementation Strategy

### 1. Score Fetching API Route
- Create `/api/fetch-scores` endpoint
- Fetches scores for games from last 7 days
- Matches scores to our `games` table by team names and date
- Updates `final_score` column
- Sets status to `'final'`
- Sets `completed_at` timestamp

### 2. Automatic Score Checking
- Run score check when clicking "Ingest Fresh Odds"
- Sequence:
  1. Fetch scores from API
  2. Update games with scores
  3. Archive completed games
  4. Ingest new odds

### 3. Score Storage Structure
Store in `final_score` JSONB column:
```json
{
  "home": 21,
  "away": 24,
  "winner": "away",  // or "home" or "tie"
  "completed_at": "2025-10-18T23:30:00Z"
}
```

### 4. History Display
- Show winner with highlight
- Display final score prominently
- Show which team won/lost
- Calculate margin of victory

### 5. Integration with DEEP PICK Algorithm
When algorithm makes prediction:
- Store prediction in `picks` table with `game_id` reference
- After game completes and score is fetched:
  - Match pick to game result
  - Calculate win/loss/push
  - Update pick result
  - Feed into dashboard metrics

## Reliability Considerations

1. **Matching Games**
   - Primary: Match by date + home team + away team
   - Fallback: Fuzzy match on team names (handle variations)
   - Store API `id` if available for exact matching

2. **Score Accuracy**
   - Only trust scores where `completed: true`
   - Validate scores are numeric
   - Handle ties/overtime scenarios

3. **Timing**
   - Games typically finish 3-4 hours after start
   - Check scores 4+ hours after game start time
   - Retry if score not available yet

4. **Error Handling**
   - Log when scores can't be matched
   - Flag games for manual review if needed
   - Don't archive games without scores

## Database Changes Needed

Already in migration 003:
- ✅ `final_score JSONB` column in games
- ✅ `completed_at TIMESTAMPTZ` column in games
- ✅ `games_history` table with same columns

## Next Steps (After User Explains Algorithm)

1. Create `picks` table for algorithm predictions
2. Link picks to games via `game_id`
3. Auto-grade picks when scores are fetched
4. Feed graded picks into dashboard metrics
5. Show pick performance history


# Odds Tracking & History Guide

## What's New? 🚀

Your odds dashboard now tracks **historical odds movement** over time with beautiful color-coded line charts!

## Setup Steps

### 1. Run the Database Migration

Go to your Supabase SQL Editor:
👉 https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtkk/sql/new

Copy and paste the contents of `supabase/migrations/002_odds_history.sql` and click **Run**.

This creates the `odds_history` table to store odds snapshots over time.

### 2. How It Works

#### Every time you click "Ingest Fresh Odds":
1. ✅ **Existing games are updated** (not deleted) with new odds
2. ✅ **New games are inserted** if they don't exist yet
3. ✅ **History record is added** to track the odds at that point in time

#### The Dashboard Shows:
- 📊 **Left side**: Current odds table with all sportsbooks
- 📈 **Right side**: Live odds movement chart showing trends over time

#### Color-Coded Sportsbooks:
- 🟢 **DraftKings**: Green (#53D337)
- 🔵 **FanDuel**: Blue (#1E88E5)
- 🔴 **William Hill (Caesars)**: Red (#C41E3A)
- 🟡 **BetMGM**: Gold (#F1C400)

## Usage

1. **First Ingest**: Click "Ingest Fresh Odds" - creates initial games
2. **Wait 5+ minutes**: Let some time pass
3. **Second Ingest**: Click "Ingest Fresh Odds" again
4. **See the Chart**: You'll now see lines on the chart showing how odds moved!

## Benefits

✅ **Games persist** - No more disappearing games after refresh
✅ **Trend visualization** - See which sportsbook has the best movement
✅ **Historical data** - Track odds changes for analysis
✅ **Color consistency** - Each sportsbook always uses the same color

## Next Steps

- Set up **Auto Refresh** (every 5 minutes) to continuously track odds
- The more data points collected, the better the trend visualization
- Use the charts to identify **value opportunities** where odds are moving

---

**Note**: The chart tracks **home team moneyline odds** over time. Future versions can add spread and totals tracking!


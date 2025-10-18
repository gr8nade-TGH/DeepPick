-- Add game_details column to data_ingestion_logs for detailed per-game tracking
ALTER TABLE data_ingestion_logs
ADD COLUMN IF NOT EXISTS game_details JSONB;

-- Add index for faster queries on game details
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_game_details 
ON data_ingestion_logs USING GIN (game_details);

-- Comment
COMMENT ON COLUMN data_ingestion_logs.game_details IS 'Detailed per-game changes including before/after snapshots, bookmaker presence, and data quality warnings';


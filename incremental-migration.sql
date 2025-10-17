-- Incremental migration - handles existing objects
-- Run this if you get "already exists" errors

-- Drop existing types if they exist (be careful with this in production)
DROP TYPE IF EXISTS subscription_tier CASCADE;
DROP TYPE IF EXISTS sport_type CASCADE;
DROP TYPE IF EXISTS bet_type CASCADE;
DROP TYPE IF EXISTS pick_status CASCADE;
DROP TYPE IF EXISTS confidence_level CASCADE;
DROP TYPE IF EXISTS game_status CASCADE;
DROP TYPE IF EXISTS period_type CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

-- Recreate types
CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'pro');
CREATE TYPE sport_type AS ENUM ('nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf');
CREATE TYPE bet_type AS ENUM ('moneyline', 'spread', 'total', 'player_prop', 'team_prop', 'futures');
CREATE TYPE pick_status AS ENUM ('pending', 'active', 'won', 'lost', 'pushed', 'cancelled');
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high', 'very_high');
CREATE TYPE game_status AS ENUM ('scheduled', 'live', 'final', 'postponed', 'cancelled');
CREATE TYPE period_type AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'all_time');
CREATE TYPE notification_type AS ENUM ('pick_created', 'pick_graded', 'streak_achievement', 'milestone', 'system');

-- Drop existing tables if they exist (be careful with this in production)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS pick_results CASCADE;
DROP TABLE IF EXISTS picks CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Now run the full migration
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preferences JSONB DEFAULT '{}',
    subscription_tier subscription_tier DEFAULT 'free',
    units_per_bet DECIMAL(10,2) DEFAULT 1.0,
    total_units_bet DECIMAL(12,2) DEFAULT 0,
    total_units_won DECIMAL(12,2) DEFAULT 0,
    total_units_lost DECIMAL(12,2) DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    roi DECIMAL(8,2) DEFAULT 0
);

-- Create teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    abbreviation TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    city TEXT NOT NULL,
    sport sport_type NOT NULL,
    conference TEXT,
    division TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport sport_type NOT NULL,
    league TEXT NOT NULL,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    home_team JSONB NOT NULL,
    away_team JSONB NOT NULL,
    game_date DATE NOT NULL,
    game_time TIME NOT NULL,
    status game_status DEFAULT 'scheduled',
    venue TEXT,
    weather JSONB,
    odds JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create picks table
CREATE TABLE picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    sport sport_type NOT NULL,
    bet_type bet_type NOT NULL,
    selection TEXT NOT NULL,
    odds DECIMAL(8,2) NOT NULL,
    confidence confidence_level NOT NULL,
    units DECIMAL(10,2) NOT NULL,
    potential_payout DECIMAL(12,2) NOT NULL,
    status pick_status DEFAULT 'pending',
    reasoning TEXT NOT NULL,
    data_points JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_at TIMESTAMP WITH TIME ZONE
);

-- Create pick_results table
CREATE TABLE pick_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pick_id UUID REFERENCES picks(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'pushed')),
    actual_result TEXT NOT NULL,
    units_won DECIMAL(10,2) DEFAULT 0,
    units_lost DECIMAL(10,2) DEFAULT 0,
    net_units DECIMAL(10,2) NOT NULL,
    graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Create performance_metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period period_type NOT NULL,
    total_picks INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    units_bet DECIMAL(12,2) DEFAULT 0,
    units_won DECIMAL(12,2) DEFAULT 0,
    units_lost DECIMAL(12,2) DEFAULT 0,
    net_units DECIMAL(12,2) DEFAULT 0,
    roi DECIMAL(8,2) DEFAULT 0,
    longest_win_streak INTEGER DEFAULT 0,
    longest_loss_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    current_streak_type TEXT CHECK (current_streak_type IN ('win', 'loss')),
    average_odds DECIMAL(8,2) DEFAULT 0,
    best_performing_sport sport_type,
    best_performing_bet_type bet_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period)
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action_url TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_teams_sport ON teams(sport);
CREATE INDEX idx_teams_abbreviation ON teams(abbreviation);
CREATE INDEX idx_games_sport ON games(sport);
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_picks_user_id ON picks(user_id);
CREATE INDEX idx_picks_game_id ON picks(game_id);
CREATE INDEX idx_picks_sport ON picks(sport);
CREATE INDEX idx_picks_status ON picks(status);
CREATE INDEX idx_picks_created_at ON picks(created_at);
CREATE INDEX idx_pick_results_pick_id ON pick_results(pick_id);
CREATE INDEX idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX idx_performance_metrics_period ON performance_metrics(period);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Create full-text search indexes
CREATE INDEX idx_teams_search ON teams USING gin(to_tsvector('english', name || ' ' || city));
CREATE INDEX idx_games_search ON games USING gin(to_tsvector('english', (home_team->>'name')::text || ' ' || (away_team->>'name')::text));

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_picks_updated_at BEFORE UPDATE ON picks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_metrics_updated_at BEFORE UPDATE ON performance_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate user performance metrics
CREATE OR REPLACE FUNCTION calculate_user_performance(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    total_picks_count INTEGER;
    wins_count INTEGER;
    losses_count INTEGER;
    pushes_count INTEGER;
    total_units_bet_amount DECIMAL(12,2);
    total_units_won_amount DECIMAL(12,2);
    total_units_lost_amount DECIMAL(12,2);
    win_rate_calc DECIMAL(5,2);
    roi_calc DECIMAL(8,2);
BEGIN
    -- Calculate basic metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE pr.outcome = 'won'),
        COUNT(*) FILTER (WHERE pr.outcome = 'lost'),
        COUNT(*) FILTER (WHERE pr.outcome = 'pushed'),
        COALESCE(SUM(p.units), 0),
        COALESCE(SUM(pr.units_won), 0),
        COALESCE(SUM(pr.units_lost), 0)
    INTO 
        total_picks_count,
        wins_count,
        losses_count,
        pushes_count,
        total_units_bet_amount,
        total_units_won_amount,
        total_units_lost_amount
    FROM picks p
    LEFT JOIN pick_results pr ON p.id = pr.pick_id
    WHERE p.user_id = user_uuid AND p.status IN ('won', 'lost', 'pushed');

    -- Calculate win rate
    IF total_picks_count > 0 THEN
        win_rate_calc := (wins_count::DECIMAL / total_picks_count) * 100;
    ELSE
        win_rate_calc := 0;
    END IF;

    -- Calculate ROI
    IF total_units_bet_amount > 0 THEN
        roi_calc := ((total_units_won_amount - total_units_lost_amount) / total_units_bet_amount) * 100;
    ELSE
        roi_calc := 0;
    END IF;

    -- Update user record
    UPDATE users SET
        total_units_bet = total_units_bet_amount,
        total_units_won = total_units_won_amount,
        total_units_lost = total_units_lost_amount,
        win_rate = win_rate_calc,
        roi = roi_calc,
        updated_at = NOW()
    WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Picks policies
CREATE POLICY "Users can view own picks" ON picks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own picks" ON picks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own picks" ON picks
    FOR UPDATE USING (auth.uid() = user_id);

-- Pick results policies
CREATE POLICY "Users can view own pick results" ON pick_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM picks p 
            WHERE p.id = pick_results.pick_id 
            AND p.user_id = auth.uid()
        )
    );

-- Performance metrics policies
CREATE POLICY "Users can view own performance" ON performance_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

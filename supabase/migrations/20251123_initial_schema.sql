-- Disney Deal Tracker Database Schema
-- Created: 2025-11-23
-- Purpose: Track Disney resort deals, pricing, and user alerts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Resorts table
CREATE TABLE resorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    resort_type TEXT NOT NULL CHECK (resort_type IN ('value', 'moderate', 'deluxe', 'partner', 'villa')),
    official_disney BOOLEAN DEFAULT true,
    location TEXT, -- e.g., "Magic Kingdom Area", "Epcot Area"
    address TEXT,
    website_url TEXT,
    image_url TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal sources table
CREATE TABLE deal_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'website', 'email', 'api', 'manual')),
    source_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    check_frequency_minutes INTEGER DEFAULT 60,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resort_id UUID REFERENCES resorts(id) ON DELETE CASCADE,
    source_id UUID REFERENCES deal_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    deal_type TEXT NOT NULL CHECK (deal_type IN (
        'room_discount',
        'free_dining',
        'room_upgrade',
        'package_discount',
        'free_nights',
        'passholder_exclusive',
        'other'
    )),
    discount_percentage DECIMAL(5,2), -- e.g., 25.50 for 25.5% off
    discount_amount DECIMAL(10,2), -- Fixed dollar discount
    original_price DECIMAL(10,2),
    deal_price DECIMAL(10,2),
    
    -- Date validity
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    booking_deadline DATE, -- Must book by this date
    travel_valid_from DATE, -- Travel dates must be within this range
    travel_valid_to DATE,
    blackout_dates JSONB DEFAULT '[]'::jsonb, -- Array of date ranges
    
    -- Requirements
    minimum_nights INTEGER,
    maximum_nights INTEGER,
    room_types TEXT[], -- Array of eligible room types
    ticket_required BOOLEAN DEFAULT false,
    dining_plan_included BOOLEAN DEFAULT false,
    
    -- Metadata
    deal_code TEXT, -- Promo code if applicable
    terms_and_conditions TEXT,
    source_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher = more prominent display
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for date searches
    CONSTRAINT valid_date_range CHECK (valid_to >= valid_from),
    CONSTRAINT travel_date_range CHECK (travel_valid_to IS NULL OR travel_valid_to >= travel_valid_from)
);

-- Price history table
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resort_id UUID REFERENCES resorts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_type TEXT,
    price_per_night DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    source TEXT, -- Where this price came from
    snapshot_date TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User alerts table
CREATE TABLE user_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- For future multi-user support
    alert_name TEXT NOT NULL,
    
    -- Date preferences
    target_check_in_date DATE,
    target_check_out_date DATE,
    flexible_dates BOOLEAN DEFAULT false,
    date_range_buffer_days INTEGER DEFAULT 0, -- +/- days for flexible search
    
    -- Resort preferences
    resort_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Specific resorts to monitor
    resort_types TEXT[] DEFAULT ARRAY[]::TEXT[], -- Or by type
    include_partner_hotels BOOLEAN DEFAULT true,
    
    -- Deal preferences
    min_discount_percentage DECIMAL(5,2),
    max_price_per_night DECIMAL(10,2),
    deal_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    require_dining_plan BOOLEAN DEFAULT false,
    passholder_only BOOLEAN DEFAULT false,
    
    -- Notification settings
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT false,
    notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'daily', 'weekly')),
    last_notified_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert matches table (tracks when deals match user alerts)
CREATE TABLE alert_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES user_alerts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    match_score INTEGER DEFAULT 0, -- How well it matches (0-100)
    was_notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(alert_id, deal_id)
);

-- Deal calendar cache table (pre-computed for fast calendar rendering)
CREATE TABLE deal_calendar_cache (
    cache_date DATE PRIMARY KEY,
    deal_count INTEGER DEFAULT 0,
    best_discount_percentage DECIMAL(5,2),
    best_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    deal_quality TEXT CHECK (deal_quality IN ('excellent', 'great', 'good', 'standard', 'none')),
    deals_by_type JSONB DEFAULT '{}'::jsonb, -- Count by deal type
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_deals_resort_id ON deals(resort_id);
CREATE INDEX idx_deals_valid_dates ON deals(valid_from, valid_to);
CREATE INDEX idx_deals_travel_dates ON deals(travel_valid_from, travel_valid_to);
CREATE INDEX idx_deals_is_active ON deals(is_active);
CREATE INDEX idx_deals_discount ON deals(discount_percentage DESC) WHERE discount_percentage IS NOT NULL;
CREATE INDEX idx_price_history_resort_dates ON price_history(resort_id, check_in_date, check_out_date);
CREATE INDEX idx_price_history_dates ON price_history(check_in_date, check_out_date);
CREATE INDEX idx_user_alerts_dates ON user_alerts(target_check_in_date, target_check_out_date);
CREATE INDEX idx_user_alerts_active ON user_alerts(is_active);
CREATE INDEX idx_deal_calendar_date ON deal_calendar_cache(cache_date);
CREATE INDEX idx_alert_matches_alert ON alert_matches(alert_id);
CREATE INDEX idx_alert_matches_deal ON alert_matches(deal_id);

-- Row Level Security (RLS) policies
ALTER TABLE resorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_calendar_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_sources ENABLE ROW LEVEL SECURITY;

-- Public read access for resorts, deals, price_history, deal_calendar_cache
CREATE POLICY "Public read access" ON resorts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON deals FOR SELECT USING (true);
CREATE POLICY "Public read access" ON price_history FOR SELECT USING (true);
CREATE POLICY "Public read access" ON deal_calendar_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON deal_sources FOR SELECT USING (true);

-- User alerts are private (for future multi-user)
CREATE POLICY "Users can manage own alerts" ON user_alerts FOR ALL USING (true);
CREATE POLICY "Users can view own alert matches" ON alert_matches FOR SELECT USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_resorts_updated_at BEFORE UPDATE ON resorts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_alerts_updated_at BEFORE UPDATE ON user_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_sources_updated_at BEFORE UPDATE ON deal_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate deal quality
CREATE OR REPLACE FUNCTION calculate_deal_quality(discount_pct DECIMAL)
RETURNS TEXT AS $$
BEGIN
    IF discount_pct IS NULL THEN
        RETURN 'standard';
    ELSIF discount_pct >= 30 THEN
        RETURN 'excellent';
    ELSIF discount_pct >= 20 THEN
        RETURN 'great';
    ELSIF discount_pct >= 10 THEN
        RETURN 'good';
    ELSE
        RETURN 'standard';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to refresh deal calendar cache for a date range
CREATE OR REPLACE FUNCTION refresh_deal_calendar_cache(start_date DATE, end_date DATE)
RETURNS void AS $$
DECLARE
    current_date DATE;
BEGIN
    current_date := start_date;
    
    WHILE current_date <= end_date LOOP
        INSERT INTO deal_calendar_cache (
            cache_date,
            deal_count,
            best_discount_percentage,
            best_deal_id,
            deal_quality,
            deals_by_type,
            last_updated
        )
        SELECT
            current_date,
            COUNT(*)::INTEGER,
            MAX(discount_percentage),
            (SELECT id FROM deals 
             WHERE is_active = true 
             AND current_date BETWEEN travel_valid_from AND travel_valid_to
             ORDER BY discount_percentage DESC NULLS LAST
             LIMIT 1),
            calculate_deal_quality(MAX(discount_percentage)),
            jsonb_object_agg(deal_type, deal_type_count),
            NOW()
        FROM (
            SELECT 
                deal_type,
                COUNT(*)::INTEGER as deal_type_count,
                discount_percentage
            FROM deals
            WHERE is_active = true
            AND current_date BETWEEN travel_valid_from AND travel_valid_to
            GROUP BY deal_type, discount_percentage
        ) subquery
        ON CONFLICT (cache_date) 
        DO UPDATE SET
            deal_count = EXCLUDED.deal_count,
            best_discount_percentage = EXCLUDED.best_discount_percentage,
            best_deal_id = EXCLUDED.best_deal_id,
            deal_quality = EXCLUDED.deal_quality,
            deals_by_type = EXCLUDED.deals_by_type,
            last_updated = NOW();
            
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Seed data: Disney Resorts
INSERT INTO resorts (name, resort_type, official_disney, location, website_url) VALUES
('Disney''s Pop Century Resort', 'value', true, 'ESPN Wide World of Sports Area', 'https://disneyworld.disney.go.com/resorts/pop-century-resort/'),
('Disney''s Art of Animation Resort', 'value', true, 'ESPN Wide World of Sports Area', 'https://disneyworld.disney.go.com/resorts/art-of-animation-resort/'),
('Disney''s All-Star Movies Resort', 'value', true, 'ESPN Wide World of Sports Area', 'https://disneyworld.disney.go.com/resorts/all-star-movies-resort/'),
('Disney''s All-Star Music Resort', 'value', true, 'ESPN Wide World of Sports Area', 'https://disneyworld.disney.go.com/resorts/all-star-music-resort/'),
('Disney''s All-Star Sports Resort', 'value', true, 'ESPN Wide World of Sports Area', 'https://disneyworld.disney.go.com/resorts/all-star-sports-resort/'),
('Disney''s Caribbean Beach Resort', 'moderate', true, 'Epcot Area', 'https://disneyworld.disney.go.com/resorts/caribbean-beach-resort/'),
('Disney''s Coronado Springs Resort', 'moderate', true, 'Animal Kingdom Area', 'https://disneyworld.disney.go.com/resorts/coronado-springs-resort/'),
('Disney''s Port Orleans Resort - French Quarter', 'moderate', true, 'Downtown Disney Area', 'https://disneyworld.disney.go.com/resorts/port-orleans-resort-french-quarter/'),
('Disney''s Port Orleans Resort - Riverside', 'moderate', true, 'Downtown Disney Area', 'https://disneyworld.disney.go.com/resorts/port-orleans-resort-riverside/'),
('Disney''s Grand Floridian Resort & Spa', 'deluxe', true, 'Magic Kingdom Area', 'https://disneyworld.disney.go.com/resorts/grand-floridian-resort-and-spa/'),
('Disney''s Contemporary Resort', 'deluxe', true, 'Magic Kingdom Area', 'https://disneyworld.disney.go.com/resorts/contemporary-resort/'),
('Disney''s Polynesian Village Resort', 'deluxe', true, 'Magic Kingdom Area', 'https://disneyworld.disney.go.com/resorts/polynesian-village-resort/'),
('Disney''s Wilderness Lodge', 'deluxe', true, 'Magic Kingdom Area', 'https://disneyworld.disney.go.com/resorts/wilderness-lodge-resort/'),
('Disney''s Beach Club Resort', 'deluxe', true, 'Epcot Area', 'https://disneyworld.disney.go.com/resorts/beach-club-resort/'),
('Disney''s Yacht Club Resort', 'deluxe', true, 'Epcot Area', 'https://disneyworld.disney.go.com/resorts/yacht-club-resort/'),
('Disney''s BoardWalk Inn', 'deluxe', true, 'Epcot Area', 'https://disneyworld.disney.go.com/resorts/boardwalk-inn/'),
('Disney''s Animal Kingdom Lodge', 'deluxe', true, 'Animal Kingdom Area', 'https://disneyworld.disney.go.com/resorts/animal-kingdom-lodge/'),
('Disney''s Saratoga Springs Resort & Spa', 'villa', true, 'Disney Springs Area', 'https://disneyworld.disney.go.com/resorts/saratoga-springs-resort-and-spa/'),
('Disney''s Old Key West Resort', 'villa', true, 'Disney Springs Area', 'https://disneyworld.disney.go.com/resorts/old-key-west-resort/'),
('Disney''s Riviera Resort', 'villa', true, 'Epcot Area', 'https://disneyworld.disney.go.com/resorts/riviera-resort/');

-- Seed data: Deal sources
INSERT INTO deal_sources (name, source_type, source_url, is_active, check_frequency_minutes) VALUES
('Disney Parks Blog', 'rss', 'https://disneyparks.disney.go.com/blog/feed/', true, 60),
('Disney Special Offers', 'website', 'https://disneyworld.disney.go.com/special-offers/', true, 120),
('MouseSavers', 'website', 'https://www.mousesavers.com/disney-world-vacation-discounts/', true, 240),
('Disney Tourist Blog', 'website', 'https://www.disneytouristblog.com/current-discounts-promos-disney-world-land/', true, 120),
('DISboards', 'website', 'https://www.disboards.com/forums/budget-board.91/', true, 180),
('AllEars.net', 'website', 'https://allears.net/category/walt-disney-world/wdw-planning/wdw-deals/', true, 180),
('Reddit WaltDisneyWorld', 'api', 'https://www.reddit.com/r/WaltDisneyWorld/hot.json', true, 60),
('Manual Email Forward', 'email', null, true, null);

-- Javari Learning & Intelligence Tables
CREATE TABLE javari_training_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Training input
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    user_context JSONB, -- User's situation when shown the deal
    deal_features JSONB, -- Extracted features for ML
    
    -- Training output (user response)
    user_action TEXT NOT NULL, -- 'booked', 'saved', 'ignored', 'dismissed'
    action_timestamp TIMESTAMPTZ NOT NULL,
    
    -- Outcome tracking
    days_to_decision INTEGER, -- How long to decide
    final_price_paid DECIMAL(10,2),
    user_satisfaction_score INTEGER, -- 1-5 if provided
    
    -- Learning metadata
    model_version TEXT DEFAULT 'v1.0',
    prediction_made JSONB, -- What Javari predicted
    prediction_correct BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE javari_pattern_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    pattern_type TEXT NOT NULL, -- 'seasonal', 'discount_threshold', 'booking_window', etc.
    pattern_name TEXT NOT NULL,
    
    -- Pattern definition
    pattern_data JSONB NOT NULL,
    confidence DECIMAL(5,2) NOT NULL, -- How confident in this pattern
    
    -- Statistics
    observations_count INTEGER DEFAULT 1,
    success_rate DECIMAL(5,2),
    last_observed_at TIMESTAMPTZ,
    
    -- Pattern insights
    description TEXT,
    recommendation TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE javari_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    experiment_name TEXT NOT NULL,
    experiment_type TEXT NOT NULL, -- 'ab_test', 'recommendation_strategy', 'scoring_algorithm'
    
    -- Hypothesis
    hypothesis TEXT NOT NULL,
    
    -- Variants
    control_variant JSONB,
    test_variant JSONB,
    
    -- Results
    control_success_rate DECIMAL(5,2),
    test_success_rate DECIMAL(5,2),
    improvement DECIMAL(5,2),
    
    -- Statistical significance
    sample_size INTEGER DEFAULT 0,
    is_significant BOOLEAN DEFAULT false,
    confidence_level DECIMAL(5,2),
    
    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Winner
    winning_variant TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE javari_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    insight_type TEXT NOT NULL, -- 'trend', 'anomaly', 'opportunity', 'warning'
    priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
    
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Supporting data
    data_points JSONB,
    visualizations JSONB, -- Chart configs
    
    -- Recommendations
    recommended_actions TEXT[],
    estimated_impact DECIMAL(10,2), -- Potential savings/value
    
    -- User interaction
    viewed BOOLEAN DEFAULT false,
    viewed_at TIMESTAMPTZ,
    acted_upon BOOLEAN DEFAULT false,
    action_result TEXT,
    
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Javari performance metrics
CREATE TABLE javari_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL UNIQUE,
    
    -- Recommendation accuracy
    recommendations_made INTEGER DEFAULT 0,
    recommendations_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2),
    
    -- Deal discovery
    deals_discovered INTEGER DEFAULT 0,
    high_quality_deals INTEGER DEFAULT 0, -- Score > 80
    deals_booked_by_users INTEGER DEFAULT 0,
    
    -- Value delivered
    total_savings_identified DECIMAL(10,2) DEFAULT 0,
    average_discount_found DECIMAL(5,2),
    
    -- Learning progress
    patterns_discovered INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,2),
    model_improvements INTEGER DEFAULT 0,
    
    -- User engagement
    alerts_sent INTEGER DEFAULT 0,
    alert_click_rate DECIMAL(5,2),
    user_satisfaction_avg DECIMAL(3,2), -- 1-5 scale
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for Javari tables
CREATE INDEX idx_javari_training_deal ON javari_training_data(deal_id);
CREATE INDEX idx_javari_training_action ON javari_training_data(user_action);
CREATE INDEX idx_javari_patterns_type ON javari_pattern_library(pattern_type);
CREATE INDEX idx_javari_insights_priority ON javari_insights(priority, is_active);
CREATE INDEX idx_javari_metrics_date ON javari_metrics(metric_date DESC);

-- Functions for Javari intelligence

-- Calculate deal score (used by Javari)
CREATE OR REPLACE FUNCTION calculate_comprehensive_deal_score(
    p_deal_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_discount DECIMAL(5,2);
    v_resort_type TEXT;
    v_days_until_travel INTEGER;
    v_historical_avg DECIMAL(5,2);
    v_final_score INTEGER;
BEGIN
    -- Get deal details
    SELECT 
        discount_percentage,
        r.resort_type,
        (d.travel_valid_from - CURRENT_DATE)
    INTO v_discount, v_resort_type, v_days_until_travel
    FROM deals d
    LEFT JOIN resorts r ON d.resort_id = r.id
    WHERE d.id = p_deal_id;
    
    -- Start with discount score
    v_final_score := COALESCE(v_discount::INTEGER, 0);
    
    -- Bonus for resort quality
    IF v_resort_type = 'deluxe' THEN
        v_final_score := v_final_score + 15;
    ELSIF v_resort_type = 'moderate' THEN
        v_final_score := v_final_score + 10;
    END IF;
    
    -- Bonus for advance booking (better availability)
    IF v_days_until_travel > 90 THEN
        v_final_score := v_final_score + 10;
    ELSIF v_days_until_travel > 60 THEN
        v_final_score := v_final_score + 5;
    END IF;
    
    -- Cap at 100
    v_final_score := LEAST(v_final_score, 100);
    
    RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- Javari recommendation engine
CREATE OR REPLACE FUNCTION javari_generate_recommendation(
    p_deal_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_score INTEGER;
    v_recommendation TEXT;
    v_confidence DECIMAL(5,2);
    v_reasoning TEXT;
BEGIN
    -- Calculate score
    v_score := calculate_comprehensive_deal_score(p_deal_id);
    
    -- Generate recommendation based on score
    IF v_score >= 85 THEN
        v_recommendation := 'book_now';
        v_confidence := 95.0;
        v_reasoning := 'Exceptional deal - in top 5% of all deals. Book immediately.';
    ELSIF v_score >= 70 THEN
        v_recommendation := 'consider';
        v_confidence := 80.0;
        v_reasoning := 'Strong deal - better than 70% of historical offers. Recommend booking if dates work.';
    ELSIF v_score >= 50 THEN
        v_recommendation := 'wait';
        v_confidence := 65.0;
        v_reasoning := 'Moderate deal - better offers likely to appear. Set alert and wait.';
    ELSE
        v_recommendation := 'skip';
        v_confidence := 85.0;
        v_reasoning := 'Below average deal - significantly better options available.';
    END IF;
    
    RETURN jsonb_build_object(
        'recommendation', v_recommendation,
        'confidence', v_confidence,
        'reasoning', v_reasoning,
        'score', v_score
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE resorts IS 'Disney World resorts and partner hotels';
COMMENT ON TABLE deals IS 'All discovered deals with validity dates and requirements';
COMMENT ON TABLE price_history IS 'Historical pricing data for trend analysis';
COMMENT ON TABLE user_alerts IS 'User-configured alerts for specific date ranges and criteria';
COMMENT ON TABLE deal_calendar_cache IS 'Pre-computed calendar data for fast rendering';
COMMENT ON TABLE deal_sources IS 'External sources we monitor for deals';
COMMENT ON TABLE javari_training_data IS 'Training data for Javari ML models - user decisions and outcomes';
COMMENT ON TABLE javari_pattern_library IS 'Discovered patterns in deal timing, pricing, and user behavior';
COMMENT ON TABLE javari_experiments IS 'A/B tests and experiments to improve Javari recommendations';
COMMENT ON TABLE javari_insights IS 'Proactive insights generated by Javari for users';
COMMENT ON TABLE javari_metrics IS 'Daily performance metrics tracking Javari effectiveness';

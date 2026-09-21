-- ============================================================================
-- SafePath AI / NearMiss Schema (Fresh Project Setup)
-- Hardened Security: Append-Only Tables + Restricted RPC Trip Completion
-- ============================================================================

-- 1. TRIPS TABLE
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_point text NOT NULL DEFAULT 'Current Location',
  destination text NOT NULL,
  distance_km numeric NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 0,
  risk_score text NOT NULL DEFAULT 'low',
  green_pct int NOT NULL DEFAULT 100,
  yellow_pct int NOT NULL DEFAULT 0,
  red_pct int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- 2. HAZARD REPORTS TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS hazard_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  hazard_type text NOT NULL DEFAULT 'other',
  severity text NOT NULL DEFAULT 'medium',
  description text,
  latitude numeric,
  longitude numeric,
  zone_type text DEFAULT 'green',
  status text NOT NULL DEFAULT 'pending',
  audio_path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hazard_reports ENABLE ROW LEVEL SECURITY;

-- 3. ROUTE FEEDBACK TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS route_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  safety_rating int NOT NULL DEFAULT 5,
  confirmed_safe boolean NOT NULL DEFAULT true,
  reported_hazards boolean NOT NULL DEFAULT false,
  feedback_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE route_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Strict least-privilege: No direct UPDATE or DELETE permissions on any table
-- ============================================================================

-- Trips: SELECT & INSERT only
DROP POLICY IF EXISTS "trips_select_policy" ON trips;
CREATE POLICY "trips_select_policy" ON trips
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "trips_insert_policy" ON trips;
CREATE POLICY "trips_insert_policy" ON trips
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Hazard Reports: SELECT & INSERT only
DROP POLICY IF EXISTS "hazard_reports_select_policy" ON hazard_reports;
CREATE POLICY "hazard_reports_select_policy" ON hazard_reports
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "hazard_reports_insert_policy" ON hazard_reports;
CREATE POLICY "hazard_reports_insert_policy" ON hazard_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Route Feedback: SELECT & INSERT only
DROP POLICY IF EXISTS "route_feedback_select_policy" ON route_feedback;
CREATE POLICY "route_feedback_select_policy" ON route_feedback
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "route_feedback_insert_policy" ON route_feedback;
CREATE POLICY "route_feedback_insert_policy" ON route_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================================
-- SECURE STORED PROCEDURE / RPC
-- Allows completing an active trip without granting UPDATE access to the table
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_trip(p_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated int;
BEGIN
  -- Restrict modification strictly to status and completed_at on active trips
  UPDATE public.trips
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_trip_id
    AND status = 'active';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION complete_trip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_trip(uuid) TO anon, authenticated;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hazard_reports_created_at
  ON hazard_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hazard_reports_trip_id
  ON hazard_reports (trip_id);

CREATE INDEX IF NOT EXISTS idx_route_feedback_trip_id
  ON route_feedback (trip_id);

-- ============================================================================
-- SafePath AI / NearMiss: Risk Zones Foundation Schema Migration
-- Single Source of Truth for territorial road safety sectors
-- ============================================================================

-- 1. Create risk_zones table
CREATE TABLE IF NOT EXISTS public.risk_zones (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius_meters numeric NOT NULL DEFAULT 1000,
  -- BASELINE SCORE SEMANTICS:
  -- The numeric_score and risk_level columns below store the static baseline benchmark
  -- under normal (off-peak, clear weather) conditions.
  -- The authoritative live risk score is dynamically evaluated by RiskZoneService
  -- based on real-time hour, active weather, and live crowdsourced community reports.
  risk_level text NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  numeric_score int NOT NULL DEFAULT 0 CHECK (numeric_score >= 0 AND numeric_score <= 100),
  incident_count int NOT NULL DEFAULT 0,
  near_miss_count int NOT NULL DEFAULT 0,
  community_report_count int NOT NULL DEFAULT 0,
  common_hazard text,
  high_risk_start_hour int NOT NULL DEFAULT 18 CHECK (high_risk_start_hour >= 0 AND high_risk_start_hour <= 23),
  high_risk_end_hour int NOT NULL DEFAULT 22 CHECK (high_risk_end_hour >= 0 AND high_risk_end_hour <= 23),
  last_reported_at timestamptz,
  weather_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_demo_zone boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.risk_zones ENABLE ROW LEVEL SECURITY;

-- 2. Strictly Read-Only Policy for clients (anon & authenticated)
-- No direct INSERT, UPDATE, or DELETE permissions are granted to public clients.
DROP POLICY IF EXISTS "risk_zones_select_policy" ON public.risk_zones;
CREATE POLICY "risk_zones_select_policy" ON public.risk_zones
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Indexes for spatial and query performance
CREATE INDEX IF NOT EXISTS idx_risk_zones_coords
  ON public.risk_zones (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_risk_zones_level
  ON public.risk_zones (risk_level);

CREATE INDEX IF NOT EXISTS idx_risk_zones_demo
  ON public.risk_zones (is_demo_zone);

-- 4. Initial Seed for Demo Zones (Clearly marked: is_demo_zone = true)
-- Baseline numeric_score values strictly equal the deterministic formula:
-- Base = (incident_count * 5.0) + (near_miss_count * 2.5) + (community_report_count * 1.5)
INSERT INTO public.risk_zones (
  id, name, description, latitude, longitude, radius_meters,
  risk_level, numeric_score, incident_count, near_miss_count, community_report_count,
  common_hazard, high_risk_start_hour, high_risk_end_hour, last_reported_at,
  weather_patterns, is_demo_zone
)
VALUES
(
  'zone-hyd-kukatpally-01',
  'Kukatpally Y-Junction & Metro Corridor',
  'High-friction junction linking NH-65 with arterial metro roads, characterized by intense merging and frequent pedestrian crossings.',
  17.4938, 78.3995, 1200,
  'HIGH', 77, 6, 14, 8,
  'Abrupt junction weaving & lane changes',
  17, 22,
  '2026-09-17T11:45:00Z',
  '[{"condition":"heavy_rain","multiplier":1.4,"advisory":"Water stagnation near flyover ramp causes abrupt lane reduction."}]'::jsonb,
  true
),
(
  'zone-hyd-medchal-02',
  'Medchal NH-44 Freight Junction',
  'Highway transition sector with heavy commercial trucks entering and exiting the outer ring road connector.',
  17.6297, 78.4814, 1600,
  'CRITICAL', 98, 9, 18, 5,
  'High-speed commercial freight merges & unlit cuts',
  20, 3,
  '2026-09-16T22:30:00Z',
  '[{"condition":"poor_visibility","multiplier":1.5,"advisory":"Highway fog and high-beam headlight glare significantly reduce stopping distance."}]'::jsonb,
  true
),
(
  'zone-hyd-gachibowli-03',
  'Gachibowli Biodiversity Junction & Underpass',
  'Multi-tier flyover underpass connecting IT hubs with Old Mumbai Highway, featuring sharp curve transitions.',
  17.4401, 78.3489, 1000,
  'MODERATE', 58, 4, 11, 7,
  'Blind curve deceleration & surface water accumulation',
  18, 23,
  '2026-09-17T09:15:00Z',
  '[{"condition":"heavy_rain","multiplier":1.3,"advisory":"Water runoff across underpass creates hydroplaning risk."}]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_meters = EXCLUDED.radius_meters,
  risk_level = EXCLUDED.risk_level,
  numeric_score = EXCLUDED.numeric_score,
  incident_count = EXCLUDED.incident_count,
  near_miss_count = EXCLUDED.near_miss_count,
  community_report_count = EXCLUDED.community_report_count,
  common_hazard = EXCLUDED.common_hazard,
  high_risk_start_hour = EXCLUDED.high_risk_start_hour,
  high_risk_end_hour = EXCLUDED.high_risk_end_hour,
  last_reported_at = EXCLUDED.last_reported_at,
  weather_patterns = EXCLUDED.weather_patterns,
  is_demo_zone = EXCLUDED.is_demo_zone,
  updated_at = now();

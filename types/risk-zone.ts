/**
 * NearMiss / SafePath AI: Risk Zone Types
 * Defines spatial territorial risk areas, deterministic risk scores, and contributing factors.
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type RiskFactorCategory =
  | 'incident_history'
  | 'near_miss_density'
  | 'community_signals'
  | 'time_of_day'
  | 'weather_pattern'
  | 'infrastructure';

export type RiskFactor = {
  id: string;
  category: RiskFactorCategory;
  name: string;
  description: string;
  weight: number; // Impact contribution (points) to the overall score
  severity: 'low' | 'moderate' | 'high' | 'critical';
  is_active: boolean;
};

export type RiskZoneWeatherCondition =
  | 'heavy_rain'
  | 'waterlogging'
  | 'poor_visibility'
  | 'night_glare'
  | 'normal';

export type WeatherRiskPattern = {
  condition: RiskZoneWeatherCondition;
  multiplier: number;
  advisory: string;
};

export type RiskScore = {
  numeric_score: number; // 0 to 100
  level: RiskLevel;
  factors: RiskFactor[];
  explanation: string;
  confidence: number; // 0.0 to 1.0 based on signal volume
  is_peak_hour: boolean;
};

export type RiskZone = {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_level: RiskLevel;
  numeric_score: number; // 0 to 100
  incident_count: number;
  near_miss_count: number;
  community_report_count: number;
  common_hazard: string;
  high_risk_start_hour: number; // 0 - 23 (e.g. 17 for 5:00 PM)
  high_risk_end_hour: number;   // 0 - 23 (e.g. 22 for 10:00 PM)
  last_reported_at: string | null;
  explanation: string;
  factors: RiskFactor[];
  weather_patterns: WeatherRiskPattern[];
  is_demo_zone: boolean; // Flag to cleanly isolate synthetic demo records
  created_at: string;
  updated_at: string;
};

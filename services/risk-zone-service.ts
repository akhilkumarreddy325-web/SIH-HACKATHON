import { supabase } from '@/lib/supabase';
import {
  RiskFactor,
  RiskLevel,
  RiskScore,
  RiskZone,
  RiskZoneWeatherCondition,
  WeatherRiskPattern,
} from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';
import {
  CurrentWeatherData,
  mapWeatherKeyToRiskZoneCondition,
  mapWeatherToRiskZoneCondition,
} from '@/services/weather-service';

/**
 * ============================================================================
 * DETERMINISTIC RISK SCORING ENGINE
 * ============================================================================
 *
 * Mathematical Formula:
 *   Base Score = (Incident Count * 5.0)
 *              + (Near Miss Count * 2.5)
 *              + (Community Reports * 1.5)
 *
 * Modifiers:
 *   + Peak Time-of-Day Window: +15 points if current hour falls within [highRiskStartHour, highRiskEndHour].
 *   + Weather Vulnerability: +15 points if an active weather condition matches the zone's documented profile.
 *     (Deterministic evaluation mapped from WeatherService condition vocabulary).
 *
 * Score Range & Tier Thresholds:
 *   0  - 29 : LOW
 *   30 - 59 : MODERATE
 *   60 - 79 : HIGH
 *   80 - 100: CRITICAL (capped at 100)
 */

export const RISK_THRESHOLDS = {
  LOW_MAX: 29,
  MODERATE_MAX: 59,
  HIGH_MAX: 79,
  CRITICAL_MIN: 80,
} as const;

export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.CRITICAL_MIN) return 'CRITICAL';
  if (score > RISK_THRESHOLDS.MODERATE_MAX) return 'HIGH';
  if (score > RISK_THRESHOLDS.LOW_MAX) return 'MODERATE';
  return 'LOW';
}

export function isHourInWindow(hour: number, start: number, end: number): boolean {
  if (start <= end) {
    return hour >= start && hour <= end;
  }
  // Handles overnight windows spanning midnight (e.g. 20:00 to 03:00)
  return hour >= start || hour <= end;
}

export function calculateDeterministicRiskScore(params: {
  incidentCount: number;
  nearMissCount: number;
  communityReportCount: number;
  currentHour?: number;
  highRiskStartHour: number;
  highRiskEndHour: number;
  activeWeatherCondition?: RiskZoneWeatherCondition | string;
  weatherPatterns?: WeatherRiskPattern[];
}): RiskScore {
  const {
    incidentCount,
    nearMissCount,
    communityReportCount,
    currentHour = new Date().getHours(),
    highRiskStartHour,
    highRiskEndHour,
    activeWeatherCondition = 'normal',
    weatherPatterns = [],
  } = params;

  // 1. Base Score from safety signals
  let score =
    incidentCount * 5.0 +
    nearMissCount * 2.5 +
    communityReportCount * 1.5;

  const factors: RiskFactor[] = [];

  if (incidentCount > 0) {
    factors.push({
      id: 'factor-incidents',
      category: 'incident_history',
      name: 'Historical Collisions',
      description: `${incidentCount} recorded incident(s) in this sector`,
      weight: incidentCount * 5.0,
      severity: incidentCount >= 8 ? 'critical' : incidentCount >= 5 ? 'high' : 'moderate',
      is_active: true,
    });
  }

  if (nearMissCount > 0) {
    factors.push({
      id: 'factor-near-misses',
      category: 'near_miss_density',
      name: 'Telemetric Near-Miss Events',
      description: `${nearMissCount} rapid deceleration or avoidance events`,
      weight: nearMissCount * 2.5,
      severity: nearMissCount >= 15 ? 'critical' : nearMissCount >= 10 ? 'high' : 'moderate',
      is_active: true,
    });
  }

  if (communityReportCount > 0) {
    factors.push({
      id: 'factor-community-reports',
      category: 'community_signals',
      name: 'Crowdsourced Road Reports',
      description: `${communityReportCount} active user-submitted hazard report(s)`,
      weight: communityReportCount * 1.5,
      severity: communityReportCount >= 8 ? 'high' : 'moderate',
      is_active: true,
    });
  }

  // 2. Peak Hour Window Modifier (+15 pts)
  const isPeakHour = isHourInWindow(currentHour, highRiskStartHour, highRiskEndHour);
  if (isPeakHour) {
    factors.push({
      id: 'factor-peak-hour',
      category: 'time_of_day',
      name: 'Peak Traffic & Lighting Window',
      description: `Elevated collision frequency observed between ${highRiskStartHour}:00 and ${highRiskEndHour}:00`,
      weight: 15,
      severity: 'high',
      is_active: true,
    });
    score += 15;
  }

  // 3. Weather Modifier (+15 pts if active weather matches zone profile)
  const matchingPattern = weatherPatterns.find((p) => p.condition === activeWeatherCondition);
  if (matchingPattern && activeWeatherCondition !== 'normal') {
    factors.push({
      id: 'factor-weather-vulnerability',
      category: 'weather_pattern',
      name: `Weather Vulnerability (${matchingPattern.condition.replace('_', ' ')})`,
      description: matchingPattern.advisory,
      weight: 15,
      severity: 'high',
      is_active: true,
    });
    score += 15;
  }

  // Cap score strictly at 100
  const numericScore = Math.min(100, Math.round(score));
  const level = getRiskLevelFromScore(numericScore);

  // Confidence metric based on signal volume (0.0 - 1.0)
  const signalVolume = incidentCount + nearMissCount + communityReportCount;
  const confidence = Math.min(1.0, Math.round((signalVolume / 25) * 100) / 100);

  // Deterministic textual explanation
  const explanationParts: string[] = [
    `Calculated risk score is ${numericScore}/100 (${level} tier) based on ${incidentCount} collision(s), ${nearMissCount} near-miss sensor trigger(s), and ${communityReportCount} verified crowd signal(s).`,
  ];
  if (isPeakHour) {
    explanationParts.push(`Includes +15 point modifier for active peak traffic window (${highRiskStartHour}:00 - ${highRiskEndHour}:00).`);
  }
  if (matchingPattern && activeWeatherCondition !== 'normal') {
    explanationParts.push(`Includes +15 point modifier for active environmental profile matching (${matchingPattern.condition.replace('_', ' ')}).`);
  }

  return {
    numeric_score: numericScore,
    level,
    factors,
    explanation: explanationParts.join(' '),
    confidence,
    is_peak_hour: isPeakHour,
  };
}

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * ============================================================================
 * DEMO FALLBACK RECORDS (Hyderabad Urban Sectors)
 * ============================================================================
 * Used strictly as local development/offline fallback when Supabase `risk_zones`
 * table is unavailable. Raw counts match the database seeds exactly.
 * All dynamic scores are computed through `calculateDeterministicRiskScore`.
 */
export type RawZoneRecord = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  incident_count: number;
  near_miss_count: number;
  community_report_count: number;
  common_hazard: string;
  high_risk_start_hour: number;
  high_risk_end_hour: number;
  last_reported_at: string | null;
  weather_patterns: WeatherRiskPattern[];
  is_demo_zone: boolean;
  created_at: string;
  updated_at: string;
};

export const DEMO_FALLBACK_ZONES: RawZoneRecord[] = [
  {
    id: 'zone-hyd-kukatpally-01',
    name: 'Kukatpally Y-Junction & Metro Corridor',
    description:
      'High-friction junction linking NH-65 with arterial metro roads, characterized by intense merging and frequent pedestrian crossings.',
    latitude: 17.4938,
    longitude: 78.3995,
    radius_meters: 1200,
    incident_count: 6,
    near_miss_count: 14,
    community_report_count: 8,
    common_hazard: 'Abrupt junction weaving & lane changes',
    high_risk_start_hour: 17,
    high_risk_end_hour: 22,
    last_reported_at: '2026-09-17T11:45:00Z',
    weather_patterns: [
      {
        condition: 'heavy_rain',
        multiplier: 1.4,
        advisory: 'Water stagnation near flyover ramp causes abrupt lane reduction.',
      },
    ],
    is_demo_zone: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-17T12:00:00Z',
  },
  {
    id: 'zone-hyd-medchal-02',
    name: 'Medchal NH-44 Freight Junction',
    description:
      'Highway transition sector with heavy commercial trucks entering and exiting the outer ring road connector.',
    latitude: 17.6297,
    longitude: 78.4814,
    radius_meters: 1600,
    incident_count: 9,
    near_miss_count: 18,
    community_report_count: 5,
    common_hazard: 'High-speed commercial freight merges & unlit cuts',
    high_risk_start_hour: 20,
    high_risk_end_hour: 3, // 8:00 PM to 3:00 AM overnight
    last_reported_at: '2026-09-16T22:30:00Z',
    weather_patterns: [
      {
        condition: 'poor_visibility',
        multiplier: 1.5,
        advisory: 'Highway fog and high-beam headlight glare significantly reduce stopping distance.',
      },
    ],
    is_demo_zone: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-17T12:00:00Z',
  },
  {
    id: 'zone-hyd-gachibowli-03',
    name: 'Gachibowli Biodiversity Junction & Underpass',
    description:
      'Multi-tier flyover underpass connecting IT hubs with Old Mumbai Highway, featuring sharp curve transitions.',
    latitude: 17.4401,
    longitude: 78.3489,
    radius_meters: 1000,
    incident_count: 4,
    near_miss_count: 11,
    community_report_count: 7,
    common_hazard: 'Blind curve deceleration & surface water accumulation',
    high_risk_start_hour: 18,
    high_risk_end_hour: 23,
    last_reported_at: '2026-09-17T09:15:00Z',
    weather_patterns: [
      {
        condition: 'heavy_rain',
        multiplier: 1.3,
        advisory: 'Water runoff across underpass creates hydroplaning risk.',
      },
    ],
    is_demo_zone: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-17T12:00:00Z',
  },
];

/**
 * ============================================================================
 * RISK ZONE SERVICE
 * ============================================================================
 *
 * Architecture:
 *   Supabase `risk_zones` (Single Source of Truth for baseline data)
 *     -> RiskZoneService
 *     -> Deterministic Score Calculation (Authoritative Live Score)
 *     -> UI / Consumer Modules
 */
export class RiskZoneService {
  /**
   * Hydrates a raw record (from Supabase or local fallback) into a fully scored RiskZone.
   * Calculates the authoritative live numeric_score and risk_level.
   */
  public static hydrateZone(
    raw: RawZoneRecord,
    currentHour: number = new Date().getHours(),
    weather?: RiskZoneWeatherCondition | string,
    weatherData?: CurrentWeatherData | null
  ): RiskZone {
    let resolvedWeather: RiskZoneWeatherCondition = 'normal';
    if (weatherData) {
      resolvedWeather = mapWeatherToRiskZoneCondition(weatherData, raw.weather_patterns);
    } else if (weather) {
      resolvedWeather = mapWeatherKeyToRiskZoneCondition(weather, raw.weather_patterns);
    }

    const computed = calculateDeterministicRiskScore({
      incidentCount: raw.incident_count,
      nearMissCount: raw.near_miss_count,
      communityReportCount: raw.community_report_count,
      currentHour,
      highRiskStartHour: raw.high_risk_start_hour,
      highRiskEndHour: raw.high_risk_end_hour,
      activeWeatherCondition: resolvedWeather,
      weatherPatterns: raw.weather_patterns,
    });

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      radius_meters: Number(raw.radius_meters),
      risk_level: computed.level,
      numeric_score: computed.numeric_score,
      incident_count: raw.incident_count,
      near_miss_count: raw.near_miss_count,
      community_report_count: raw.community_report_count,
      common_hazard: raw.common_hazard,
      high_risk_start_hour: raw.high_risk_start_hour,
      high_risk_end_hour: raw.high_risk_end_hour,
      last_reported_at: raw.last_reported_at,
      explanation: computed.explanation,
      factors: computed.factors,
      weather_patterns: raw.weather_patterns || [],
      is_demo_zone: Boolean(raw.is_demo_zone),
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  /**
   * Fallback method used when Supabase is offline or not yet migrated.
   */
  public static getFallbackZones(
    currentHour?: number,
    weather?: RiskZoneWeatherCondition | string,
    weatherData?: CurrentWeatherData | null
  ): RiskZone[] {
    return DEMO_FALLBACK_ZONES.map((raw) =>
      this.hydrateZone(raw, currentHour, weather, weatherData)
    );
  }

  /**
   * PRIMARY ACCESSOR: Fetches zones from Supabase `risk_zones` table as Single Source of Truth.
   * If database query fails or returns empty, falls back to DEMO_FALLBACK_ZONES.
   * In both cases, the exact same deterministic calculation is applied.
   */
  public static async getZones(options?: {
    currentHour?: number;
    activeWeather?: RiskZoneWeatherCondition | string;
    weatherData?: CurrentWeatherData | null;
  }): Promise<RiskZone[]> {
    const currentHour = options?.currentHour ?? new Date().getHours();

    try {
      const { data, error } = await supabase
        .from('risk_zones')
        .select('*')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        return this.getFallbackZones(currentHour, options?.activeWeather, options?.weatherData);
      }

      return data.map((row: any) =>
        this.hydrateZone(
          {
            id: row.id,
            name: row.name,
            description: row.description || '',
            latitude: row.latitude,
            longitude: row.longitude,
            radius_meters: row.radius_meters,
            incident_count: row.incident_count,
            near_miss_count: row.near_miss_count,
            community_report_count: row.community_report_count,
            common_hazard: row.common_hazard || '',
            high_risk_start_hour: row.high_risk_start_hour,
            high_risk_end_hour: row.high_risk_end_hour,
            last_reported_at: row.last_reported_at,
            weather_patterns: row.weather_patterns || [],
            is_demo_zone: row.is_demo_zone ?? false,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          currentHour,
          options?.activeWeather,
          options?.weatherData
        )
      );
    } catch {
      return this.getFallbackZones(currentHour, options?.activeWeather, options?.weatherData);
    }
  }

  /**
   * Fetches a single zone by ID (Supabase first, fallback second).
   */
  public static async getZoneById(
    id: string,
    options?: {
      currentHour?: number;
      activeWeather?: RiskZoneWeatherCondition | string;
      weatherData?: CurrentWeatherData | null;
    }
  ): Promise<RiskZone | undefined> {
    const zones = await this.getZones(options);
    return zones.find((z) => z.id === id);
  }

  /**
   * Identifies zones within maxDistanceMeters from a specific coordinate.
   */
  public static async findNearbyZones(
    latitude: number,
    longitude: number,
    maxDistanceMeters: number = 5000,
    options?: {
      currentHour?: number;
      activeWeather?: RiskZoneWeatherCondition | string;
      weatherData?: CurrentWeatherData | null;
    }
  ): Promise<Array<{ zone: RiskZone; distanceMeters: number; isInsideZone: boolean }>> {
    const zones = await this.getZones(options);

    return zones
      .map((zone) => {
        const distanceMeters = calculateHaversineDistance(
          latitude,
          longitude,
          zone.latitude,
          zone.longitude
        );
        const isInsideZone = distanceMeters <= zone.radius_meters;
        return { zone, distanceMeters, isInsideZone };
      })
      .filter((item) => item.distanceMeters <= maxDistanceMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * COMMUNITY REPORT DYNAMIC OVERLAY
   *
   * Overlays active crowdsourced reports from Supabase `hazard_reports` onto the persistent zone.
   *
   * Double-Counting Prevention:
   * 1. Reports are spatially filtered to those falling within `zone.radius_meters`.
   * 2. To avoid double-counting historical signals that are already baked into the zone's baseline count,
   *    if `onlyNewSinceBaseline` is true, only reports submitted AFTER `zone.last_reported_at`
   *    are treated as incremental new signals.
   * 3. Preserves `activeWeatherCondition` and passes it to `calculateDeterministicRiskScore`.
   */
  public static overlayCommunityReports(
    zone: RiskZone,
    liveReports: HazardReport[],
    options?: {
      currentHour?: number;
      activeWeatherCondition?: RiskZoneWeatherCondition | string;
      weatherData?: CurrentWeatherData | null;
      onlyNewSinceBaseline?: boolean;
    }
  ): RiskZone {
    const currentHour = options?.currentHour ?? new Date().getHours();
    const onlyNewSinceBaseline = options?.onlyNewSinceBaseline ?? true;

    let activeWeather: RiskZoneWeatherCondition = 'normal';
    if (options?.weatherData) {
      activeWeather = mapWeatherToRiskZoneCondition(options.weatherData, zone.weather_patterns);
    } else if (options?.activeWeatherCondition) {
      activeWeather = mapWeatherKeyToRiskZoneCondition(options.activeWeatherCondition, zone.weather_patterns);
    }

    // 1. Spatially filter reports within this zone's radius
    const matchingReports = liveReports.filter((report) => {
      if (!report.latitude || !report.longitude) return false;
      const dist = calculateHaversineDistance(
        zone.latitude,
        zone.longitude,
        Number(report.latitude),
        Number(report.longitude)
      );
      return dist <= zone.radius_meters;
    });

    // 2. Prevent double-counting: only increment with reports after zone.last_reported_at if requested
    const incrementalReports = onlyNewSinceBaseline && zone.last_reported_at
      ? matchingReports.filter(
          (r) => new Date(r.created_at).getTime() > new Date(zone.last_reported_at!).getTime()
        )
      : matchingReports;

    const newSignalCount = incrementalReports.length;
    const effectiveReportCount = zone.community_report_count + newSignalCount;

    // Find the newest report timestamp among all matching
    const latestReport = matchingReports.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const computed = calculateDeterministicRiskScore({
      incidentCount: zone.incident_count,
      nearMissCount: zone.near_miss_count,
      communityReportCount: effectiveReportCount,
      currentHour,
      highRiskStartHour: zone.high_risk_start_hour,
      highRiskEndHour: zone.high_risk_end_hour,
      activeWeatherCondition: activeWeather,
      weatherPatterns: zone.weather_patterns,
    });

    return {
      ...zone,
      community_report_count: effectiveReportCount,
      last_reported_at: latestReport ? latestReport.created_at : zone.last_reported_at,
      risk_level: computed.level,
      numeric_score: computed.numeric_score,
      explanation: computed.explanation,
      factors: computed.factors,
      updated_at: new Date().toISOString(),
    };
  }
}

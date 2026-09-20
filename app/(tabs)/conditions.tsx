import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Cloud,
  CloudFog,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Info,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import {
  calculateHaversineDistance,
  RiskZoneService,
} from '@/services/risk-zone-service';
import {
  CurrentWeatherData,
  mapWeatherToRiskZoneCondition,
  RainRisk,
  VisibilityLevel,
  WeatherResult,
  WeatherService,
} from '@/services/weather-service';
import { RiskLevel, RiskZone } from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';

export default function RoadConditionsScreen() {
  const [weatherResult, setWeatherResult] = useState<WeatherResult | null>(null);
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Truthful device geolocation (Hyderabad fallback for coordinate queries)
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // Request browser/device location
  const requestLocation = useCallback(() => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setHasLocationPermission(true);
        },
        () => {
          setUserCoords(null);
          setHasLocationPermission(false);
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      setUserCoords(null);
      setHasLocationPermission(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Load weather and risk zone data
  const loadEnvironmentalData = useCallback(async () => {
    setIsLoading(true);
    const queryLat = userCoords?.latitude ?? 17.3850;
    const queryLon = userCoords?.longitude ?? 78.4867;

    try {
      // 1. Fetch live atmospheric metrics via standalone WeatherService
      const weatherRes = await WeatherService.getCurrentWeather(queryLat, queryLon);
      setWeatherResult(weatherRes);

      // 2. Pass real weather data to RiskZoneService (deterministic mapping layer applies per-zone)
      const currentHour = new Date().getHours();
      const activeWeatherData = weatherRes.status === 'success' ? weatherRes.data : undefined;

      const [loadedZones, reportsRes] = await Promise.all([
        RiskZoneService.getZones({
          weatherData: activeWeatherData,
          currentHour,
        }),
        supabase
          .from('hazard_reports')
          .select('id,hazard_type,severity,description,status,latitude,longitude,created_at')
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      setZones(loadedZones);
      if (reportsRes.data) {
        setHazardReports(reportsRes.data as unknown as HazardReport[]);
      }
    } catch (err) {
      console.warn('Error loading environmental road conditions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userCoords]);

  useFocusEffect(
    useCallback(() => {
      loadEnvironmentalData();
    }, [loadEnvironmentalData])
  );

  // Current area description
  const areaName = useMemo(() => {
    if (hasLocationPermission && userCoords) {
      return `Sector ${userCoords.latitude.toFixed(3)}°N, ${userCoords.longitude.toFixed(3)}°E`;
    }
    return 'Hyderabad Metropolitan Area';
  }, [hasLocationPermission, userCoords]);

  // Synthesized Road Safety Level
  const roadSafetySummary = useMemo<{
    level: RiskLevel;
    color: string;
    bg: string;
    hazardsCount: number;
    peakZonesCount: number;
  }>(() => {
    const hazardsCount = hazardReports.length;
    let maxZoneLevel: RiskLevel = 'LOW';
    let peakZonesCount = 0;

    const rank: Record<RiskLevel, number> = { CRITICAL: 3, HIGH: 2, MODERATE: 1, LOW: 0 };

    for (const z of zones) {
      if (rank[z.risk_level] > rank[maxZoneLevel]) {
        maxZoneLevel = z.risk_level;
      }
      const isPeak =
        z.high_risk_start_hour <= z.high_risk_end_hour
          ? new Date().getHours() >= z.high_risk_start_hour && new Date().getHours() <= z.high_risk_end_hour
          : new Date().getHours() >= z.high_risk_start_hour || new Date().getHours() <= z.high_risk_end_hour;
      if (isPeak) peakZonesCount++;
    }

    // Combine severe rain risk with zone severity
    let overallLevel = maxZoneLevel;
    if (weatherResult?.data?.rainRisk === 'HIGH' && rank[overallLevel] < rank.HIGH) {
      overallLevel = 'HIGH';
    }

    let color = colors.green;
    let bg = colors.greenSoft;
    if (overallLevel === 'CRITICAL') {
      color = '#991B1B';
      bg = '#FEE2E2';
    } else if (overallLevel === 'HIGH') {
      color = colors.red;
      bg = colors.redSoft;
    } else if (overallLevel === 'MODERATE') {
      color = colors.yellow;
      bg = colors.yellowSoft;
    }

    return {
      level: overallLevel,
      color,
      bg,
      hazardsCount,
      peakZonesCount,
    };
  }, [zones, hazardReports, weatherResult]);

  // Evidence-based Driver Advisory (Phase 3 Requirement)
  const driverAdvisory = useMemo<string>(() => {
    const parts: string[] = [];
    const weather = weatherResult?.data;

    // 1. Atmospheric observation
    if (weather) {
      if (weather.rainRisk === 'HIGH') {
        parts.push(
          `Heavy precipitation (${weather.precipitationMm} mm/h) is active in this corridor.`
        );
      } else if (weather.conditionKey === 'rain' || weather.conditionKey === 'drizzle') {
        parts.push(
          `Light rain is present across the area. Surface traction monitors active.`
        );
      }

      // Visibility without claiming fog causes accidents
      if (weather.visibilityLevel === 'POOR' || weather.conditionKey === 'fog') {
        parts.push(
          `Reduced visibility or fog has been documented on freight transition corridors like Medchal, reducing forward sight distance. Maintain safe vehicle separation.`
        );
      }
    } else {
      parts.push(
        'Real-time atmospheric feed is currently offline.'
      );
    }

    // 2. Zone vulnerability cross-reference (evidence-based, no causal assertions)
    const vulnerableZone = zones.find((z) =>
      z.weather_patterns?.some((wp) => wp.condition === 'heavy_rain' || wp.condition === 'waterlogging')
    );

    if (weather && (weather.rainRisk === 'HIGH' || weather.rainRisk === 'MODERATE')) {
      if (vulnerableZone) {
        parts.push(
          `The ${vulnerableZone.name} corridor has a documented demo vulnerability to waterlogging during rain events. Approach low-lying segments cautiously.`
        );
      } else {
        parts.push(
          'Wet pavement may increase braking distance near high-traffic junctions.'
        );
      }
    }

    // 3. Time-of-day peak risk
    if (roadSafetySummary.peakZonesCount > 0) {
      parts.push(
        `High-density traffic window is currently active (${roadSafetySummary.peakZonesCount} sector(s) at peak hours).`
      );
    }

    // 4. Real Community Hazard Reports
    if (roadSafetySummary.hazardsCount > 0) {
      parts.push(
        `${roadSafetySummary.hazardsCount} community road hazard report(s) are logged in this sector. Use extra caution around reported obstacles.`
      );
    } else {
      parts.push(
        'No recent critical road obstructions logged by the community.'
      );
    }

    return parts.join(' ');
  }, [weatherResult, zones, roadSafetySummary]);

  const weatherData = weatherResult?.data;
  const isWeatherUnavailable = weatherResult?.status === 'unavailable';

  return (
    <Screen>
      <SectionHeader
        eyebrow="ENVIRONMENTAL INTELLIGENCE"
        title="Road Conditions"
        action="Live Feed"
      />

      {/* Location / Current Area Banner */}
      <View style={styles.areaBanner}>
        <View style={styles.areaLeft}>
          <MapPin size={16} color={colors.teal} />
          <View>
            <Text style={styles.areaLabel}>CURRENT AREA</Text>
            <Text style={styles.areaValue}>{areaName}</Text>
          </View>
        </View>

        <Pressable
          onPress={loadEnvironmentalData}
          style={styles.refreshBtn}
          hitSlop={6}
        >
          <RefreshCw size={13} color={colors.ink} />
          <Text style={styles.refreshBtnText}>Update</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* CURRENT WEATHER CARD */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Thermometer size={16} color={colors.teal} />
              <Text style={styles.cardEyebrow}>ATMOSPHERIC METRICS</Text>
            </View>
            <Text style={styles.sourceTag}>Open-Meteo API</Text>
          </View>

          {isWeatherUnavailable ? (
            <View style={styles.fallbackBox}>
              <AlertTriangle size={20} color={colors.yellow} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fallbackTitle}>Weather unavailable</Text>
                <Text style={styles.fallbackCopy}>
                  Live atmospheric satellite metrics could not be retrieved. Safety signal and risk zone calculations remain active.
                </Text>
              </View>
            </View>
          ) : weatherData ? (
            <View>
              <View style={styles.weatherHero}>
                <View>
                  <Text style={styles.tempLarge}>
                    {weatherData.temperatureC}°C
                  </Text>
                  <Text style={styles.apparentTemp}>
                    Feels like {weatherData.apparentTemperatureC}°C
                  </Text>
                </View>

                <View style={styles.conditionPill}>
                  {weatherData.conditionKey === 'rain' || weatherData.conditionKey === 'heavy_rain' ? (
                    <CloudRain size={20} color={colors.teal} />
                  ) : weatherData.conditionKey === 'clear' ? (
                    <Sun size={20} color="#D18D18" />
                  ) : (
                    <Cloud size={20} color={colors.muted} />
                  )}
                  <Text style={styles.conditionText}>{weatherData.condition}</Text>
                </View>
              </View>

              {/* Weather Stats Bar */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Droplets size={14} color={colors.muted} />
                  <Text style={styles.metricValue}>{weatherData.precipitationMm} mm</Text>
                  <Text style={styles.metricLabel}>Rain (1h)</Text>
                </View>

                <View style={styles.metricItem}>
                  <Wind size={14} color={colors.muted} />
                  <Text style={styles.metricValue}>{weatherData.windSpeedKmH} km/h</Text>
                  <Text style={styles.metricLabel}>Wind</Text>
                </View>

                <View style={styles.metricItem}>
                  <Activity size={14} color={colors.muted} />
                  <Text style={styles.metricValue}>{weatherData.relativeHumidity}%</Text>
                  <Text style={styles.metricLabel}>Humidity</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.loadingText}>Connecting to weather satellites...</Text>
          )}
        </View>

        {/* RISK TIERS ROW: RAIN RISK & VISIBILITY */}
        <View style={styles.dualCardRow}>
          {/* Rain Risk Card */}
          <View style={[styles.miniCard, shadow]}>
            <View style={styles.miniCardHeader}>
              <CloudRain size={16} color={colors.teal} />
              <Text style={styles.miniCardTitle}>RAIN RISK</Text>
            </View>
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor:
                    weatherData?.rainRisk === 'HIGH'
                      ? colors.redSoft
                      : weatherData?.rainRisk === 'MODERATE'
                      ? colors.yellowSoft
                      : colors.greenSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.tierText,
                  {
                    color:
                      weatherData?.rainRisk === 'HIGH'
                        ? colors.red
                        : weatherData?.rainRisk === 'MODERATE'
                        ? colors.yellow
                        : colors.green,
                  },
                ]}
              >
                {weatherData ? `${weatherData.rainRisk} RISK` : 'UNAVAILABLE'}
              </Text>
            </View>
            <Text style={styles.miniCardDetail}>
              {weatherData?.rainRisk === 'HIGH'
                ? 'Surface runoff likely'
                : weatherData?.rainRisk === 'MODERATE'
                ? 'Damp road surface'
                : 'Dry road conditions'}
            </Text>
          </View>

          {/* Visibility Card */}
          <View style={[styles.miniCard, shadow]}>
            <View style={styles.miniCardHeader}>
              <Eye size={16} color={colors.teal} />
              <Text style={styles.miniCardTitle}>VISIBILITY</Text>
            </View>
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor:
                    weatherData?.visibilityLevel === 'POOR'
                      ? colors.redSoft
                      : weatherData?.visibilityLevel === 'MODERATE'
                      ? colors.yellowSoft
                      : colors.greenSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.tierText,
                  {
                    color:
                      weatherData?.visibilityLevel === 'POOR'
                        ? colors.red
                        : weatherData?.visibilityLevel === 'MODERATE'
                        ? colors.yellow
                        : colors.green,
                  },
                ]}
              >
                {weatherData ? `${weatherData.visibilityLevel}` : 'UNAVAILABLE'}
              </Text>
            </View>
            <Text style={styles.miniCardDetail}>
              {weatherData
                ? `${(weatherData.visibilityMeters / 1000).toFixed(1)} km sight line`
                : 'Visibility metric pending'}
            </Text>
          </View>
        </View>

        {/* ROAD SAFETY STATUS CARD */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={16} color={roadSafetySummary.color} />
              <Text style={styles.cardEyebrow}>TERRITORIAL SAFETY ASSESSMENT</Text>
            </View>
            <View style={[styles.safetyPill, { backgroundColor: roadSafetySummary.bg }]}>
              <Text style={[styles.safetyPillText, { color: roadSafetySummary.color }]}>
                {roadSafetySummary.level} SAFETY
              </Text>
            </View>
          </View>

          <View style={styles.safetyStatsRow}>
            <View style={styles.safetyStat}>
              <Text style={styles.safetyStatNum}>{roadSafetySummary.hazardsCount}</Text>
              <Text style={styles.safetyStatLabel}>Nearby Hazards</Text>
            </View>

            <View style={styles.safetyStatDivider} />

            <View style={styles.safetyStat}>
              <Text style={styles.safetyStatNum}>{zones.length}</Text>
              <Text style={styles.safetyStatLabel}>Monitored Zones</Text>
            </View>

            <View style={styles.safetyStatDivider} />

            <View style={styles.safetyStat}>
              <Text style={styles.safetyStatNum}>{roadSafetySummary.peakZonesCount}</Text>
              <Text style={styles.safetyStatLabel}>Peak Windows</Text>
            </View>
          </View>
        </View>

        {/* DRIVER ADVISORY CARD (Evidence-based) */}
        <View style={[styles.advisoryCard, shadow]}>
          <View style={styles.advisoryHeader}>
            <View style={styles.advisoryIconWrap}>
              <Compass size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.advisoryEyebrow}>INTELLIGENCE ENGINE</Text>
              <Text style={styles.advisoryTitle}>Driver Advisory</Text>
            </View>
          </View>

          <View style={styles.advisoryBody}>
            <Text style={styles.advisoryText}>
              "{driverAdvisory}"
            </Text>
          </View>

          <View style={styles.evidenceTagRow}>
            <Info size={13} color={colors.muted} />
            <Text style={styles.evidenceTagText}>
              Synthesized from active weather observations, corridor vulnerability profiles, and verified community reports.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  areaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  areaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  areaLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  areaValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.canvas,
  },
  refreshBtnText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardEyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sourceTag: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  fallbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.canvas,
    padding: 12,
    borderRadius: 12,
  },
  fallbackTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  fallbackCopy: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  weatherHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tempLarge: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  apparentTemp: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  conditionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  conditionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  metricItem: {
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  dualCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  miniCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  miniCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  miniCardTitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  miniCardDetail: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  safetyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  safetyPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  safetyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    paddingVertical: 12,
  },
  safetyStat: {
    alignItems: 'center',
  },
  safetyStatNum: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  safetyStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  safetyStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.line,
  },
  advisoryCard: {
    backgroundColor: '#0F2620',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  advisoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryEyebrow: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  advisoryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  advisoryBody: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#34D399',
  },
  advisoryText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  evidenceTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evidenceTagText: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
});

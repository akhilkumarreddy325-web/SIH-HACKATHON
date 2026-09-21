import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  FileText,
  Info,
  Layers,
  MapPin,
  Navigation,
  RefreshCw,
  Shield,
  ShieldAlert,
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
import { ReportDetailModal } from '@/components/ReportDetailModal';
import { RiskZoneDetailModal } from '@/components/RiskZoneDetailModal';
import { SafetyMapView } from '@/components/SafetyMapView';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import {
  calculateHaversineDistance,
  RiskZoneService,
} from '@/services/risk-zone-service';
import { RiskLevel, RiskZone } from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';

interface NearbyRiskItem {
  id: string;
  type: 'zone' | 'hazard';
  title: string;
  subtitle: string;
  level: RiskLevel;
  distanceMeters: number | null;
  isDemo?: boolean;
  zone?: RiskZone;
  hazard?: HazardReport;
}

export default function SafetyMapScreen() {
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);

  // User location tracking (truthful, never invented)
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'checking' | 'granted' | 'unavailable'
  >('checking');

  // 1. Fetch risk zones and real hazard reports on screen focus
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedZones, reportsRes] = await Promise.all([
        RiskZoneService.getZones(),
        supabase
          .from('hazard_reports')
          .select('id,hazard_type,severity,description,status,latitude,longitude,zone_type,created_at,trip_id,audio_path')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setZones(fetchedZones);
      if (reportsRes.data) {
        setHazardReports(reportsRes.data as unknown as HazardReport[]);
      }
    } catch (err) {
      console.warn('Error loading safety map signals:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 2. Request user location truthfully (once on mount, does not continuously harass)
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
          setLocationStatus('granted');
        },
        () => {
          setUserCoords(null);
          setLocationStatus('unavailable');
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      setUserCoords(null);
      setLocationStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const getRiskColor = (level: RiskLevel): string => {
    switch (level) {
      case 'CRITICAL':
        return '#991B1B';
      case 'HIGH':
        return colors.red;
      case 'MODERATE':
        return colors.yellow;
      case 'LOW':
      default:
        return colors.green;
    }
  };

  const formatDistance = (meters: number | null): string => {
    if (meters === null) return 'Distance unavailable';
    if (meters < 1000) return `${Math.round(meters)} m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  // 3. Build & sort "Nearby Risk" items
  const nearbyRisks: NearbyRiskItem[] = useMemo(() => {
    const items: NearbyRiskItem[] = [];

    // Add Risk Zones
    for (const z of zones) {
      const dist = userCoords
        ? calculateHaversineDistance(userCoords.latitude, userCoords.longitude, z.latitude, z.longitude)
        : null;

      items.push({
        id: `zone-${z.id}`,
        type: 'zone',
        title: `${z.name} Sector`,
        subtitle: z.common_hazard || 'Multi-factor risk area',
        level: z.risk_level,
        distanceMeters: dist,
        isDemo: z.is_demo_zone,
        zone: z,
      });
    }

    // Add Real Hazard Reports
    for (const h of hazardReports) {
      if (typeof h.latitude !== 'number' || typeof h.longitude !== 'number') continue;
      const dist = userCoords
        ? calculateHaversineDistance(userCoords.latitude, userCoords.longitude, h.latitude, h.longitude)
        : null;

      const level: RiskLevel =
        h.severity === 'critical'
          ? 'CRITICAL'
          : h.severity === 'high'
          ? 'HIGH'
          : h.severity === 'medium'
          ? 'MODERATE'
          : 'LOW';

      items.push({
        id: `hazard-${h.id}`,
        type: 'hazard',
        title: h.hazard_type ? h.hazard_type.toUpperCase().replace('_', ' ') : 'Road Hazard',
        subtitle: h.description || 'Community reported hazard',
        level,
        distanceMeters: dist,
        hazard: h,
      });
    }

    // Sort by distance if user coords are present; otherwise sort by severity
    if (userCoords) {
      items.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    } else {
      const rank: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
      items.sort((a, b) => rank[a.level] - rank[b.level]);
    }

    return items;
  }, [zones, hazardReports, userCoords]);

  return (
    <Screen>
      <SectionHeader
        eyebrow="ROAD RISK INTELLIGENCE"
        title="Safety Map"
        action="Hyderabad Metro"
      />

      {/* Location Status Pill */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <MapPin
            size={14}
            color={locationStatus === 'granted' ? colors.teal : colors.muted}
          />
          <Text style={styles.statusText}>
            {locationStatus === 'granted' && userCoords
              ? `Location active: ${userCoords.latitude.toFixed(4)}°N, ${userCoords.longitude.toFixed(4)}°E`
              : 'Location unavailable'}
          </Text>
        </View>

        <Pressable onPress={loadData} style={styles.refreshBtn} hitSlop={6}>
          <RefreshCw size={13} color={colors.ink} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {/* Interactive Safety Map Container */}
      <View style={[styles.mapCard, shadow]}>
        <View style={styles.mapHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Layers size={16} color={colors.teal} />
            <Text style={styles.mapTitle}>TERRITORIAL RISK CORRIDORS</Text>
          </View>
          <Text style={styles.mapSubtitle}>OpenStreetMap Real Base</Text>
        </View>

        {/* Real Geographic Map Component (Shared SafetyMapView) */}
        <SafetyMapView
          zones={zones}
          hazardReports={hazardReports}
          userCoords={userCoords}
          onSelectZone={setSelectedZone}
          onSelectReport={setSelectedReport}
          height={340}
        />

        {/* Map Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
            <Text style={styles.legendText}>Low Risk</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.yellow }]} />
            <Text style={styles.legendText}>Moderate</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
            <Text style={styles.legendText}>High Risk</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: '#991B1B' }]} />
            <Text style={styles.legendText}>Critical</Text>
          </View>
        </View>
      </View>

      {/* NEARBY RISK SECTION */}
      <View style={styles.sectionHeaderWrap}>
        <View>
          <Text style={styles.nearbyEyebrow}>PROXIMITY RADAR</Text>
          <Text style={styles.nearbyTitle}>Nearby Risk</Text>
        </View>
        <Text style={styles.sortIndicator}>
          {userCoords ? 'Sorted by proximity' : 'Location unavailable'}
        </Text>
      </View>

      {/* List of Nearby Risks */}
      <View style={styles.riskList}>
        {nearbyRisks.map((item) => {
          const color = getRiskColor(item.level);

          return (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.zone) {
                  setSelectedZone(item.zone);
                } else if (item.hazard) {
                  setSelectedReport(item.hazard);
                }
              }}
              style={({ pressed }) => [
                styles.riskCard,
                shadow,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.riskDotLarge,
                    { backgroundColor: color },
                    item.level === 'CRITICAL' && styles.criticalOutline,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.riskItemTitle}>{item.title}</Text>
                    {item.isDemo && (
                      <View style={styles.demoPill}>
                        <Text style={styles.demoPillText}>DEMO DATA</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.riskItemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.distanceBadgeText, { color }]}>
                  {formatDistance(item.distanceMeters)}
                </Text>
                <Text style={styles.riskTierText}>{item.level}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Risk Zone Details Modal */}
      <RiskZoneDetailModal
        zone={selectedZone}
        visible={!!selectedZone}
        onClose={() => setSelectedZone(null)}
        userDistanceMeters={
          selectedZone && userCoords
            ? calculateHaversineDistance(
                userCoords.latitude,
                userCoords.longitude,
                selectedZone.latitude,
                selectedZone.longitude
              )
            : null
        }
      />

      {/* Hazard Report Details Modal */}
      <ReportDetailModal
        report={selectedReport}
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusBar: {
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
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.canvas,
  },
  refreshBtnText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  mapCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 18,
    width: '100%',
  },
  mapHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mapSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  nearbyEyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  nearbyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  sortIndicator: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  riskList: {
    gap: 10,
    paddingBottom: 24,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  riskDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  criticalOutline: {
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskItemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  riskItemSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  demoPill: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  demoPillText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  distanceBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  riskTierText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});

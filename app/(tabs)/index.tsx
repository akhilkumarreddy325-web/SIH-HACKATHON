import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Bell,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react-native';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertOverlay } from '@/components/AlertOverlay';
import { DrivingModeCard } from '@/components/DrivingModeCard';
import { FeedbackSheet } from '@/components/FeedbackSheet';
import { PermissionCard } from '@/components/PermissionCard';
import { RiskMap } from '@/components/RiskMap';
import { RouteSearchBar } from '@/components/RouteSearchBar';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import {
  calculateHaversineDistance,
  RiskZoneService,
} from '@/services/risk-zone-service';
import { ResolvedLocation, RoutePlanResult } from '@/types/navigation';
import { RiskLevel, RiskZone } from '@/types/risk-zone';

export default function Home() {
  const [startLocation, setStartLocation] = useState<ResolvedLocation | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<ResolvedLocation | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null);
  const [planned, setPlanned] = useState(false);
  const [driving, setDriving] = useState(false);
  const [permission, setPermission] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [alert, setAlert] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);

  const requestPermission = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermission(true);
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => setPermission(true),
        { enableHighAccuracy: true }
      );
    } else {
      setPermission(true);
    }
  };

  const handlePlanRoute = async (start: ResolvedLocation, dest: ResolvedLocation) => {
    setStartLocation(start);
    setDestinationLocation(dest);

    // 1. Calculate straight-line geographic distance using Haversine formula
    const distanceMeters = calculateHaversineDistance(
      start.latitude,
      start.longitude,
      dest.latitude,
      dest.longitude
    );
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));

    // 2. Discover nearby risk zones using RiskZoneService.findNearbyZones around destination and start
    const nearbyAroundDest = await RiskZoneService.findNearbyZones(dest.latitude, dest.longitude, 12000);
    const nearbyAroundStart = await RiskZoneService.findNearbyZones(start.latitude, start.longitude, 8000);

    // Combine and deduplicate
    const zoneMap = new Map<string, { zone: RiskZone; distanceMeters: number; isInsideZone: boolean }>();
    [...nearbyAroundDest, ...nearbyAroundStart].forEach((item) => {
      if (!zoneMap.has(item.zone.id)) {
        zoneMap.set(item.zone.id, item);
      }
    });
    const nearbyZones = Array.from(zoneMap.values());

    // 3. Determine highest nearby risk level
    const riskPriority: Record<RiskLevel, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MODERATE: 2,
      LOW: 1,
    };

    let highestRisk: RiskLevel = 'LOW';
    for (const item of nearbyZones) {
      if (riskPriority[item.zone.risk_level] > riskPriority[highestRisk]) {
        highestRisk = item.zone.risk_level;
      }
    }

    // 4. Formulate contextual caution advice
    let caution = 'Standard vigilance advised. Stay attentive to road signs and live hazard signals.';
    const criticalZone = nearbyZones.find((z) => z.zone.risk_level === 'CRITICAL');
    const highZone = nearbyZones.find((z) => z.zone.risk_level === 'HIGH');

    if (criticalZone) {
      caution = `High-risk corridor detected near ${criticalZone.zone.name} (${(criticalZone.distanceMeters / 1000).toFixed(1)} km away). ${criticalZone.zone.common_hazard}.`;
    } else if (highZone) {
      caution = `Elevated risk sector near ${highZone.zone.name} (${(highZone.distanceMeters / 1000).toFixed(1)} km away). ${highZone.zone.common_hazard}.`;
    }

    const planResult: RoutePlanResult = {
      startLocation: start,
      destinationLocation: dest,
      approxGeographicDistanceKm: distanceKm,
      approxGeographicDistanceMeters: distanceMeters,
      nearbyRiskZones: nearbyZones,
      highestNearbyRisk: highestRisk,
      cautionNotice: caution,
    };
    setRoutePlan(planResult);

    // 5. Persist trip to Supabase
    const { data, error } = await supabase
      .from('trips')
      .insert({
        start_point: start.name,
        destination: dest.name,
        distance_km: distanceKm,
        duration_min: Math.max(12, Math.round(distanceKm * 2.1)),
        risk_score: highestRisk.toLowerCase(),
        green_pct: highestRisk === 'CRITICAL' ? 38 : highestRisk === 'HIGH' ? 52 : 78,
        yellow_pct: highestRisk === 'CRITICAL' ? 32 : 30,
        red_pct: highestRisk === 'CRITICAL' ? 30 : 18,
      })
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      setTripId(data.id);
    }
    setPlanned(true);
  };

  const handleResetRoute = () => {
    setPlanned(false);
    setRoutePlan(null);
    setDestinationLocation(null);
    setTripId(null);
  };

  const submitFeedback = async (
    rating: number,
    hazard: boolean,
    note: string,
    audioUri?: string | null
  ) => {
    setSubmitting(true);
    const { error: fbError } = await supabase.from('route_feedback').insert({
      trip_id: tripId,
      safety_rating: rating,
      reported_hazards: hazard,
      confirmed_safe: !hazard,
      feedback_note: note || null,
    });
    if (fbError) {
      setSubmitting(false);
      Alert.alert('Submission failed', 'Could not save your feedback. Please try again.');
      return;
    }

    if (hazard) {
      let uploadedAudioPath: string | null = null;

      if (audioUri) {
        try {
          const response = await fetch(audioUri);
          const blob = await response.blob();
          const ext = audioUri.includes('.webm')
            ? 'webm'
            : audioUri.includes('.wav')
            ? 'wav'
            : 'm4a';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const storagePath = `reports/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('hazard-report-audio')
            .upload(storagePath, blob, {
              contentType: blob.type || (ext === 'webm' ? 'audio/webm' : 'audio/m4a'),
              upsert: false,
            });

          if (uploadError) {
            console.warn('Audio upload warning:', uploadError.message);
          } else if (uploadData?.path) {
            uploadedAudioPath = uploadData.path;
          }
        } catch (uploadEx: any) {
          console.warn('Audio processing failed:', uploadEx?.message);
        }
      }

      const { error: hzError } = await supabase.from('hazard_reports').insert({
        trip_id: tripId || null,
        hazard_type: 'other',
        severity: 'yellow',
        description:
          note?.trim() ||
          (uploadedAudioPath
            ? 'Voice hazard report'
            : 'User-reported hazard from post-trip feedback'),
        zone_type: 'yellow',
        status: 'pending',
        audio_path: uploadedAudioPath,
        latitude: destinationLocation?.latitude ?? userCoords?.latitude ?? null,
        longitude: destinationLocation?.longitude ?? userCoords?.longitude ?? null,
      });
      if (hzError) {
        setSubmitting(false);
        Alert.alert(
          'Submission failed',
          'Your feedback was saved but the hazard report could not be created. Please try again.'
        );
        return;
      }
    }

    if (tripId) {
      const { error: completeError } = await supabase.rpc('complete_trip', { p_trip_id: tripId });
      if (completeError) {
        setSubmitting(false);
        Alert.alert(
          'Trip completion issue',
          'Your feedback was submitted, but we could not close the active trip. Please try again.'
        );
        return;
      }
    }

    setSubmitting(false);
    setFeedback(false);
    Alert.alert('Report received', 'Thanks for helping keep NearMiss accurate.');
  };

  const getRiskBadgeColor = (risk?: RiskLevel) => {
    switch (risk) {
      case 'CRITICAL':
        return { text: colors.red, bg: colors.redSoft };
      case 'HIGH':
        return { text: '#E65100', bg: '#FFF3E0' };
      case 'MODERATE':
        return { text: colors.yellow, bg: colors.yellowSoft };
      default:
        return { text: colors.green, bg: colors.greenSoft };
    }
  };

  return (
    <Screen>
      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>GOOD MORNING</Text>
          <Text style={styles.title}>Travel with clarity.</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>NM</Text>
        </View>
      </View>

      <PermissionCard granted={permission} onGrant={requestPermission} />

      {/* Dynamic Route Search Bar */}
      <RouteSearchBar
        onPlanRoute={handlePlanRoute}
        userCoords={userCoords}
        onRequestUserLocation={requestPermission}
      />

      {!planned ? (
        <>
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <ShieldCheck size={21} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>A calmer way to drive</Text>
              <Text style={styles.introBody}>
                NearMiss calculates risk corridors ahead, not just the road map.
              </Text>
            </View>
          </View>

          {/* Interactive Hyderabad Map */}
          <RiskMap />

          <DrivingModeCard active={driving} onToggle={() => setDriving(!driving)} />
        </>
      ) : (
        <>
          {/* Active Route Header */}
          <View style={styles.routeHeader}>
            <View>
              <Text style={styles.routeKicker}>ACTIVE SAFE CORRIDOR</Text>
              <Text style={styles.routeTitle}>
                To {destinationLocation?.name || 'Destination'}
              </Text>
            </View>
            <Pressable onPress={handleResetRoute} style={styles.resetBtn}>
              <RotateCcw size={13} color={colors.muted} />
              <Text style={styles.resetBtnText}>New search</Text>
            </Pressable>
          </View>

          {/* Planned Route Intelligence Card */}
          {routePlan && (
            <View style={[styles.routePlanCard, shadow]}>
              <View style={styles.trajectoryHeader}>
                <View style={styles.trajectoryStep}>
                  <MapPin size={15} color={colors.teal} />
                  <Text style={styles.trajectoryLocName}>
                    {routePlan.startLocation.name}
                  </Text>
                </View>

                <View style={styles.trajectoryConnector}>
                  <ArrowDown size={14} color={colors.muted} />
                  <View style={styles.distancePill}>
                    <Text style={styles.distanceLabel}>Approx. geographic distance:</Text>
                    <Text style={styles.distanceVal}>
                      {routePlan.approxGeographicDistanceKm} km
                    </Text>
                  </View>
                  <ArrowDown size={14} color={colors.muted} />
                </View>

                <View style={styles.trajectoryStep}>
                  <Navigation size={15} color={colors.red} />
                  <Text style={styles.trajectoryLocName}>
                    {routePlan.destinationLocation.name}
                  </Text>
                </View>
              </View>

              {/* Highest Nearby Risk Banner */}
              <View style={styles.riskTierRow}>
                <Text style={styles.riskTierLabel}>CORRIDOR RISK PROFILE:</Text>
                <View
                  style={[
                    styles.riskTierBadge,
                    { backgroundColor: getRiskBadgeColor(routePlan.highestNearbyRisk).bg },
                  ]}
                >
                  <ShieldAlert
                    size={12}
                    color={getRiskBadgeColor(routePlan.highestNearbyRisk).text}
                  />
                  <Text
                    style={[
                      styles.riskTierText,
                      { color: getRiskBadgeColor(routePlan.highestNearbyRisk).text },
                    ]}
                  >
                    {routePlan.highestNearbyRisk}
                  </Text>
                </View>
              </View>

              {/* Contextual Caution Notice */}
              <View style={styles.cautionNoticeBox}>
                <AlertTriangle size={15} color="#E65100" />
                <Text style={styles.cautionNoticeText}>
                  {routePlan.cautionNotice}
                </Text>
              </View>

              {/* Nearby Risk Zones along the trajectory */}
              {routePlan.nearbyRiskZones.length > 0 && (
                <View style={styles.nearbyZonesSection}>
                  <Text style={styles.nearbyZonesTitle}>
                    MONITORED RISK ZONES NEAR ROUTE ({routePlan.nearbyRiskZones.length})
                  </Text>
                  {routePlan.nearbyRiskZones.map(({ zone, distanceMeters }) => (
                    <View key={zone.id} style={styles.nearbyZoneRow}>
                      <View
                        style={[
                          styles.zoneDotSmall,
                          {
                            backgroundColor:
                              zone.risk_level === 'CRITICAL'
                                ? colors.red
                                : zone.risk_level === 'HIGH'
                                ? '#E65100'
                                : colors.yellow,
                          },
                        ]}
                      />
                      <Text style={styles.nearbyZoneName} numberOfLines={1}>
                        {zone.name}
                      </Text>
                      <Text style={styles.nearbyZoneDist}>
                        {(distanceMeters / 1000).toFixed(1)} km away
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Active Risk Map showing Start, Destination, and connecting trajectory */}
          <RiskMap
            startLocation={startLocation}
            destinationLocation={destinationLocation}
          />

          {/* Quick Metrics */}
          <View style={styles.stats}>
            <Stat
              icon={<Clock3 size={17} color={colors.teal} />}
              value={routePlan ? `${Math.max(12, Math.round(routePlan.approxGeographicDistanceKm * 2.1))} min` : '24 min'}
              label="estimated"
            />
            <Stat
              icon={<Activity size={17} color={colors.yellow} />}
              value={routePlan ? `${routePlan.approxGeographicDistanceKm} km` : '12.4 km'}
              label="straight-line"
            />
            <Stat
              icon={<Bell size={17} color={colors.red} />}
              value={`${routePlan ? routePlan.nearbyRiskZones.length : 3} alerts`}
              label="near corridor"
            />
          </View>

          <DrivingModeCard active={driving} onToggle={() => setDriving(!driving)} />

          <Pressable onPress={() => setAlert(true)} style={styles.demoButton}>
            <Bell size={16} color={colors.red} />
            <Text style={styles.demoText}>Preview high-risk alert</Text>
          </Pressable>

          <Pressable onPress={() => setFeedback(true)} style={styles.complete}>
            <CheckCircle2 size={18} color="#fff" />
            <Text style={styles.completeText}>Simulate arrival & report</Text>
          </Pressable>

          {feedback && <FeedbackSheet onSubmit={submitFeedback} />}
        </>
      )}

      <AlertOverlay visible={alert} onDismiss={() => setAlert(false)} />
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  greeting: {
    color: colors.teal,
    letterSpacing: 1.7,
    fontWeight: '900',
    fontSize: 11,
  },
  title: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 28,
    marginTop: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 16,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  introBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeKicker: {
    color: colors.teal,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  routeTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  resetBtnText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  routePlanCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  trajectoryHeader: {
    marginBottom: 12,
  },
  trajectoryStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trajectoryLocName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  trajectoryConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
    marginVertical: 4,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  distanceVal: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
  },
  riskTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  riskTierLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  riskTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskTierText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cautionNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  cautionNoticeText: {
    color: '#8D6E63',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  nearbyZonesSection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  nearbyZonesTitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  nearbyZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  zoneDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nearbyZoneName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  nearbyZoneDist: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  stats: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginBottom: 18,
    ...shadow,
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 14,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  demoButton: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  demoText: {
    color: colors.red,
    fontWeight: '800',
    fontSize: 13,
  },
  complete: {
    backgroundColor: colors.teal,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  completeText: {
    color: '#fff',
    fontWeight: '800',
  },
});

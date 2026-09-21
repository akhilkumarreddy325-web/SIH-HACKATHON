import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
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
import { LiveSafetyAlertBanner } from '@/components/LiveSafetyAlertBanner';
import { PermissionCard } from '@/components/PermissionCard';
import { ReportConfirmationToast } from '@/components/ReportConfirmationToast';
import { RiskMap } from '@/components/RiskMap';
import { RouteSearchBar } from '@/components/RouteSearchBar';
import { Screen } from '@/components/Screen';
import { useRealDrivingCaution } from '@/hooks/useRealDrivingCaution';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import {
  calculateHaversineDistance,
  RiskZoneService,
} from '@/services/risk-zone-service';
import { RoutingService } from '@/services/routing-service';
import { DrivingRoute, ResolvedLocation, RoutePlanResult } from '@/types/navigation';
import { RiskLevel, RiskZone } from '@/types/risk-zone';

export default function Home() {
  const { user, profile } = useAuth();
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
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [showTurnByTurn, setShowTurnByTurn] = useState(false);

  // Live Location-Aware Driving Caution System
  const {
    activeAlert: cautionAlert,
    dismissActiveAlert,
    refreshSafetyData,
  } = useRealDrivingCaution({
    drivingRoute: routePlan?.drivingRoute,
    autoStart: planned,
  });

  // Report Submission Confirmation Toast
  const [toast, setToast] = useState<{
    visible: boolean;
    status: 'success' | 'error';
    title: string;
    message: string;
  }>({
    visible: false,
    status: 'success',
    title: '',
    message: '',
  });

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
    setPlanned(true);
    setIsCalculatingRoute(true);
    setRoutingError(null);
    setShowTurnByTurn(false);

    // Straight-line fallback distance for secondary geographic calculation
    const straightDistanceMeters = calculateHaversineDistance(
      start.latitude,
      start.longitude,
      dest.latitude,
      dest.longitude
    );
    const approxKm = Number((straightDistanceMeters / 1000).toFixed(1));

    // 1. Fetch Real Road Driving Route using OSRM
    const routingResult = await RoutingService.getDrivingRoute(start, dest);

    // 2. Fetch all current risk zones to perform route corridor risk evaluation
    const allZones = await RiskZoneService.getZones();

    let nearbyZones: Array<{ zone: RiskZone; distanceMeters: number; isInsideZone: boolean }> = [];
    let drivingDistKm: number | undefined;
    let drivingDurMin: number | undefined;
    let drivingRoute: DrivingRoute | null = null;
    let status: 'found' | 'failed' = 'failed';

    if (routingResult.success && routingResult.route) {
      drivingRoute = routingResult.route;
      drivingDistKm = routingResult.route.distanceKm;
      drivingDurMin = routingResult.route.durationMinutes;
      status = 'found';

      // Correlate the entire road geometry with all known risk zones (1.5 km corridor buffer)
      nearbyZones = RoutingService.findRiskZonesAlongRoute(
        routingResult.route.coordinates,
        allZones,
        1500
      );
    } else {
      status = 'failed';
      setRoutingError(routingResult.error || 'Unable to calculate road route. Please try again.');
    }

    // 3. Determine highest risk level along the corridor
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
    let caution = 'Standard vigilance advised along this route. Stay attentive to road conditions.';
    const criticalZone = nearbyZones.find((z) => z.zone.risk_level === 'CRITICAL');
    const highZone = nearbyZones.find((z) => z.zone.risk_level === 'HIGH');

    if (criticalZone) {
      caution = `High-risk corridor detected near ${criticalZone.zone.name} (${(criticalZone.distanceMeters / 1000).toFixed(1)} km from route). ${criticalZone.zone.common_hazard}.`;
    } else if (highZone) {
      caution = `Elevated risk sector near ${highZone.zone.name} (${(highZone.distanceMeters / 1000).toFixed(1)} km from route). ${highZone.zone.common_hazard}.`;
    }

    const planResult: RoutePlanResult = {
      startLocation: start,
      destinationLocation: dest,
      approxGeographicDistanceKm: approxKm,
      approxGeographicDistanceMeters: straightDistanceMeters,
      drivingDistanceKm: drivingDistKm,
      drivingDurationMinutes: drivingDurMin,
      drivingRoute,
      routeStatus: status,
      errorMessage: routingResult.error,
      nearbyRiskZones: nearbyZones,
      highestNearbyRisk: highestRisk,
      cautionNotice: caution,
    };

    setRoutePlan(planResult);
    setIsCalculatingRoute(false);

    // 5. Persist trip to Supabase if route found
    if (status === 'found') {
      const { data, error } = await supabase
        .from('trips')
        .insert({
          start_point: start.name,
          destination: dest.name,
          distance_km: drivingDistKm ?? approxKm,
          duration_min: drivingDurMin ?? Math.max(12, Math.round(approxKm * 2.1)),
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
    }
  };

  const handleResetRoute = () => {
    setPlanned(false);
    setRoutePlan(null);
    setDestinationLocation(null);
    setTripId(null);
    setRoutingError(null);
    setIsCalculatingRoute(false);
    setShowTurnByTurn(false);
  };

  const submitFeedback = async (
    rating: number,
    hazard: boolean,
    note: string,
    audioUri?: string | null,
    hazardType?: string
  ) => {
    setSubmitting(true);
    try {
      const { error: fbError } = await supabase.from('route_feedback').insert({
        trip_id: tripId,
        safety_rating: rating,
        reported_hazards: hazard,
        confirmed_safe: !hazard,
        feedback_note: note || null,
      });

      if (fbError) {
        setToast({
          visible: true,
          status: 'error',
          title: '❌ Report Failed',
          message: fbError.message || 'Could not save feedback. Please try again.',
        });
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

            if (!uploadError && uploadData?.path) {
              uploadedAudioPath = uploadData.path;
            }
          } catch (uploadEx: any) {
            console.warn('Audio processing failed:', uploadEx?.message);
          }
        }

        const reportLat = destinationLocation?.latitude ?? userCoords?.latitude ?? 17.4485;
        const reportLon = destinationLocation?.longitude ?? userCoords?.longitude ?? 78.3758;

        const { error: hzError } = await supabase.from('hazard_reports').insert({
          trip_id: tripId || null,
          hazard_type: hazardType || 'other',
          severity: 'yellow',
          description:
            note?.trim() ||
            (uploadedAudioPath
              ? 'Voice hazard report'
              : 'User-reported hazard from post-trip feedback'),
          zone_type: 'yellow',
          status: 'pending',
          audio_path: uploadedAudioPath,
          latitude: reportLat,
          longitude: reportLon,
        });

        if (hzError) {
          setToast({
            visible: true,
            status: 'error',
            title: '❌ Report Failed',
            message: 'Feedback was saved but the hazard report could not be created. Please try again.',
          });
          return;
        }

        // Refresh live caution data so the new report is included
        refreshSafetyData();
      }

      if (tripId) {
        await supabase.rpc('complete_trip', { p_trip_id: tripId });
      }

      setFeedback(false);
      setToast({
        visible: true,
        status: 'success',
        title: '✓ Report Submitted',
        message: 'Thank you. Your safety report has been recorded.',
      });
    } catch (err: any) {
      setToast({
        visible: true,
        status: 'error',
        title: '❌ Report Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
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
      {/* PHASE 1: App Header with TRAVEL SAFE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>TRAVEL SAFE</Text>
          <Text style={styles.title}>Travel with clarity.</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name ? profile.name.slice(0, 2).toUpperCase() : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'NM')}</Text>
        </View>
      </View>

      <PermissionCard granted={permission} onGrant={requestPermission} />

      {/* Dynamic Route Search Bar */}
      <RouteSearchBar
        onPlanRoute={handlePlanRoute}
        userCoords={userCoords}
        onRequestUserLocation={requestPermission}
      />

      {/* PHASE 2: Live Safety Alert Banner */}
      <LiveSafetyAlertBanner
        alert={cautionAlert}
        onDismiss={dismissActiveAlert}
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

          {/* Loading State Banner */}
          {isCalculatingRoute && (
            <View style={styles.loadingRouteBanner}>
              <Activity size={18} color={colors.teal} />
              <Text style={styles.loadingRouteText}>Calculating safest route...</Text>
            </View>
          )}

          {/* Error State Banner */}
          {routingError && !isCalculatingRoute && (
            <View style={styles.errorRouteBanner}>
              <AlertCircle size={18} color={colors.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorRouteTitle}>Route Calculation Failed</Text>
                <Text style={styles.errorRouteText}>{routingError}</Text>
              </View>
            </View>
          )}

          {/* Planned Route Intelligence Card */}
          {routePlan && !isCalculatingRoute && routePlan.routeStatus === 'found' && (
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
                    <Text style={styles.distanceLabel}>Driving distance:</Text>
                    <Text style={styles.distanceVal}>
                      {routePlan.drivingDistanceKm} km
                    </Text>
                  </View>
                  <View style={styles.etaPill}>
                    <Clock3 size={11} color={colors.teal} />
                    <Text style={styles.etaVal}>
                      ~{routePlan.drivingDurationMinutes} min
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

              {/* Route Status Row */}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>ROUTE STATUS:</Text>
                <View style={styles.statusBadge}>
                  <Check size={12} color="#065F46" />
                  <Text style={styles.statusText}>Route found</Text>
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

              {/* Contextual Safety Advisory */}
              <View style={styles.cautionNoticeBox}>
                <AlertTriangle size={16} color="#E65100" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cautionNoticeHeader}>SAFETY ADVISORY</Text>
                  <Text style={styles.cautionNoticeText}>
                    {routePlan.cautionNotice}
                  </Text>
                </View>
              </View>

              {/* Monitored Risk Zones along the road route */}
              <View style={styles.nearbyZonesSection}>
                <Text style={styles.nearbyZonesTitle}>
                  RISK ZONES NEAR ROUTE ({routePlan.nearbyRiskZones.length})
                </Text>
                {routePlan.nearbyRiskZones.length === 0 ? (
                  <Text style={styles.noZonesText}>No high-risk zones detected along this corridor.</Text>
                ) : (
                  routePlan.nearbyRiskZones.map(({ zone, distanceMeters }) => (
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
                  ))
                )}
              </View>

              {/* Turn-by-Turn Navigation Accordion */}
              {routePlan.drivingRoute && routePlan.drivingRoute.steps.length > 0 && (
                <View style={styles.stepsSection}>
                  <Pressable
                    onPress={() => setShowTurnByTurn(!showTurnByTurn)}
                    style={styles.stepsToggleBtn}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Compass size={14} color={colors.teal} />
                      <Text style={styles.stepsToggleText}>
                        Turn-by-turn directions ({routePlan.drivingRoute.steps.length} steps)
                      </Text>
                    </View>
                    {showTurnByTurn ? (
                      <ChevronUp size={16} color={colors.muted} />
                    ) : (
                      <ChevronDown size={16} color={colors.muted} />
                    )}
                  </Pressable>

                  {showTurnByTurn && (
                    <View style={styles.stepsList}>
                      {routePlan.drivingRoute.steps.map((step, idx) => (
                        <View key={idx} style={styles.stepItem}>
                          <View style={styles.stepNumberBadge}>
                            <Text style={styles.stepNumberText}>{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.stepInstructionText}>{step.instruction}</Text>
                            <Text style={styles.stepMetaText}>
                              {step.distanceMeters > 1000
                                ? `${(step.distanceMeters / 1000).toFixed(1)} km`
                                : `${step.distanceMeters} m`}{' '}
                              • {step.durationSeconds > 60 ? `${Math.round(step.durationSeconds / 60)} min` : `${step.durationSeconds}s`}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Active Risk Map showing Start, Destination, and Real Road Geometry */}
          <RiskMap
            startLocation={startLocation}
            destinationLocation={destinationLocation}
            drivingRoute={routePlan?.drivingRoute}
            routeStatus={isCalculatingRoute ? 'calculating' : routePlan?.routeStatus}
          />

          {/* Quick Metrics */}
          <View style={styles.stats}>
            <Stat
              icon={<Clock3 size={17} color={colors.teal} />}
              value={
                routePlan?.drivingDurationMinutes
                  ? `${routePlan.drivingDurationMinutes} min`
                  : routePlan
                  ? `${Math.max(12, Math.round(routePlan.approxGeographicDistanceKm * 2.1))} min`
                  : '24 min'
              }
              label="driving time"
            />
            <Stat
              icon={<Activity size={17} color={colors.yellow} />}
              value={
                routePlan?.drivingDistanceKm
                  ? `${routePlan.drivingDistanceKm} km`
                  : routePlan
                  ? `${routePlan.approxGeographicDistanceKm} km`
                  : '12.4 km'
              }
              label="road distance"
            />
            <Stat
              icon={<Bell size={17} color={colors.red} />}
              value={`${routePlan ? routePlan.nearbyRiskZones.length : 3} alerts`}
              label="corridor risks"
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

      {/* PHASE 4: Report Submission Confirmation Toast */}
      <ReportConfirmationToast
        visible={toast.visible}
        status={toast.status}
        title={toast.title}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
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
  loadingRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  loadingRouteText: {
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 13,
  },
  errorRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  errorRouteTitle: {
    color: '#991B1B',
    fontWeight: '800',
    fontSize: 13,
  },
  errorRouteText: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 12,
    marginTop: 2,
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
    marginVertical: 6,
    flexWrap: 'wrap',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distanceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  distanceVal: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '900',
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  etaVal: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  cautionNoticeHeader: {
    color: '#E65100',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cautionNoticeText: {
    color: '#8D6E63',
    fontSize: 11,
    fontWeight: '600',
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
  noZonesText: {
    color: colors.muted,
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
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
  stepsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stepsToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  stepsToggleText: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
  },
  stepsList: {
    marginTop: 8,
    gap: 8,
    maxHeight: 220,
    overflow: 'scroll',
    backgroundColor: colors.canvas,
    borderRadius: 10,
    padding: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '800',
  },
  stepInstructionText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  stepMetaText: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 1,
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

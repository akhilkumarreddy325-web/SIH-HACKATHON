import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSettingsState } from '@/lib/settings-provider';
import { supabase } from '@/lib/supabase';
import { DrivingCautionService, UserPosition } from '@/services/driving-caution-service';
import { calculateHaversineDistance, RiskZoneService } from '@/services/risk-zone-service';
import { ActiveSafetyAlert, DrivingRoute } from '@/types/navigation';
import { RiskZone } from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';

export function useRealDrivingCaution({
  drivingRoute,
  autoStart = false,
}: {
  drivingRoute?: DrivingRoute | null;
  autoStart?: boolean;
} = {}) {
  const { voiceGuidance, hazardAlerts } = useSettingsState();
  const [userLocation, setUserLocation] = useState<UserPosition | null>(null);
  const [activeAlert, setActiveAlert] = useState<ActiveSafetyAlert | null>(null);
  const [upcomingHazards, setUpcomingHazards] = useState<ActiveSafetyAlert[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Store mutable refs to avoid re-triggering watch effects
  const drivingRouteRef = useRef<DrivingRoute | null>(drivingRoute ?? null);
  const voiceGuidanceRef = useRef(voiceGuidance);
  const hazardAlertsRef = useRef(hazardAlerts);
  const dismissedIdRef = useRef<string | null>(dismissedId);
  const zonesRef = useRef<RiskZone[]>([]);
  const reportsRef = useRef<HazardReport[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastEvaluatedPosRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

  useEffect(() => {
    drivingRouteRef.current = drivingRoute ?? null;
  }, [drivingRoute]);

  useEffect(() => {
    voiceGuidanceRef.current = voiceGuidance;
  }, [voiceGuidance]);

  useEffect(() => {
    hazardAlertsRef.current = hazardAlerts;
  }, [hazardAlerts]);

  useEffect(() => {
    dismissedIdRef.current = dismissedId;
  }, [dismissedId]);

  // 1. Fetch risk zones and hazard reports once
  const loadSafetyData = useCallback(async () => {
    try {
      const z = await RiskZoneService.getZones();
      zonesRef.current = z;

      const { data: repData } = await supabase
        .from('hazard_reports')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (repData) {
        reportsRef.current = repData as unknown as HazardReport[];
      }
    } catch (err) {
      console.warn('Error loading safety caution data:', err);
    }
  }, []);

  useEffect(() => {
    loadSafetyData();
  }, [loadSafetyData]);

  // 2. Perform evaluation with throttle
  const evaluatePosition = useCallback((pos: UserPosition) => {
    if (!hazardAlertsRef.current) {
      setActiveAlert(null);
      setUpcomingHazards([]);
      return;
    }

    const now = Date.now();
    const last = lastEvaluatedPosRef.current;
    if (last) {
      const dist = calculateHaversineDistance(last.lat, last.lon, pos.latitude, pos.longitude);
      // Only re-evaluate if moved by > 10m or > 3 seconds elapsed
      if (dist < 10 && now - last.time < 3000) {
        return;
      }
    }
    lastEvaluatedPosRef.current = { lat: pos.latitude, lon: pos.longitude, time: now };

    const result = DrivingCautionService.evaluate({
      userCoords: pos,
      drivingRoute: drivingRouteRef.current,
      riskZones: zonesRef.current,
      hazardReports: reportsRef.current,
      voiceEnabled: voiceGuidanceRef.current,
    });

    setUpcomingHazards(result.upcomingHazards);

    if (result.activeAlert && result.activeAlert.id !== dismissedIdRef.current) {
      setActiveAlert(result.activeAlert);
    } else if (!result.activeAlert) {
      setActiveAlert(null);
    }
  }, []);

  // 3. Start Geolocation Tracking
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const userPos: UserPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          };
          setUserLocation(userPos);
          evaluatePosition(userPos);
        },
        (err) => {
          console.warn('Geolocation watch error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );
      watchIdRef.current = id;
      setIsTracking(true);
    } else {
      setIsTracking(true);
    }
  }, [evaluatePosition]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setActiveAlert(null);
    lastEvaluatedPosRef.current = null;
    DrivingCautionService.reset();
  }, []);

  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [autoStart, startTracking, stopTracking]);

  // Re-run evaluation when route changes
  useEffect(() => {
    if (userLocation) {
      evaluatePosition(userLocation);
    }
  }, [drivingRoute, evaluatePosition, userLocation]);

  const dismissActiveAlert = () => {
    if (activeAlert) {
      setDismissedId(activeAlert.id);
      setActiveAlert(null);
    }
  };

  return {
    userLocation,
    activeAlert,
    upcomingHazards,
    isTracking,
    startTracking,
    stopTracking,
    dismissActiveAlert,
    refreshSafetyData: loadSafetyData,
  };
}
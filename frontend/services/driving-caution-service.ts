/**
 * NearMiss / SafePath AI: Real-Time Driving Caution Service
 * Evaluates real GPS position against actual road route geometry, risk zones,
 * and live community hazard reports to trigger synchronized voice, vibration,
 * and visual alerts with deduplication and anti-spam protection.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { calculateHaversineDistance } from '@/services/risk-zone-service';
import { ActiveSafetyAlert, AlertState, DrivingRoute } from '@/types/navigation';
import { RiskLevel, RiskZone } from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';

export interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

interface AlertTrackingRecord {
  id: string;
  state: AlertState;
  lastSpokenTier: number; // 0 = none, 1 = approaching (500m), 2 = critical (150m)
  lastSpokenTime: number;
  closestDistanceSoFar: number;
}

export class DrivingCautionService {
  private static alertTracking = new Map<string, AlertTrackingRecord>();
  private static lastGlobalVoiceTime = 0;
  private static readonly VOICE_COOLDOWN_MS = 6000; // 6 second buffer between voice alerts

  /**
   * Clears tracked alert history (e.g. on new trip start or route reset)
   */
  public static reset() {
    this.alertTracking.clear();
    this.lastGlobalVoiceTime = 0;
    this.cancelSpeech();
  }

  /**
   * Device Vibration / Haptic Feedback
   */
  public static triggerVibration(pattern: 'warning' | 'critical') {
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          if (pattern === 'critical') {
            navigator.vibrate([300, 100, 300]);
          } else {
            navigator.vibrate(200);
          }
        }
      } catch {}
      return;
    }

    try {
      if (pattern === 'critical') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
  }

  /**
   * Speech Synthesis / Voice Alerts
   */
  public static speak(text: string, voiceEnabled: boolean) {
    if (!voiceEnabled) return;
    const now = Date.now();
    if (now - this.lastGlobalVoiceTime < this.VOICE_COOLDOWN_MS) {
      return; // Respect voice cooldown to prevent spam
    }
    this.lastGlobalVoiceTime = now;

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel(); // Stop any pending utterance
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } catch {}
      return;
    }

    try {
      Speech.stop();
      Speech.speak(text, { language: 'en-US', rate: 0.95 });
    } catch {}
  }

  public static cancelSpeech() {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {}
    } else {
      try {
        Speech.stop();
      } catch {}
    }
  }

  /**
   * Evaluates current user position against route geometry, risk zones, and hazards.
   * Returns the most urgent active safety alert along with all upcoming hazards.
   */
  public static evaluate({
    userCoords,
    drivingRoute,
    riskZones = [],
    hazardReports = [],
    voiceEnabled = true,
  }: {
    userCoords: UserPosition | null;
    drivingRoute?: DrivingRoute | null;
    riskZones?: RiskZone[];
    hazardReports?: HazardReport[];
    voiceEnabled?: boolean;
  }): {
    activeAlert: ActiveSafetyAlert | null;
    upcomingHazards: ActiveSafetyAlert[];
    alertCount: number;
  } {
    if (!userCoords || typeof userCoords.latitude !== 'number' || typeof userCoords.longitude !== 'number') {
      return { activeAlert: null, upcomingHazards: [], alertCount: 0 };
    }

    // Discard ultra-inaccurate GPS positions (> 120m) to prevent misleading alerts
    if (userCoords.accuracy && userCoords.accuracy > 120) {
      return { activeAlert: null, upcomingHazards: [], alertCount: 0 };
    }

    const { latitude: uLat, longitude: uLon } = userCoords;
    const routeCoords = drivingRoute?.coordinates;

    // 1. If Route exists, find user's current progress index along the road coordinates
    let userRouteIdx = -1;
    let minUserRouteDist = Infinity;
    if (routeCoords && routeCoords.length > 0) {
      for (let i = 0; i < routeCoords.length; i++) {
        const [rLat, rLon] = routeCoords[i];
        const d = calculateHaversineDistance(uLat, uLon, rLat, rLon);
        if (d < minUserRouteDist) {
          minUserRouteDist = d;
          userRouteIdx = i;
        }
      }
    }

    const candidates: ActiveSafetyAlert[] = [];

    // Helper to evaluate a target location
    const evaluateTarget = (
      id: string,
      targetLat: number,
      targetLon: number,
      riskLevel: RiskLevel,
      title: string,
      subtitle: string,
      hazardType: string,
      isHazardReport: boolean
    ) => {
      let isAhead = true;
      let distanceMeters = calculateHaversineDistance(uLat, uLon, targetLat, targetLon);

      // Route-aware evaluation
      if (routeCoords && routeCoords.length > 0 && userRouteIdx >= 0) {
        // Find closest point on route to target
        let targetRouteIdx = -1;
        let minTargetDist = Infinity;
        for (let i = 0; i < routeCoords.length; i++) {
          const [rLat, rLon] = routeCoords[i];
          const d = calculateHaversineDistance(targetLat, targetLon, rLat, rLon);
          if (d < minTargetDist) {
            minTargetDist = d;
            targetRouteIdx = i;
          }
        }

        // If target is farther than 1200m away from the road network, it does not impact this route
        if (minTargetDist > 1200) {
          return;
        }

        // Check if user has already passed the target along the route
        if (targetRouteIdx < userRouteIdx - 2 && distanceMeters > 80) {
          isAhead = false;
        }

        // Compute along-route distance if ahead
        if (isAhead && targetRouteIdx >= userRouteIdx) {
          let routeAccumMeters = 0;
          for (let i = userRouteIdx; i < targetRouteIdx; i++) {
            const [p1Lat, p1Lon] = routeCoords[i];
            const [p2Lat, p2Lon] = routeCoords[i + 1];
            routeAccumMeters += calculateHaversineDistance(p1Lat, p1Lon, p2Lat, p2Lon);
          }
          // Distance is route accumulation plus distance from route to hazard
          distanceMeters = Math.round(routeAccumMeters + minTargetDist);
        }
      }

      // Check tracking state
      let record = this.alertTracking.get(id);
      if (!record) {
        record = {
          id,
          state: 'unseen',
          lastSpokenTier: 0,
          lastSpokenTime: 0,
          closestDistanceSoFar: distanceMeters,
        };
        this.alertTracking.set(id, record);
      }

      // Update closest distance
      if (distanceMeters < record.closestDistanceSoFar) {
        record.closestDistanceSoFar = distanceMeters;
      }

      // Mark as passed if user is beyond target or distance has been increasing after < 60m
      if (!isAhead || (record.closestDistanceSoFar < 60 && distanceMeters > record.closestDistanceSoFar + 45)) {
        record.state = 'passed';
        return;
      }

      // If already passed, do not alert again
      if (record.state === 'passed') {
        return;
      }

      // Determine alert tier based on road distance
      let currentTier = 0;
      let alertState: AlertState = 'unseen';

      if (distanceMeters <= 160) {
        currentTier = 2; // Critical immediate zone
        alertState = 'warned';
      } else if (distanceMeters <= 500) {
        currentTier = 1; // Advance caution notice
        alertState = 'approaching';
      }

      record.state = alertState;

      // Only add to active candidates if within 600m
      if (distanceMeters <= 600) {
        candidates.push({
          id,
          title,
          subtitle,
          hazardType,
          riskLevel,
          distanceMeters,
          alertState,
          coordinates: [targetLat, targetLon],
          isHazardReport,
          timestamp: Date.now(),
        });

        // Trigger voice and vibration if entering a higher tier
        if (currentTier > record.lastSpokenTier) {
          record.lastSpokenTier = currentTier;
          record.lastSpokenTime = Date.now();

          if (currentTier === 2) {
            // Critical warning (immediate danger)
            this.triggerVibration('critical');
            const voiceMsg = isHazardReport
              ? `Warning. Reported ${hazardType.replace(/_/g, ' ')} ahead in ${distanceMeters} meters. Slow down.`
              : `Warning. High-risk danger zone ahead. Please slow down and proceed with caution.`;
            this.speak(voiceMsg, voiceEnabled);
          } else if (currentTier === 1) {
            // Advance notice
            this.triggerVibration('warning');
            const voiceMsg = isHazardReport
              ? `Safety warning. Reported hazard ahead in ${distanceMeters} meters.`
              : `Caution. High-risk area ahead on your route in ${distanceMeters} meters.`;
            this.speak(voiceMsg, voiceEnabled);
          }
        }
      }
    };

    // Evaluate all Risk Zones
    for (const zone of riskZones) {
      if (typeof zone.latitude !== 'number' || typeof zone.longitude !== 'number') continue;
      evaluateTarget(
        `zone_${zone.id}`,
        zone.latitude,
        zone.longitude,
        zone.risk_level,
        zone.name,
        zone.common_hazard || `${zone.risk_level} risk intersection`,
        'risk_zone',
        false
      );
    }

    // Evaluate all Hazard Reports
    for (const report of hazardReports) {
      if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') continue;
      const riskLevel: RiskLevel =
        report.severity === 'red' || report.severity === 'critical'
          ? 'CRITICAL'
          : report.severity === 'yellow' || report.severity === 'high'
          ? 'HIGH'
          : 'MODERATE';

      const typeLabel = (report.hazard_type || 'Road hazard').replace(/_/g, ' ');
      evaluateTarget(
        `report_${report.id}`,
        report.latitude,
        report.longitude,
        riskLevel,
        `Reported ${typeLabel}`,
        report.description || 'Verified road hazard reported by driver',
        report.hazard_type || 'hazard',
        true
      );
    }

    // Sort candidates by priority (CRITICAL > HIGH > MODERATE > LOW) and distance
    const priorityWeight: Record<RiskLevel, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MODERATE: 2,
      LOW: 1,
    };

    candidates.sort((a, b) => {
      const pDiff = priorityWeight[b.riskLevel] - priorityWeight[a.riskLevel];
      if (pDiff !== 0) return pDiff;
      return a.distanceMeters - b.distanceMeters;
    });

    const primaryAlert = candidates.length > 0 ? candidates[0] : null;

    return {
      activeAlert: primaryAlert,
      upcomingHazards: candidates,
      alertCount: candidates.length,
    };
  }
}
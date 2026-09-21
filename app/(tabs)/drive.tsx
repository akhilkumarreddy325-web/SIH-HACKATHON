import { useEffect, useState } from 'react';
import {
  Activity,
  CarFront,
  Check,
  Compass,
  MapPin,
  Navigation,
  Pause,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Volume2,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertOverlay } from '@/components/AlertOverlay';
import { CautionBanner } from '@/components/CautionBanner';
import { LiveSafetyAlertBanner } from '@/components/LiveSafetyAlertBanner';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useHazardSimulation, AlertPhase } from '@/hooks/useHazardSimulation';
import { useRealDrivingCaution } from '@/hooks/useRealDrivingCaution';
import { useSettingsState } from '@/lib/settings-provider';
import { colors, shadow } from '@/lib/theme';

export default function Drive() {
  const { voiceGuidance, hazardAlerts } = useSettingsState();
  const [drivingActive, setDrivingActive] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);

  // 1. Real GPS Driving Caution System
  const {
    userLocation,
    activeAlert: realAlert,
    upcomingHazards,
    isTracking,
    startTracking,
    stopTracking,
    dismissActiveAlert,
  } = useRealDrivingCaution({ autoStart: false });

  // 2. Demo Simulation Mode (for indoor testing)
  const {
    phase: simPhase,
    distanceMeters: simDist,
    isRunning: simRunning,
    start: startSim,
    stop: stopSim,
  } = useHazardSimulation(voiceGuidance);

  // Synchronize Driving State
  const handleToggleDrive = () => {
    if (drivingActive) {
      setDrivingActive(false);
      stopTracking();
      if (simulationMode) stopSim();
      setShowCriticalAlert(false);
    } else {
      setDrivingActive(true);
      if (simulationMode) {
        startSim();
      } else {
        startTracking();
      }
    }
  };

  // Watch for critical real alert
  useEffect(() => {
    if (realAlert?.riskLevel === 'CRITICAL' && realAlert.distanceMeters <= 150) {
      setShowCriticalAlert(true);
    }
  }, [realAlert]);

  // Watch for critical sim alert
  useEffect(() => {
    if (simulationMode && simPhase === 'critical') {
      setShowCriticalAlert(true);
    }
  }, [simulationMode, simPhase]);

  const showSimCaution =
    simulationMode &&
    (simPhase === 'caution_500' || simPhase === 'caution_250' || simPhase === 'warning_100');

  return (
    <Screen>
      <SectionHeader eyebrow="BACKGROUND SAFETY" title="Drive mode" />

      {/* Main Hero Card */}
      <View style={[styles.hero, drivingActive && styles.heroActive]}>
        <View style={styles.pulse}>
          <CarFront size={32} color={drivingActive ? '#fff' : colors.teal} />
        </View>
        <Text style={styles.heroTitle}>
          {drivingActive ? 'You are protected' : 'Ready when you are'}
        </Text>
        <Text style={styles.heroBody}>
          {drivingActive
            ? simulationMode
              ? 'Simulation running: Testing warning triggers for upcoming hazard.'
              : 'NearMiss is actively tracking your GPS position and road corridor ahead.'
            : 'Start monitoring automatically to receive live voice and vibration safety warnings.'}
        </Text>

        <Pressable
          onPress={handleToggleDrive}
          style={[styles.button, drivingActive && styles.stopButton]}
        >
          {drivingActive ? <Pause size={17} color={colors.ink} /> : <Radio size={17} color="#fff" />}
          <Text style={[styles.buttonText, drivingActive && { color: colors.ink }]}>
            {drivingActive ? 'Pause monitoring' : 'Start driving mode'}
          </Text>
        </Pressable>

        {/* Mode Selector Pill */}
        <View style={styles.modeSwitchRow}>
          <Pressable
            onPress={() => {
              if (drivingActive) {
                stopSim();
                startTracking();
              }
              setSimulationMode(false);
            }}
            style={[styles.modePill, !simulationMode && styles.modePillActive]}
          >
            <MapPin size={11} color={!simulationMode ? '#fff' : colors.muted} />
            <Text style={[styles.modePillText, !simulationMode && styles.modePillTextActive]}>
              Real GPS Monitoring
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (drivingActive) {
                stopTracking();
                startSim();
              }
              setSimulationMode(true);
            }}
            style={[styles.modePill, simulationMode && styles.modePillActive]}
          >
            <Compass size={11} color={simulationMode ? '#fff' : colors.muted} />
            <Text style={[styles.modePillText, simulationMode && styles.modePillTextActive]}>
              Indoor Test Demo
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Real Live Safety Alert Banner */}
      {!simulationMode && realAlert && (
        <View style={{ marginTop: 14 }}>
          <LiveSafetyAlertBanner alert={realAlert} onDismiss={dismissActiveAlert} />
        </View>
      )}

      {/* Simulated Hazard Banner */}
      {showSimCaution && simDist !== null && (
        <View style={{ marginTop: 14 }}>
          <CautionBanner distanceMeters={simDist} escalated={simPhase === 'warning_100'} />
        </View>
      )}

      {/* Live System Diagnostics */}
      <Text style={styles.sectionLabel}>LIVE SAFETY SYSTEMS</Text>
      <StatusRow
        icon={<Activity size={19} color={drivingActive ? colors.green : colors.muted} />}
        title="Vehicle motion detection"
        detail={
          drivingActive
            ? userLocation?.speed && userLocation.speed > 1.5
              ? `Moving at ~${Math.round(userLocation.speed * 3.6)} km/h`
              : 'Active motion detection'
            : 'Waiting for departure'
        }
        on={drivingActive}
      />
      <StatusRow
        icon={<MapPin size={19} color={isTracking ? colors.teal : colors.muted} />}
        title="High-accuracy GPS"
        detail={
          isTracking && userLocation
            ? `Active (${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}) &bull; \u00b1${Math.round(userLocation.accuracy || 10)}m`
            : isTracking
            ? 'Acquiring GPS fix...'
            : 'Permission enabled'
        }
        on={isTracking}
      />
      <StatusRow
        icon={<Volume2 size={19} color={voiceGuidance ? colors.yellow : colors.muted} />}
        title="Voice alerts & buzzer"
        detail={voiceGuidance ? 'Hands-free voice & haptics enabled' : 'Voice guidance muted'}
        on={voiceGuidance}
      />
      <StatusRow
        icon={<ShieldCheck size={19} color={drivingActive ? colors.teal : colors.muted} />}
        title="Corridor hazard scanning"
        detail={
          drivingActive
            ? simulationMode
              ? `Simulation step: ${simPhase.replace('_', ' ')}`
              : realAlert
              ? `Hazard ahead: ${realAlert.title} (${realAlert.distanceMeters}m)`
              : upcomingHazards.length > 0
              ? `${upcomingHazards.length} hazards monitored on route`
              : 'Road corridor clear'
            : 'Ready to monitor'
        }
        on={drivingActive}
      />

      <View style={styles.note}>
        <ShieldCheck size={18} color={colors.teal} />
        <Text style={styles.noteText}>
          NearMiss uses road geometry to calculate hazard proximity ahead. Alerts only notify you when your route approaches a danger sector.
        </Text>
      </View>

      <AlertOverlay visible={showCriticalAlert} onDismiss={() => setShowCriticalAlert(false)} />
    </Screen>
  );
}

function StatusRow({
  icon,
  title,
  detail,
  on,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  on?: boolean;
}) {
  return (
    <View style={[styles.row, shadow]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {on && (
        <View style={styles.check}>
          <Check size={13} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    ...shadow,
  },
  heroActive: {
    backgroundColor: colors.teal,
  },
  pulse: {
    height: 68,
    width: 68,
    borderRadius: 34,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  heroBody: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 300,
    fontSize: 13,
  },
  button: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.ink,
    paddingHorizontal: 22,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  stopButton: {
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    padding: 4,
    borderRadius: 12,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modePillActive: {
    backgroundColor: colors.ink,
  },
  modePillText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  modePillTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '900',
    marginTop: 24,
    marginBottom: 10,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    height: 39,
    width: 39,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  rowDetail: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  check: {
    width: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 15,
    backgroundColor: colors.tealSoft,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  noteText: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
    flex: 1,
  },
});
import { useEffect, useState } from 'react';
import { Activity, CarFront, Check, MapPin, Pause, Radio, ShieldCheck, Volume2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertOverlay } from '@/components/AlertOverlay';
import { CautionBanner } from '@/components/CautionBanner';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useHazardSimulation, AlertPhase } from '@/hooks/useHazardSimulation';
import { useSettingsState } from '@/lib/settings-provider';
import { colors, shadow } from '@/lib/theme';

export default function Drive() {
  const { voiceGuidance } = useSettingsState();
  const { phase, distanceMeters, isRunning, start, stop } = useHazardSimulation(voiceGuidance);
  const [showRedAlert, setShowRedAlert] = useState(false);
  const [hasDismissedCritical, setHasDismissedCritical] = useState(false);

  useEffect(() => {
    if (phase === 'critical') {
      if (!hasDismissedCritical) {
        setShowRedAlert(true);
      }
    } else {
      setShowRedAlert(false);
      setHasDismissedCritical(false);
    }
  }, [phase, hasDismissedCritical]);

  const handleToggle = () => {
    if (isRunning) {
      stop();
      setShowRedAlert(false);
      setHasDismissedCritical(false);
    } else {
      setHasDismissedCritical(false);
      start();
    }
  };

  const handleDismissAlert = () => {
    setShowRedAlert(false);
    setHasDismissedCritical(true);
  };

  const showCaution = phase === 'caution_500' || phase === 'caution_250' || phase === 'warning_100';
  const escalated = phase === 'warning_100';

  const phaseLabel: Record<AlertPhase, string> = {
    idle: 'Waiting for movement',
    monitoring: 'Safety monitoring active',
    caution_500: 'CAUTION · 500 m ahead',
    caution_250: 'CAUTION · 250 m ahead',
    warning_100: 'WARNING · 100 m ahead',
    critical: 'HIGH RISK · hazard zone reached',
  };

  return (
    <Screen>
      <SectionHeader eyebrow="BACKGROUND SAFETY" title="Drive mode" />

      <View style={[styles.hero, isRunning && styles.heroActive]}>
        <View style={styles.pulse}>
          <CarFront size={32} color={isRunning ? '#fff' : colors.teal} />
        </View>
        <Text style={styles.heroTitle}>{isRunning ? 'You are protected' : 'Ready when you are'}</Text>
        <Text style={styles.heroBody}>
          {isRunning
            ? 'NearMiss is quietly monitoring your drive for hazards ahead.'
            : 'Start monitoring automatically when motion sensors detect a vehicle.'}
        </Text>
        <Pressable onPress={handleToggle} style={[styles.button, isRunning && styles.stopButton]}>
          {isRunning ? <Pause size={17} color={colors.ink} /> : <Radio size={17} color="#fff" />}
          <Text style={[styles.buttonText, isRunning && { color: colors.ink }]}>
            {isRunning ? 'Pause monitoring' : 'Start driving mode'}
          </Text>
        </Pressable>
        {isRunning && (
          <View style={styles.simBadge}>
            <Text style={styles.simBadgeText}>SIMULATED HAZARD APPROACH</Text>
          </View>
        )}
      </View>

      {showCaution && distanceMeters !== null && (
        <CautionBanner distanceMeters={distanceMeters} escalated={escalated} />
      )}

      <Text style={styles.sectionLabel}>LIVE SYSTEMS</Text>
      <StatusRow
        icon={<Activity size={19} color={isRunning ? colors.green : colors.muted} />}
        title="Vehicle motion detection"
        detail={isRunning ? 'IN_VEHICLE detected' : 'Waiting for movement'}
        on={isRunning}
      />
      <StatusRow
        icon={<MapPin size={19} color={isRunning ? colors.teal : colors.muted} />}
        title="Background location"
        detail={isRunning ? 'Updating every 10 seconds' : 'Permission enabled'}
        on={isRunning}
      />
      <StatusRow
        icon={<Volume2 size={19} color={voiceGuidance ? colors.yellow : colors.muted} />}
        title="Voice alerts"
        detail={voiceGuidance ? 'High-risk alerts enabled' : 'Voice guidance off'}
        on={voiceGuidance}
      />
      <StatusRow
        icon={<ShieldCheck size={19} color={isRunning ? colors.teal : colors.muted} />}
        title="Hazard proximity"
        detail={phaseLabel[phase]}
        on={isRunning}
      />

      <View style={styles.note}>
        <ShieldCheck size={18} color={colors.teal} />
        <Text style={styles.noteText}>
          NearMiss uses low-power monitoring. Alerts only interrupt you when the risk level calls for it.
        </Text>
      </View>

      <AlertOverlay visible={showRedAlert} onDismiss={handleDismissAlert} />
    </Screen>
  );
}

function StatusRow({ icon, title, detail, on }: { icon: React.ReactNode; title: string; detail: string; on?: boolean }) {
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
  hero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 28, padding: 28, ...shadow },
  heroActive: { backgroundColor: colors.teal },
  pulse: { height: 74, width: 74, borderRadius: 37, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  heroTitle: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  heroBody: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 9, maxWidth: 280 },
  button: { height: 49, borderRadius: 14, backgroundColor: colors.ink, paddingHorizontal: 20, flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 22 },
  stopButton: { backgroundColor: '#fff' },
  buttonText: { color: '#fff', fontWeight: '800' },
  simBadge: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  simBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1.4, fontWeight: '900', marginTop: 28, marginBottom: 10 },
  row: { backgroundColor: colors.surface, borderRadius: 16, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { height: 39, width: 39, backgroundColor: colors.canvas, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  rowDetail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  check: { width: 23, height: 23, borderRadius: 8, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 10, padding: 15, backgroundColor: colors.tealSoft, borderRadius: 16, marginTop: 18 },
  noteText: { color: colors.muted, lineHeight: 18, fontSize: 12, flex: 1 },
});

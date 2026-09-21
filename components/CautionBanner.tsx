import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '@/lib/theme';

export function CautionBanner({ distanceMeters, escalated }: { distanceMeters: number; escalated: boolean }) {
  const bgColor = escalated ? colors.redSoft : colors.yellowSoft;
  const iconColor = escalated ? colors.red : colors.yellow;
  const textColor = escalated ? colors.red : colors.yellow;
  const label = escalated ? 'WARNING — HAZARD ZONE IMMINENT' : 'CAUTION — HAZARD ZONE AHEAD';

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }, shadow]}>
      <AlertTriangle size={20} color={iconColor} strokeWidth={2.5} />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        <Text style={styles.distance}>{distanceMeters} m ahead</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  copy: { flex: 1 },
  label: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  distance: { color: colors.muted, fontSize: 12, marginTop: 3, fontWeight: '600' },
});

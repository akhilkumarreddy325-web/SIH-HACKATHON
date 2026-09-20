import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '@/lib/theme';
import { ActiveSafetyAlert } from '@/types/navigation';

interface LiveSafetyAlertBannerProps {
  alert: ActiveSafetyAlert | null;
  onDismiss?: () => void;
}

export function LiveSafetyAlertBanner({ alert, onDismiss }: LiveSafetyAlertBannerProps) {
  if (!alert) return null;

  const isCritical = alert.riskLevel === 'CRITICAL';
  const isHigh = alert.riskLevel === 'HIGH';

  const themeColors = isCritical
    ? { bg: '#FEF2F2', border: '#FCA5A5', iconBg: colors.redSoft, text: '#991B1B', badgeBg: '#DC2626' }
    : isHigh
    ? { bg: '#FFFBEB', border: '#FDE68A', iconBg: colors.yellowSoft, text: '#92400E', badgeBg: '#D97706' }
    : { bg: '#F0FDF4', border: '#BBF7D0', iconBg: colors.greenSoft, text: '#166534', badgeBg: colors.teal };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg, borderColor: themeColors.border }, shadow]}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: themeColors.iconBg }]}>
          {isCritical ? (
            <ShieldAlert size={18} color={colors.red} />
          ) : (
            <AlertTriangle size={18} color={isHigh ? '#D97706' : colors.teal} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <Text style={styles.kicker}>⚠️ SAFETY ALERT</Text>
            <View style={[styles.riskBadge, { backgroundColor: themeColors.badgeBg }]}>
              <Text style={styles.riskText}>{alert.riskLevel} RISK</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {alert.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {alert.subtitle}
          </Text>
        </View>

        {onDismiss && (
          <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
            <X size={15} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.distanceLabel}>DISTANCE AHEAD:</Text>
        <Text style={[styles.distanceValue, { color: themeColors.text }]}>
          {alert.distanceMeters > 1000
            ? `${(alert.distanceMeters / 1000).toFixed(1)} km ahead`
            : `${alert.distanceMeters} m ahead`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.muted,
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8,
    marginTop: 8,
  },
  distanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.8,
  },
  distanceValue: {
    fontSize: 12,
    fontWeight: '900',
  },
});
import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  CloudRain,
  MapPin,
  Navigation,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, shadow } from '@/lib/theme';
import { RiskZone } from '@/types/risk-zone';

interface RiskZoneDetailModalProps {
  zone: RiskZone | null;
  visible: boolean;
  onClose: () => void;
  userDistanceMeters?: number | null;
}

export function RiskZoneDetailModal({
  zone,
  visible,
  onClose,
  userDistanceMeters,
}: RiskZoneDetailModalProps) {
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!zone) return null;

  const getRiskColor = (level: string) => {
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

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return '#FEE2E2';
      case 'HIGH':
        return colors.redSoft;
      case 'MODERATE':
        return colors.yellowSoft;
      case 'LOW':
      default:
        return colors.greenSoft;
    }
  };

  const formatDistance = (meters?: number | null): string => {
    if (meters === undefined || meters === null) return 'Distance unavailable';
    if (meters < 1000) return `${Math.round(meters)} m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${period}`;
  };

  const currentHour = new Date().getHours();
  const isPeakHour =
    zone.high_risk_start_hour <= zone.high_risk_end_hour
      ? currentHour >= zone.high_risk_start_hour && currentHour <= zone.high_risk_end_hour
      : currentHour >= zone.high_risk_start_hour || currentHour <= zone.high_risk_end_hour;

  const riskColor = getRiskColor(zone.risk_level);
  const riskBg = getRiskBg(zone.risk_level);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: riskBg }]}>
                <ShieldAlert size={24} color={riskColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>RISK ZONE INTELLIGENCE</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {zone.name}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>

          {/* Action Notice Banner */}
          {actionNotice && (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{actionNotice}</Text>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Risk Tier Badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: riskBg }]}>
                <View style={[styles.dot, { backgroundColor: riskColor }]} />
                <Text style={[styles.badgeText, { color: riskColor }]}>
                  {zone.risk_level} RISK • {zone.numeric_score}/100
                </Text>
              </View>

              {zone.is_demo_zone && (
                <View style={[styles.badge, styles.demoBadge]}>
                  <Text style={styles.demoBadgeText}>DEMO DATA</Text>
                </View>
              )}
            </View>

            {/* Distance Callout */}
            <View style={styles.distanceBanner}>
              <Navigation size={15} color={colors.teal} />
              <Text style={styles.distanceText}>
                {formatDistance(userDistanceMeters)}
              </Text>
            </View>

            {/* Description / Explanation */}
            {zone.description && (
              <Text style={styles.description}>{zone.description}</Text>
            )}

            {/* Safety Signals Grid */}
            <Text style={styles.sectionTitle}>SAFETY SIGNAL AGGREGATION</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <AlertTriangle size={18} color={colors.red} />
                <Text style={styles.statNumber}>{zone.incident_count}</Text>
                <Text style={styles.statLabel}>Collisions</Text>
              </View>

              <View style={styles.statBox}>
                <Activity size={18} color="#E65100" />
                <Text style={styles.statNumber}>{zone.near_miss_count}</Text>
                <Text style={styles.statLabel}>Near-Misses</Text>
              </View>

              <View style={styles.statBox}>
                <Shield size={18} color={colors.teal} />
                <Text style={styles.statNumber}>{zone.community_report_count}</Text>
                <Text style={styles.statLabel}>Crowd Reports</Text>
              </View>
            </View>

            {/* Common Hazard */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <AlertTriangle size={16} color={colors.ink} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>PRIMARY HAZARD</Text>
                <Text style={styles.infoValue}>{zone.common_hazard}</Text>
              </View>
            </View>

            {/* Peak Risk Window */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Clock size={16} color={isPeakHour ? colors.red : colors.ink} />
              </View>
              <View style={styles.infoCopy}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.infoLabel}>HIGH-RISK HOURS</Text>
                  {isPeakHour && (
                    <View style={styles.livePill}>
                      <Text style={styles.livePillText}>ACTIVE NOW</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.infoValue}>
                  {formatHour(zone.high_risk_start_hour)} -{' '}
                  {formatHour(zone.high_risk_end_hour)}
                </Text>
              </View>
            </View>

            {/* Weather Vulnerability */}
            {zone.weather_patterns && zone.weather_patterns.length > 0 && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <CloudRain size={16} color={colors.teal} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>WEATHER VULNERABILITY (PATTERN)</Text>
                  <Text style={styles.infoValue}>
                    {zone.weather_patterns[0].advisory}
                  </Text>
                </View>
              </View>
            )}

            {/* Geo details */}
            <View style={styles.geoBox}>
              <MapPin size={14} color={colors.muted} />
              <Text style={styles.geoText}>
                Center: {zone.latitude.toFixed(4)}°N, {zone.longitude.toFixed(4)}°E • Radius: {zone.radius_meters}m
              </Text>
            </View>

            {/* Interactive Actions (Placeholders) */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  setActionNotice(`Safe routing active: Avoiding ${zone.name} corridor`);
                  setTimeout(() => setActionNotice(null), 3500);
                }}
                style={[styles.subActionBtn, { backgroundColor: colors.redSoft, borderColor: colors.red }]}
              >
                <ShieldAlert size={15} color={colors.red} />
                <Text style={[styles.subActionText, { color: colors.red }]}>Avoid this zone</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setActionNotice(`Cautious guidance configured for ${zone.name}`);
                  setTimeout(() => setActionNotice(null), 3500);
                }}
                style={[styles.subActionBtn, { backgroundColor: colors.tealSoft, borderColor: colors.teal }]}
              >
                <Navigation size={15} color={colors.teal} />
                <Text style={[styles.subActionText, { color: colors.teal }]}>Navigate safely</Text>
              </Pressable>
            </View>
          </ScrollView>

          <Pressable onPress={onClose} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 28, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.canvas,
  },
  noticeBanner: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  noticeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    marginVertical: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  demoBadge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  demoBadgeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  distanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 12,
  },
  distanceText: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 13,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  statNumber: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 18,
  },
  livePill: {
    backgroundColor: colors.redSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  livePillText: {
    color: colors.red,
    fontSize: 9,
    fontWeight: '900',
  },
  geoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  geoText: {
    color: colors.muted,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  subActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  subActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtn: {
    backgroundColor: colors.ink,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MapPin,
  Shield,
  User as UserIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ReportDetailModal } from '@/components/ReportDetailModal';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { HazardReport } from '@/types/safepath';

function formatSubmittedDate(dateStr?: string): string {
  if (!dateStr) return 'Today';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function formatLocation(report: HazardReport): string {
  if (report.trips?.destination) return report.trips.destination;
  if (report.trips?.start_point) return report.trips.start_point;
  if (report.latitude && report.longitude) {
    return `Hyderabad (${Number(report.latitude).toFixed(2)}, ${Number(report.longitude).toFixed(2)})`;
  }
  return 'Hyderabad Corridor';
}

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');

  const fetchReports = useCallback(() => {
    let isActive = true;

    supabase
      .from('hazard_reports')
      .select(
        'id,hazard_type,severity,description,status,latitude,longitude,zone_type,created_at,trip_id,audio_path,trips(destination,start_point)'
      )
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!isActive) return;
        if (error) {
          setLoadError('Could not load reports. Please try again later.');
          return;
        }
        setLoadError(null);
        setReports((data as unknown as HazardReport[]) ?? []);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useFocusEffect(fetchReports);

  const displayedReports = reports;

  return (
    <Screen>
      <SectionHeader eyebrow="COMMUNITY SIGNAL" title="Road reports" action="How it works" />

      {/* Summary Card */}
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <FileText size={22} color={colors.teal} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>Your reports make roads smarter</Text>
          <Text style={styles.summaryBody}>
            Every verified signal improves safety for the next traveler.
          </Text>
        </View>
      </View>

      {/* Community Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>RECENT COMMUNITY ACTIVITY</Text>
      </View>

      {loadError ? (
        <View style={styles.empty}>
          <AlertTriangle size={25} color={colors.red} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyBody}>{loadError}</Text>
        </View>
      ) : displayedReports.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle2 size={25} color={colors.green} />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyBody}>
            Complete a trip and share what you saw on the road.
          </Text>
        </View>
      ) : (
        displayedReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onView={() => setSelectedReport(report)}
          />
        ))
      )}

      {/* Signal Quality */}
      <Text style={styles.sectionLabel}>SIGNAL QUALITY</Text>
      <View style={styles.quality}>
        <View style={styles.qualityTop}>
          <Text style={styles.qualityTitle}>Your contribution score</Text>
          <Text style={styles.score}>94</Text>
        </View>
        <Text style={styles.qualityBody}>
          Submit verified road hazard reports to keep building trust across NearMiss.
        </Text>
        <View style={styles.progress}>
          <View style={styles.progressFill} />
        </View>
      </View>

      {/* Report Detail Modal */}
      <ReportDetailModal
        report={selectedReport}
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </Screen>
  );
}

function ReportCard({
  report,
  onView,
}: {
  report: HazardReport;
  onView: () => void;
}) {
  const isRed = report.severity === 'red' || report.severity === 'critical';
  const hazardName = (report.hazard_type || 'Road hazard').replace(/_/g, ' ');

  return (
    <View style={[styles.reportCard, shadow]}>
      <View style={styles.reportMain}>
        <View
          style={[
            styles.reportIcon,
            { backgroundColor: isRed ? colors.redSoft : colors.yellowSoft },
          ]}
        >
          <AlertTriangle size={18} color={isRed ? colors.red : colors.yellow} />
        </View>

        <View style={styles.reportCopy}>
          <Text style={styles.reportTitle} numberOfLines={1}>
            {hazardName}
          </Text>
          <View style={styles.locationRow}>
            <MapPin size={11} color={colors.muted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {formatLocation(report)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Clock3 size={11} color={colors.muted} />
            <Text style={styles.metaText}>
              Submitted: {formatSubmittedDate(report.created_at)}
            </Text>
          </View>
        </View>

        {/* Clear [View] Action Button */}
        <Pressable onPress={onView} style={styles.viewBtn}>
          <Eye size={13} color={colors.teal} />
          <Text style={styles.viewBtnText}>View</Text>
        </Pressable>
      </View>

      {report.description && (
        <Text style={styles.snippetText} numberOfLines={2}>
          &ldquo;{report.description}&rdquo;
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 24,
  },
  summaryIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#DDF1EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  summaryBody: { color: '#B7C9C4', fontSize: 12, lineHeight: 17, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '900',
    marginBottom: 11,
    marginTop: 8,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },
  reportMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCopy: {
    flex: 1,
  },
  reportTitle: {
    color: colors.ink,
    fontWeight: '800',
    textTransform: 'capitalize',
    fontSize: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  viewBtnText: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 12,
  },
  snippetText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 10,
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 5,
  },
  quality: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 17,
    marginBottom: 20,
    ...shadow,
  },
  qualityTop: { flexDirection: 'row', justifyContent: 'space-between' },
  qualityTitle: { color: colors.ink, fontWeight: '800' },
  score: { color: colors.teal, fontWeight: '900', fontSize: 21 },
  qualityBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  progress: {
    height: 8,
    backgroundColor: colors.canvas,
    borderRadius: 4,
    marginTop: 15,
  },
  progressFill: {
    width: '94%',
    height: 8,
    backgroundColor: colors.teal,
    borderRadius: 4,
  },
});
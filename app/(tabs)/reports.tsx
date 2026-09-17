import { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, FileText } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ReportDetailModal } from '@/components/ReportDetailModal';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { HazardReport } from '@/types/safepath';

export default function Reports() {
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      supabase
        .from('hazard_reports')
        .select(
          'id,hazard_type,severity,description,status,latitude,longitude,zone_type,created_at,trip_id,audio_path,trips(destination,start_point)'
        )
        .order('created_at', { ascending: false })
        .limit(10)
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
    }, [])
  );

  return (
    <Screen>
      <SectionHeader eyebrow="COMMUNITY SIGNAL" title="Road reports" action="How it works" />

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

      <Text style={styles.sectionLabel}>RECENT COMMUNITY ACTIVITY</Text>

      {loadError ? (
        <View style={styles.empty}>
          <AlertTriangle size={25} color={colors.red} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyBody}>{loadError}</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle2 size={25} color={colors.green} />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyBody}>
            Complete a trip and share what you saw on the road.
          </Text>
        </View>
      ) : (
        reports.map((report) => (
          <ReportRow
            key={report.id}
            report={report}
            onPress={() => setSelectedReport(report)}
          />
        ))
      )}

      <Text style={styles.sectionLabel}>SIGNAL QUALITY</Text>

      <View style={styles.quality}>
        <View style={styles.qualityTop}>
          <Text style={styles.qualityTitle}>Your contribution score</Text>
          <Text style={styles.score}>—</Text>
        </View>
        <Text style={styles.qualityBody}>
          Submit your first road report to start building trust in the network.
        </Text>
        <View style={styles.progress}>
          <View style={styles.progressFill} />
        </View>
      </View>

      <ReportDetailModal
        report={selectedReport}
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </Screen>
  );
}

function ReportRow({
  report,
  onPress,
}: {
  report: HazardReport;
  onPress: () => void;
}) {
  const isRed = report.severity === 'red';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.report,
        shadow,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={[
          styles.reportIcon,
          { backgroundColor: isRed ? colors.redSoft : colors.yellowSoft },
        ]}
      >
        <AlertTriangle size={18} color={isRed ? colors.red : colors.yellow} />
      </View>
      <View style={styles.reportCopy}>
        <Text style={styles.reportTitle}>
          {(report.hazard_type || 'Hazard').replace(/_/g, ' ')} reported
        </Text>
        <View style={styles.meta}>
          <Clock3 size={12} color={colors.muted} />
          <Text style={styles.metaText}>Recently · </Text>
          <Text
            style={[
              styles.status,
              {
                color:
                  report.status === 'verified' ? colors.green : colors.yellow,
              },
            ]}
          >
            {report.status}
          </Text>
        </View>
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </Pressable>
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
    marginBottom: 28,
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
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '900',
    marginBottom: 11,
  },
  report: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCopy: { flex: 1 },
  reportTitle: {
    color: colors.ink,
    fontWeight: '800',
    textTransform: 'capitalize',
    fontSize: 14,
  },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  metaText: { color: colors.muted, fontSize: 11, marginLeft: 4 },
  status: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
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
    width: '4%',
    height: 8,
    backgroundColor: colors.teal,
    borderRadius: 4,
  },
});

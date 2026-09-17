import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Mic,
  Navigation,
  Pause,
  Play,
  Volume2,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { HazardReport } from '@/types/safepath';

export function ReportDetailModal({
  report,
  visible,
  onClose,
}: {
  report: HazardReport | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!report) return null;

  const isRed = report.severity === 'red';
  const formattedHazard = (report.hazard_type || 'Hazard').replace(/_/g, ' ');

  const formattedDate = (() => {
    try {
      const d = new Date(report.created_at);
      if (isNaN(d.getTime())) return report.created_at;
      return (
        d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        ' at ' +
        d.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    } catch {
      return report.created_at;
    }
  })();

  const hasCoords =
    report.latitude !== null &&
    report.latitude !== undefined &&
    report.longitude !== null &&
    report.longitude !== undefined;

  const tripDestination = report.trips?.destination;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isRed ? colors.redSoft : colors.yellowSoft },
                ]}
              >
                <AlertTriangle
                  size={20}
                  color={isRed ? colors.red : colors.yellow}
                />
              </View>
              <View>
                <Text style={styles.eyebrow}>ROAD SIGNAL DETAILS</Text>
                <Text style={styles.title}>{formattedHazard}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Badges */}
            <View style={styles.badgesRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isRed ? colors.redSoft : colors.yellowSoft },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isRed ? colors.red : colors.yellow },
                  ]}
                >
                  {String(report.severity).toUpperCase()} SEVERITY
                </Text>
              </View>

              <View style={[styles.badge, styles.statusBadge]}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        report.status === 'verified' ? colors.green : colors.yellow,
                    },
                  ]}
                />
                <Text style={styles.statusBadgeText}>
                  {report.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Voice Report Section (only shown if audio_path exists) */}
            {report.audio_path && (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Volume2 size={15} color={colors.teal} />
                  <Text style={styles.sectionTitle}>VOICE REPORT</Text>
                </View>
                <VoiceReportPlayer audioPath={report.audio_path} />
              </View>
            )}

            {/* Description Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <FileText size={15} color={colors.teal} />
                <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              </View>
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>
                  {report.description?.trim()
                    ? report.description.trim()
                    : 'No additional details provided by reporter.'}
                </Text>
              </View>
            </View>

            {/* Details Group */}
            <View style={styles.detailsGroup}>
              <DetailRow
                icon={<Clock size={16} color={colors.teal} />}
                label="Reported on"
                value={formattedDate}
              />

              <DetailRow
                icon={<Navigation size={16} color={colors.teal} />}
                label="Associated route"
                value={
                  tripDestination
                    ? `Trip to ${tripDestination}`
                    : 'Not linked to a recorded trip'
                }
              />

              <DetailRow
                icon={<MapPin size={16} color={colors.teal} />}
                label="Location coordinates"
                value={
                  hasCoords
                    ? `${Number(report.latitude).toFixed(5)}, ${Number(
                        report.longitude
                      ).toFixed(5)}`
                    : 'Location not available'
                }
                isMuted={!hasCoords}
              />
            </View>
          </ScrollView>

          <Pressable onPress={onClose} style={styles.closeActionButton}>
            <Text style={styles.closeActionButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function VoiceReportPlayer({ audioPath }: { audioPath: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAudio() {
      setLoading(true);
      setError(null);
      try {
        // NOTE (SIH Prototype Security Architecture):
        // The 'hazard-report-audio' bucket is private (public = false). Time-limited signed URLs
        // (1 hour expiry) are used for playback instead of exposing public CDN URLs.
        // Because user authentication/ownership has not yet been implemented in this prototype,
        // community voice recordings are accessible to any client that possesses the report's audio_path.
        const { data, error: storageError } = await supabase.storage
          .from('hazard-report-audio')
          .createSignedUrl(audioPath, 3600);

        if (!active) return;

        if (storageError || !data?.signedUrl) {
          setError(
            storageError?.message || 'Could not generate playback link.'
          );
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Error loading audio.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAudio();
    return () => {
      active = false;
    };
  }, [audioPath]);

  if (loading) {
    return (
      <View style={styles.voiceBox}>
        <ActivityIndicator size="small" color={colors.teal} />
        <Text style={styles.voiceLoadingText}>Loading voice memo...</Text>
      </View>
    );
  }

  if (error || !signedUrl) {
    return (
      <View style={[styles.voiceBox, styles.voiceErrorBox]}>
        <AlertCircle size={16} color={colors.red} />
        <Text style={styles.voiceErrorText}>
          {error || 'Audio file unavailable'}
        </Text>
      </View>
    );
  }

  return <AudioTrackPlayer url={signedUrl} />;
}

function AudioTrackPlayer({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.duration && status.currentTime >= status.duration) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const formatSec = (s: number) => {
    const total = Math.floor(s || 0);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <View style={styles.voicePlayerCard}>
      <Pressable onPress={togglePlayback} style={styles.voicePlayBtn}>
        {status.playing ? (
          <Pause size={17} color="#fff" />
        ) : (
          <Play size={17} color="#fff" />
        )}
      </Pressable>
      <View style={styles.voicePlayerInfo}>
        <Text style={styles.voicePlayerTitle}>Voice memo</Text>
        <Text style={styles.voicePlayerDuration}>
          {formatSec(status.currentTime)} / {formatSec(status.duration || 0)}
        </Text>
      </View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isMuted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isMuted?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, isMuted && styles.detailValueMuted]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,32,28,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.canvas,
  },
  scroll: {
    marginVertical: 4,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: colors.canvas,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '900',
  },
  descriptionBox: {
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  descriptionText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  voiceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  voiceLoadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  voiceErrorBox: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
  },
  voiceErrorText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '600',
  },
  voicePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  voicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayerInfo: {
    flex: 1,
  },
  voicePlayerTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  voicePlayerDuration: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  detailsGroup: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  detailValueMuted: {
    color: colors.muted,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  closeActionButton: {
    backgroundColor: colors.ink,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  closeActionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});

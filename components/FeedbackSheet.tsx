import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Mic,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Star,
  Trash2,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { colors } from '@/lib/theme';

export const REPORT_CATEGORIES = [
  { id: 'accident', label: 'Accident' },
  { id: 'road_damage', label: 'Road Damage' },
  { id: 'flooding', label: 'Flooding' },
  { id: 'unsafe_area', label: 'Unsafe Area' },
  { id: 'traffic_hazard', label: 'Traffic Hazard' },
  { id: 'debris', label: 'Debris' },
  { id: 'construction', label: 'Construction' },
  { id: 'streetlight_problem', label: 'Streetlight Problem' },
  { id: 'other', label: 'Other Safety Issue' },
] as const;

export function validateHazardReportText(text: string): { isValid: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 5) {
    return {
      isValid: false,
      error: 'Please provide a clear description of the safety issue.',
    };
  }

  const normalized = trimmed.toLowerCase();
  const blockedSpam = new Set([
    'hi', 'hello', 'hey', 'test', 'testing', 'abc', 'xyz', 'nothing',
    'danger', 'asdf', 'none', 'ok', 'okay', '123', 'cool', 'good', 'bad'
  ]);

  if (blockedSpam.has(normalized)) {
    return {
      isValid: false,
      error: 'Please provide a clear description of the safety issue.',
    };
  }

  const distinctChars = new Set(normalized.replace(/[^a-z]/g, ''));
  if (distinctChars.size < 3) {
    return {
      isValid: false,
      error: 'Please provide a clear description of the safety issue.',
    };
  }

  return { isValid: true };
}

export function FeedbackSheet({
  onSubmit,
}: {
  onSubmit: (
    rating: number,
    hazard: boolean,
    note: string,
    audioUri?: string | null,
    hazardType?: string
  ) => void;
}) {
  const [rating, setRating] = useState(4);
  const [hazard, setHazard] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('road_damage');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [note, setNote] = useState('');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  // Track duration while recording
  useEffect(() => {
    if (recorderState.isRecording) {
      setRecordedDuration(Math.floor((recorderState.durationMillis || 0) / 1000));
    }
  }, [recorderState.isRecording, recorderState.durationMillis]);

  const handleStartRecording = async () => {
    try {
      setPermissionError(null);
      setValidationError(null);
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setPermissionError(
          'Microphone permission is required to record a voice report.'
        );
        return;
      }
      setRecordedUri(null);
      setRecordedDuration(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err: any) {
      setPermissionError(err?.message || 'Could not start recording.');
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stop();
      if (recorder.uri) {
        setRecordedUri(recorder.uri);
      }
    } catch (err: any) {
      setPermissionError(err?.message || 'Could not stop recording.');
    }
  };

  const handleDeleteRecording = () => {
    setRecordedUri(null);
    setRecordedDuration(0);
  };

  const handleSubmit = async () => {
    setValidationError(null);

    // Validate hazard report details
    if (hazard) {
      if (!termsAccepted) {
        setValidationError('Please accept the reporting guidelines before submitting.');
        return;
      }

      if (inputMode === 'voice' && !recordedUri) {
        setValidationError('Please record a voice note or switch to text description.');
        return;
      }

      if (inputMode === 'text') {
        const valRes = validateHazardReportText(note);
        if (!valRes.isValid) {
          setValidationError(valRes.error || 'Please provide a clear description of the safety issue.');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(
        rating,
        hazard,
        note,
        recordedUri,
        hazard ? selectedCategory : undefined
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.kicker}>ROUTE VERIFICATION</Text>
      <Text style={styles.title}>How did the road feel?</Text>
      <Text style={styles.subtitle}>
        Calm drives start with real road feedback from travelers like you.
      </Text>

      {/* Star Rating */}
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => setRating(s)} hitSlop={8}>
            <Star
              size={30}
              color={s <= rating ? colors.yellow : colors.line}
              fill={s <= rating ? colors.yellow : 'transparent'}
            />
          </Pressable>
        ))}
      </View>

      {/* Hazard Toggle Button */}
      <Pressable
        onPress={() => {
          setHazard(!hazard);
          setValidationError(null);
        }}
        style={[styles.report, hazard && styles.reportActive]}
      >
        <CircleAlert size={19} color={hazard ? colors.red : colors.muted} />
        <Text style={[styles.reportText, hazard && { color: colors.red }]}>
          Report an unexpected safety hazard
        </Text>
        <View style={[styles.check, hazard && styles.checkActive]}>
          {hazard && <Check size={14} color="#fff" />}
        </View>
      </Pressable>

      {/* Hazard Details Section */}
      {hazard && (
        <View style={styles.hazardInputSection}>
          {/* Predefined Categories */}
          <Text style={styles.categoryLabel}>SELECT HAZARD CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {REPORT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Mode Switcher: Text vs Voice */}
          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => {
                setInputMode('text');
                setValidationError(null);
              }}
              style={[styles.modeTab, inputMode === 'text' && styles.modeTabActive]}
            >
              <FileText size={14} color={inputMode === 'text' ? colors.ink : colors.muted} />
              <Text style={[styles.modeTabText, inputMode === 'text' && styles.modeTabTextActive]}>
                Text note
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setInputMode('voice');
                setValidationError(null);
              }}
              style={[styles.modeTab, inputMode === 'voice' && styles.modeTabActive]}
            >
              <Mic size={14} color={inputMode === 'voice' ? colors.teal : colors.muted} />
              <Text style={[styles.modeTabText, inputMode === 'voice' && styles.modeTabTextActive]}>
                Voice report {recordedUri ? '• 1 recorded' : ''}
              </Text>
            </Pressable>
          </View>

          {/* Validation Error Banner */}
          {validationError && (
            <View style={styles.errorBox}>
              <AlertCircle size={15} color={colors.red} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}

          {/* Text Input Mode */}
          {inputMode === 'text' ? (
            <TextInput
              style={styles.input}
              placeholder="e.g. Broken pavement and deep waterlogged pothole on the right lane near junction"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={(t) => {
                setNote(t);
                if (validationError) setValidationError(null);
              }}
              multiline
              numberOfLines={3}
            />
          ) : (
            /* Voice Recording Mode */
            <View style={styles.voiceContainer}>
              {permissionError && (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color={colors.red} />
                  <Text style={styles.errorText}>{permissionError}</Text>
                </View>
              )}

              {!recordedUri ? (
                recorderState.isRecording ? (
                  <View style={styles.recordingActiveCard}>
                    <View style={styles.recordingPulse}>
                      <View style={styles.redDot} />
                      <Text style={styles.recordingTimer}>
                        0:{recordedDuration < 10 ? `0${recordedDuration}` : recordedDuration}
                      </Text>
                    </View>
                    <Text style={styles.recordingHint}>Recording safety memo...</Text>
                    <Pressable onPress={handleStopRecording} style={styles.stopBtn}>
                      <Square size={16} color="#fff" fill="#fff" />
                      <Text style={styles.stopBtnText}>Stop recording</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.recordActionCard}>
                    <Pressable onPress={handleStartRecording} style={styles.recordStartBtn}>
                      <View style={styles.micCircle}>
                        <Mic size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recordStartTitle}>Tap to speak road hazard</Text>
                        <Text style={styles.recordStartSub}>
                          Describe lane, obstacles, or safety risks hands-free
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )
              ) : (
                <View style={styles.previewCard}>
                  <AudioPreviewPlayer
                    uri={recordedUri}
                    durationSec={recordedDuration}
                    onDelete={handleDeleteRecording}
                    onReRecord={handleStartRecording}
                  />
                  <TextInput
                    style={styles.optionalInput}
                    placeholder="Add brief note or landmark (optional)"
                    placeholderTextColor={colors.muted}
                    value={note}
                    onChangeText={setNote}
                  />
                </View>
              )}
            </View>
          )}

          {/* Reporting Terms and Guidelines Notice */}
          <Pressable
            onPress={() => setTermsAccepted(!termsAccepted)}
            style={styles.termsRow}
          >
            <View style={[styles.termsCheckbox, termsAccepted && styles.termsCheckboxActive]}>
              {termsAccepted && <Check size={12} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I confirm this is genuine safety information. False, misleading, or spam reports will be rejected.
            </Text>
          </Pressable>
        </View>
      )}

      {/* Submit Button */}
      <Pressable
        disabled={submitting || recorderState.isRecording}
        onPress={handleSubmit}
        style={[
          styles.button,
          (submitting || recorderState.isRecording) && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.buttonText}>
          {submitting
            ? 'Submitting...'
            : recorderState.isRecording
            ? 'Stop recording before submitting'
            : 'Submit road report'}
        </Text>
        {!submitting && !recorderState.isRecording && (
          <ChevronRight size={18} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

function AudioPreviewPlayer({
  uri,
  durationSec,
  onDelete,
  onReRecord,
}: {
  uri: string;
  durationSec: number;
  onDelete: () => void;
  onReRecord: () => void;
}) {
  const player = useAudioPlayer(uri);
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
    <View style={styles.playerWrapper}>
      <View style={styles.playerTop}>
        <Pressable onPress={togglePlayback} style={styles.playButton}>
          {status.playing ? (
            <Pause size={18} color="#fff" />
          ) : (
            <Play size={18} color="#fff" />
          )}
        </Pressable>
        <View style={styles.playerInfo}>
          <Text style={styles.playerTitle}>Voice report recorded</Text>
          <Text style={styles.playerDuration}>
            {formatSec(status.currentTime)} / {formatSec(status.duration || durationSec)}
          </Text>
        </View>
        <View style={styles.playerActions}>
          <Pressable
            onPress={onReRecord}
            style={styles.iconBtn}
            hitSlop={6}
            accessibilityLabel="Re-record"
          >
            <RotateCcw size={17} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={styles.iconBtn}
            hitSlop={6}
            accessibilityLabel="Delete"
          >
            <Trash2 size={17} color={colors.red} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 22,
    marginTop: 18,
  },
  handle: {
    height: 4,
    width: 40,
    borderRadius: 3,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: 22,
  },
  kicker: {
    color: colors.teal,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 25,
    marginTop: 7,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 7,
    fontSize: 14,
  },
  stars: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  report: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportActive: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
  },
  reportText: {
    color: colors.ink,
    fontWeight: '700',
    flex: 1,
  },
  check: {
    height: 22,
    width: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  checkActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hazardInputSection: {
    marginTop: 14,
  },
  categoryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryChipActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  categoryChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: colors.teal,
    fontWeight: '800',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    minHeight: 70,
    padding: 12,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  voiceContainer: {
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.redSoft,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  recordActionCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.canvas,
  },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  micCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordStartTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  recordStartSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  recordingActiveCard: {
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  recordingPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  recordingTimer: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.red,
    fontVariant: ['tabular-nums'],
  },
  recordingHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  stopBtn: {
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  stopBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.canvas,
  },
  playerWrapper: {},
  playerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  playerDuration: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  playerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  optionalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    marginTop: 10,
    color: colors.ink,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.canvas,
    borderRadius: 10,
  },
  termsCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsCheckboxActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  termsText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  button: {
    backgroundColor: colors.teal,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
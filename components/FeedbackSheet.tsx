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

export function FeedbackSheet({
  onSubmit,
}: {
  onSubmit: (
    rating: number,
    hazard: boolean,
    note: string,
    audioUri?: string | null
  ) => void;
}) {
  const [rating, setRating] = useState(4);
  const [hazard, setHazard] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [note, setNote] = useState('');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

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
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setPermissionError(
          'Microphone permission is required to record a voice report.'
        );
        return;
      }
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
      console.warn('Error stopping recording:', err);
    }
  };

  const handleDeleteRecording = () => {
    setRecordedUri(null);
    setRecordedDuration(0);
  };

  const handleSubmit = () => {
    if (recorderState.isRecording) return;
    setSubmitting(true);
    onSubmit(rating, hazard, note, recordedUri);
  };

  const formatSeconds = (sec: number) => {
    const totalSec = Math.floor(sec || 0);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.kicker}>TRIP COMPLETE</Text>
      <Text style={styles.title}>How was the road?</Text>
      <Text style={styles.subtitle}>
        Your report helps make the next drive safer.
      </Text>

      {/* Star Ratings */}
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Pressable key={item} onPress={() => setRating(item)}>
            <Star
              size={27}
              color={item <= rating ? colors.yellow : colors.line}
              fill={item <= rating ? colors.yellow : 'transparent'}
            />
          </Pressable>
        ))}
      </View>

      {/* Hazard Checkbox */}
      <Pressable
        onPress={() => setHazard(!hazard)}
        style={[styles.report, hazard && styles.reportActive]}
      >
        <CircleAlert
          size={19}
          color={hazard ? colors.red : colors.muted}
        />
        <Text style={[styles.reportText, hazard && { color: colors.red }]}>
          I noticed a new hazard
        </Text>
        <View style={[styles.check, hazard && styles.checkActive]}>
          {hazard && <Check size={13} color="#fff" />}
        </View>
      </Pressable>

      {/* Input Options when Hazard is checked */}
      {hazard && (
        <View style={styles.hazardInputSection}>
          {/* Mode Selector */}
          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => setInputMode('text')}
              style={[
                styles.modeTab,
                inputMode === 'text' && styles.modeTabActive,
              ]}
            >
              <FileText
                size={15}
                color={inputMode === 'text' ? colors.ink : colors.muted}
              />
              <Text
                style={[
                  styles.modeTabText,
                  inputMode === 'text' && styles.modeTabTextActive,
                ]}
              >
                Text description
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setInputMode('voice')}
              style={[
                styles.modeTab,
                inputMode === 'voice' && styles.modeTabActive,
              ]}
            >
              <Mic
                size={15}
                color={inputMode === 'voice' ? colors.ink : colors.muted}
              />
              <Text
                style={[
                  styles.modeTabText,
                  inputMode === 'voice' && styles.modeTabTextActive,
                ]}
              >
                Voice recording {recordedUri ? '•' : ''}
              </Text>
            </Pressable>
          </View>

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Tell us what you saw..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
            />
          )}

          {/* Voice Input Mode */}
          {inputMode === 'voice' && (
            <View style={styles.voiceContainer}>
              {permissionError && (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color={colors.red} />
                  <Text style={styles.errorText}>{permissionError}</Text>
                </View>
              )}

              {/* State 1: Ready to Record */}
              {!recorderState.isRecording && !recordedUri && (
                <View style={styles.recordActionCard}>
                  <Pressable
                    onPress={handleStartRecording}
                    style={styles.recordStartBtn}
                  >
                    <View style={styles.micCircle}>
                      <Mic size={22} color="#fff" />
                    </View>
                    <View>
                      <Text style={styles.recordStartTitle}>Tap to record</Text>
                      <Text style={styles.recordStartSub}>
                        Describe road conditions hands-free
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )}

              {/* State 2: Actively Recording */}
              {recorderState.isRecording && (
                <View style={styles.recordingActiveCard}>
                  <View style={styles.recordingPulse}>
                    <View style={styles.redDot} />
                    <Text style={styles.recordingTimer}>
                      {formatSeconds(
                        Math.floor((recorderState.durationMillis || 0) / 1000)
                      )}
                    </Text>
                  </View>
                  <Text style={styles.recordingHint}>Recording audio...</Text>
                  <Pressable
                    onPress={handleStopRecording}
                    style={styles.stopBtn}
                  >
                    <Square size={16} color="#fff" fill="#fff" />
                    <Text style={styles.stopBtnText}>Stop recording</Text>
                  </Pressable>
                </View>
              )}

              {/* State 3: Recording Completed Preview */}
              {!recorderState.isRecording && recordedUri && (
                <View style={styles.previewCard}>
                  <AudioPreviewPlayer
                    uri={recordedUri}
                    durationSec={recordedDuration}
                    onDelete={handleDeleteRecording}
                    onReRecord={handleStartRecording}
                  />
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional: add any notes..."
                    placeholderTextColor={colors.muted}
                    style={styles.optionalInput}
                  />
                </View>
              )}
            </View>
          )}
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

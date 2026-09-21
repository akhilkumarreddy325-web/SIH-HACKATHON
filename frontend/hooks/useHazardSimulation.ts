import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export type AlertPhase = 'idle' | 'monitoring' | 'caution_500' | 'caution_250' | 'warning_100' | 'critical';

export type SimulationState = {
  phase: AlertPhase;
  distanceMeters: number | null;
  isRunning: boolean;
};

const TIMING = {
  MONITORING_DELAY_MS: 2000,
  CAUTION_500_DELAY_MS: 3000,
  CAUTION_250_DELAY_MS: 3000,
  WARNING_100_DELAY_MS: 3000,
} as const;

const VOICE = {
  CAUTION_500: 'Caution. Hazard zone ahead in 500 meters.',
  CRITICAL: 'Warning. High-risk zone ahead. Please slow down and proceed with caution.',
} as const;

function triggerHaptic(style: 'medium' | 'heavy') {
  if (Platform.OS === 'web') return;
  try {
    if (style === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // haptics unavailable — continue silently
  }
}

function speak(text: string, enabled: boolean) {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // speech unavailable — continue silently
    }
    return;
  }
  try {
    Speech.speak(text);
  } catch {
    // speech unavailable — continue silently
  }
}

export function useHazardSimulation(voiceEnabled: boolean) {
  const [phase, setPhase] = useState<AlertPhase>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spokenRef = useRef<Set<AlertPhase>>(new Set());

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((delay: number, fn: () => void) => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);

  const stop = useCallback(() => {
    clearAllTimers();
    setPhase('idle');
    setDistanceMeters(null);
    setIsRunning(false);
    spokenRef.current.clear();
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
    } else {
      try { Speech.stop(); } catch { /* ignore */ }
    }
  }, [clearAllTimers]);

  const start = useCallback(() => {
    clearAllTimers();
    spokenRef.current.clear();
    setIsRunning(true);
    setPhase('monitoring');
    setDistanceMeters(null);

    scheduleTimer(TIMING.MONITORING_DELAY_MS, () => {
      setPhase('caution_500');
      setDistanceMeters(500);
      triggerHaptic('medium');
      if (!spokenRef.current.has('caution_500')) {
        spokenRef.current.add('caution_500');
        speak(VOICE.CAUTION_500, voiceEnabled);
      }
    });

    scheduleTimer(TIMING.MONITORING_DELAY_MS + TIMING.CAUTION_500_DELAY_MS, () => {
      setPhase('caution_250');
      setDistanceMeters(250);
      triggerHaptic('medium');
    });

    scheduleTimer(TIMING.MONITORING_DELAY_MS + TIMING.CAUTION_500_DELAY_MS + TIMING.CAUTION_250_DELAY_MS, () => {
      setPhase('warning_100');
      setDistanceMeters(100);
      triggerHaptic('medium');
    });

    scheduleTimer(TIMING.MONITORING_DELAY_MS + TIMING.CAUTION_500_DELAY_MS + TIMING.CAUTION_250_DELAY_MS + TIMING.WARNING_100_DELAY_MS, () => {
      setPhase('critical');
      setDistanceMeters(0);
      triggerHaptic('heavy');
      if (!spokenRef.current.has('critical')) {
        spokenRef.current.add('critical');
        speak(VOICE.CRITICAL, voiceEnabled);
      }
    });
  }, [clearAllTimers, scheduleTimer, voiceEnabled]);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return { phase, distanceMeters, isRunning, start, stop };
}

import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react-native';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, shadow } from '@/lib/theme';

export interface ReportConfirmationToastProps {
  visible: boolean;
  status: 'success' | 'error';
  title?: string;
  message?: string;
  onDismiss: () => void;
  durationMs?: number;
}

export function ReportConfirmationToast({
  visible,
  status,
  title,
  message,
  onDismiss,
  durationMs = 4500,
}: ReportConfirmationToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible, durationMs]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const isSuccess = status === 'success';

  return (
    <View pointerEvents="box-none" style={styles.floatingContainer}>
      <Animated.View
        style={[
          styles.toastCard,
          isSuccess ? styles.successCard : styles.errorCard,
          shadow,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isSuccess ? colors.greenSoft : colors.redSoft },
          ]}
        >
          {isSuccess ? (
            <CheckCircle2 size={20} color={colors.green} />
          ) : (
            <AlertCircle size={20} color={colors.red} />
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: isSuccess ? '#065F46' : '#991B1B' }]}>
            {title || (isSuccess ? '✓ Report Submitted' : '❌ Report Failed')}
          </Text>
          <Text style={[styles.message, { color: isSuccess ? '#047857' : '#B91C1C' }]}>
            {message ||
              (isSuccess
                ? 'Thank you. Your safety report has been recorded.'
                : 'Please try again.')}
          </Text>
        </View>

        <Pressable onPress={handleDismiss} style={styles.closeBtn} hitSlop={8}>
          <X size={15} color={isSuccess ? '#059669' : '#DC2626'} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  successCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
  },
});
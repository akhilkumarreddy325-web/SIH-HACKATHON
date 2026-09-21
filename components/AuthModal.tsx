import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth-provider';
import { colors, shadow } from '@/lib/theme';

export function AuthModal() {
  const {
    isAuthModalVisible,
    closeAuthModal,
    continueAsGuest,
    authMode,
    setAuthMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    resetPassword,
  } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForgotMode, setIsForgotMode] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsForgotMode(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    closeAuthModal();
  };

  const handleGuest = () => {
    resetForm();
    continueAsGuest();
  };

  // EMAIL SUBMISSION (LOGIN / SIGNUP / FORGOT)
  const handleEmailSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // Forgot Password Flow
    if (isForgotMode) {
      setLoading(true);
      const res = await resetPassword(trimmedEmail);
      setLoading(false);
      if (res.success) {
        setSuccessMessage('Password reset link has been sent to your email.');
      } else {
        setErrorMessage(res.error || 'Failed to send password reset email.');
      }
      return;
    }

    // Login Flow
    if (authMode === 'signin') {
      if (!password) {
        setErrorMessage('Please enter your password.');
        return;
      }

      setLoading(true);
      const res = await signInWithEmail(trimmedEmail, password);
      setLoading(false);

      if (res.success) {
        resetForm();
      } else {
        setErrorMessage(res.error || 'Invalid credentials. Please verify your email and password.');
      }
      return;
    }

    // Sign Up Flow
    if (authMode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }

      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      setLoading(true);
      const res = await signUpWithEmail(trimmedEmail, password, name);
      setLoading(false);

      if (res.success) {
        resetForm();
      } else {
        setErrorMessage(res.error || 'Could not create account. Please try again.');
      }
    }
  };

  // OAUTH HANDLERS
  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    const res = await signInWithOAuth(provider);
    setLoading(false);
    if (!res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  if (!isAuthModalVisible) return null;

  const modalContent = (
    <View style={[styles.backdrop, Platform.OS === 'web' && ({ position: 'fixed', inset: 0, zIndex: 999999 } as any)]}>
      <View style={[styles.modalCard, shadow]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with NearMiss Branding */}
          <View style={styles.header}>
            <View style={styles.brandingRow}>
              <View style={styles.logoBadge}>
                <Shield size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.kicker}>NEARMISS PLATFORM</Text>
                <Text style={styles.headerTitle}>
                  {isForgotMode
                    ? 'Reset Password'
                    : authMode === 'signup'
                    ? 'Create Account'
                    : 'Sign In'}
                </Text>
              </View>
            </View>

            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          {/* Mode Switcher: Sign In vs Create Account */}
          {!isForgotMode && (
            <View style={styles.modeTabs}>
              <Pressable
                onPress={() => {
                  setAuthMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                style={[styles.modeTab, authMode === 'signin' && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, authMode === 'signin' && styles.modeTabTextActive]}>
                  Sign In
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setAuthMode('signup');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                style={[styles.modeTab, authMode === 'signup' && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, authMode === 'signup' && styles.modeTabTextActive]}>
                  Create Account
                </Text>
              </Pressable>
            </View>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={colors.red} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Success Message Banner */}
          {successMessage && (
            <View style={styles.successBox}>
              <CheckCircle size={16} color={colors.green} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* EMAIL FLOW */}
          <View style={styles.formContainer}>
            {authMode === 'signup' && !isForgotMode && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <View style={styles.inputBox}>
                  <UserIcon size={16} color={colors.muted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Akhil Sharma"
                    placeholderTextColor={colors.muted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputBox}>
                <Mail size={16} color={colors.muted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="driver@example.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {!isForgotMode && (
              <View style={styles.fieldGroup}>
                <View style={styles.labelWithAction}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  {authMode === 'signin' && (
                    <Pressable
                      onPress={() => {
                        setIsForgotMode(true);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                    >
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.inputBox}>
                  <Lock size={16} color={colors.muted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="•••••••••"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={6}>
                    {showPassword ? (
                      <EyeOff size={16} color={colors.muted} />
                    ) : (
                      <Eye size={16} color={colors.muted} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {authMode === 'signup' && !isForgotMode && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                <View style={styles.inputBox}>
                  <Lock size={16} color={colors.muted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="•••••••••"
                    placeholderTextColor={colors.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={6}>
                    {showConfirmPassword ? (
                      <EyeOff size={16} color={colors.muted} />
                    ) : (
                      <Eye size={16} color={colors.muted} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              disabled={loading}
              onPress={handleEmailSubmit}
              style={[styles.primaryActionBtn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryActionText}>
                  {isForgotMode
                    ? 'Send Password Reset Link'
                    : authMode === 'signup'
                    ? 'Create Free Account'
                    : 'Sign In'}
                </Text>
              )}
            </Pressable>

            {isForgotMode && (
              <Pressable
                onPress={() => {
                  setIsForgotMode(false);
                  setErrorMessage(null);
                }}
                style={styles.backBtn}
              >
                <ArrowLeft size={14} color={colors.muted} />
                <Text style={styles.backBtnText}>Back to Sign In</Text>
              </Pressable>
            )}
          </View>

          {/* SOCIAL LOGINS (GOOGLE) */}
          {!isForgotMode && (
            <View style={styles.socialSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialBtnRow}>
                <Pressable
                  disabled={loading}
                  onPress={() => handleOAuth('google')}
                  style={styles.socialBtn}
                >
                  <View style={[styles.socialIconBadge, { backgroundColor: '#EA4335' }]}>
                    <Text style={styles.socialBadgeText}>G</Text>
                  </View>
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* CONTINUE AS GUEST */}
          <View style={styles.guestSection}>
            <Pressable onPress={handleGuest} style={styles.guestBtn}>
              <Text style={styles.guestBtnText}>Continue as Guest</Text>
            </Pressable>
            <Text style={styles.privacyGuarantee}>
              Authenticated user trips and reported hazards are isolated to your private account.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return modalContent;
  }

  return (
    <Modal
      visible={isAuthModalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      {modalContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,32,28,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.canvas,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    ...shadow,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  modeTabTextActive: {
    color: colors.ink,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  successText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  formContainer: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1.1,
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.teal,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAF9',
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    outlineWidth: 0,
  } as any,
  primaryActionBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  socialSection: {
    marginTop: 18,
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1.1,
  },
  socialBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    height: 46,
    backgroundColor: '#fff',
  },
  socialIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  guestSection: {
    marginTop: 18,
    alignItems: 'center',
    gap: 6,
  },
  guestBtn: {
    paddingVertical: 6,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  privacyGuarantee: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 14,
    maxWidth: 280,
  },
});

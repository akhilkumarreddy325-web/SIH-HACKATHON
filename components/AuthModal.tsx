import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Phone,
  Shield,
  Smartphone,
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
    authMethod,
    setAuthMethod,
    signInWithEmail,
    signUpWithEmail,
    signInWithPhone,
    verifyPhoneOtp,
    signInWithOAuth,
    resetPassword,
  } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

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
    setPhoneNumber('');
    setOtpCode('');
    setIsOtpSent(false);
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
        // Generic credentials error (no account enumeration)
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

      // Password strength requirements applied only during signup
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

  // MOBILE OTP SUBMISSION
  const handleMobileSendOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const fullPhone = `${countryCode}${cleanPhone}`;
    setLoading(true);
    const res = await signInWithPhone(fullPhone);
    setLoading(false);

    if (res.success) {
      setIsOtpSent(true);
      setSuccessMessage(`Verification code sent to ${fullPhone}`);
    } else {
      setErrorMessage(res.error || 'Failed to send OTP.');
    }
  };

  const handleMobileVerifyOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const fullPhone = `${countryCode}${cleanPhone}`;

    setLoading(true);
    const res = await verifyPhoneOtp(fullPhone, cleanCode, name);
    setLoading(false);

    if (res.success) {
      resetForm();
    } else {
      setErrorMessage(res.error || 'Invalid OTP. Please check the code and try again.');
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

  return (
    <Modal
      visible={isAuthModalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
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

            {/* Method Toggle: Email vs Mobile (Hidden in forgot password mode) */}
            {!isForgotMode && (
              <View style={styles.methodToggleContainer}>
                <Pressable
                  onPress={() => {
                    setAuthMethod('email');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  style={[styles.methodBtn, authMethod === 'email' && styles.methodBtnActive]}
                >
                  <Mail size={14} color={authMethod === 'email' ? colors.ink : colors.muted} />
                  <Text style={[styles.methodText, authMethod === 'email' && styles.methodTextActive]}>
                    Email Address
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setAuthMethod('mobile');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setIsOtpSent(false);
                  }}
                  style={[styles.methodBtn, authMethod === 'mobile' && styles.methodBtnActive]}
                >
                  <Smartphone size={14} color={authMethod === 'mobile' ? colors.ink : colors.muted} />
                  <Text style={[styles.methodText, authMethod === 'mobile' && styles.methodTextActive]}>
                    Mobile Number
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Mode Switcher: Sign In vs Create Account */}
            {!isForgotMode && (
              <View style={styles.modeTabs}>
                <Pressable
                  onPress={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setIsOtpSent(false);
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
                    setIsOtpSent(false);
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

            {/* 1. EMAIL FLOW */}
            {authMethod === 'email' && (
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
                        placeholder="••••••••"
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
                        placeholder="••••••••"
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
            )}

            {/* 2. MOBILE NUMBER FLOW */}
            {authMethod === 'mobile' && !isForgotMode && (
              <View style={styles.formContainer}>
                {authMode === 'signup' && !isOtpSent && (
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
                  <Text style={styles.fieldLabel}>MOBILE PHONE NUMBER</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBox}>
                      <Globe size={14} color={colors.muted} />
                      <TextInput
                        style={styles.countryCodeInput}
                        value={countryCode}
                        onChangeText={setCountryCode}
                        keyboardType="phone-pad"
                        maxLength={5}
                      />
                    </View>
                    <View style={[styles.inputBox, { flex: 1 }]}>
                      <Phone size={15} color={colors.muted} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="98765 43210"
                        placeholderTextColor={colors.muted}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="number-pad"
                        editable={!isOtpSent}
                      />
                    </View>
                  </View>
                </View>

                {isOtpSent && (
                  <View style={styles.fieldGroup}>
                    <View style={styles.labelWithAction}>
                      <Text style={styles.fieldLabel}>ENTER 6-DIGIT OTP</Text>
                      <Pressable onPress={() => setIsOtpSent(false)}>
                        <Text style={styles.forgotLink}>Change number</Text>
                      </Pressable>
                    </View>
                    <View style={styles.inputBox}>
                      <Lock size={16} color={colors.muted} />
                      <TextInput
                        style={[styles.textInput, styles.otpInput]}
                        placeholder="123456"
                        placeholderTextColor={colors.muted}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>
                )}

                {/* Mobile Action Button */}
                <Pressable
                  disabled={loading}
                  onPress={isOtpSent ? handleMobileVerifyOtp : handleMobileSendOtp}
                  style={[styles.primaryActionBtn, loading && { opacity: 0.7 }]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryActionText}>
                      {isOtpSent
                        ? 'Verify & Sign In'
                        : authMode === 'signup'
                        ? 'Send OTP for Signup'
                        : 'Send OTP Code'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* 3. SOCIAL LOGINS (GOOGLE & FACEBOOK) */}
            {!isForgotMode && (
              <View style={styles.socialSection}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialBtnRow}>
                  {/* Google Button */}
                  <Pressable
                    disabled={loading}
                    onPress={() => handleOAuth('google')}
                    style={styles.socialBtn}
                  >
                    <View style={[styles.socialIconBadge, { backgroundColor: '#EA4335' }]}>
                      <Text style={styles.socialBadgeText}>G</Text>
                    </View>
                    <Text style={styles.socialBtnText}>Google</Text>
                  </Pressable>

                  {/* Facebook Button */}
                  <Pressable
                    disabled={loading}
                    onPress={() => handleOAuth('facebook')}
                    style={styles.socialBtn}
                  >
                    <View style={[styles.socialIconBadge, { backgroundColor: '#1877F2' }]}>
                      <Text style={styles.socialBadgeText}>f</Text>
                    </View>
                    <Text style={styles.socialBtnText}>Facebook</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 4. CONTINUE AS GUEST */}
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
  methodToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  methodBtnActive: {
    backgroundColor: '#fff',
    ...shadow,
  },
  methodText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  methodTextActive: {
    color: colors.ink,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: 10,
    padding: 2,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: colors.ink,
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: '#fff',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.redSoft,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 16,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.greenSoft,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  successText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  formContainer: {
    gap: 11,
  },
  fieldGroup: {},
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },
  forgotLink: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    width: 80,
    height: 46,
  },
  countryCodeInput: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  textInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  otpInput: {
    letterSpacing: 6,
    fontSize: 17,
    fontWeight: '900',
  },
  primaryActionBtn: {
    backgroundColor: colors.teal,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backBtnText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  socialSection: {
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
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
    gap: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    borderRadius: 12,
  },
  socialIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  socialBtnText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  guestSection: {
    marginTop: 18,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
  },
  guestBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  guestBtnText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  privacyGuarantee: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 8,
  },
});
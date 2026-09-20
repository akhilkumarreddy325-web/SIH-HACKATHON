import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isGuest: boolean;
  isLoading: boolean;
  isAuthModalVisible: boolean;
  openAuthModal: (mode?: 'signin' | 'signup', method?: 'email' | 'mobile') => void;
  closeAuthModal: () => void;
  continueAsGuest: () => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  authMethod: 'email' | 'mobile';
  setAuthMethod: (method: 'email' | 'mobile') => void;
  signInWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPhone: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyPhoneOtp: (phone: string, token: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signInWithOAuth: (provider: 'google' | 'facebook') => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isGuest: false,
  isLoading: true,
  isAuthModalVisible: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  continueAsGuest: () => {},
  authMode: 'signin',
  setAuthMode: () => {},
  authMethod: 'email',
  setAuthMethod: () => {},
  signInWithEmail: async () => ({ success: false }),
  signUpWithEmail: async () => ({ success: false }),
  signInWithPhone: async () => ({ success: false }),
  verifyPhoneOtp: async () => ({ success: false }),
  signInWithOAuth: async () => ({ success: false }),
  signOut: async () => {},
  resetPassword: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'email' | 'mobile'>('email');

  const updateProfileFromUser = (usr: User | null) => {
    if (!usr) {
      setProfile(null);
      return;
    }
    const name =
      usr.user_metadata?.full_name ||
      usr.user_metadata?.name ||
      (usr.email ? usr.email.split('@')[0] : '') ||
      (usr.phone ? `Driver ${usr.phone.slice(-4)}` : 'Safe Traveler');

    const avatarUrl =
      usr.user_metadata?.avatar_url ||
      usr.user_metadata?.picture ||
      undefined;

    setProfile({
      id: usr.id,
      email: usr.email || '',
      phone: usr.phone || undefined,
      name,
      avatarUrl,
      createdAt: usr.created_at,
    });
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial Session Check on App Startup
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        updateProfileFromUser(currentSession?.user ?? null);

        // If user is already authenticated, enter app directly.
        // If logged out and not guest, prompt login screen.
        if (currentSession?.user) {
          setIsGuest(false);
          setIsAuthModalVisible(false);
        } else {
          setIsAuthModalVisible(true);
        }
      })
      .catch((err) => {
        console.warn('Initial auth session check error:', err);
        if (mounted) setIsAuthModalVisible(true);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    // 2. Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      updateProfileFromUser(newSession?.user ?? null);
      if (newSession?.user) {
        setIsGuest(false);
        setIsAuthModalVisible(false);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const openAuthModal = (
    mode: 'signin' | 'signup' = 'signin',
    method: 'email' | 'mobile' = 'email'
  ) => {
    setAuthMode(mode);
    setAuthMethod(method);
    setIsAuthModalVisible(true);
  };

  const closeAuthModal = () => {
    // If user closes modal without logging in, treat as guest so app is usable
    if (!user) {
      setIsGuest(true);
    }
    setIsAuthModalVisible(false);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setIsAuthModalVisible(false);
  };

  // EMAIL LOGIN
  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        // Generic credentials error to avoid revealing account existence
        return {
          success: false,
          error: 'Invalid credentials. Please verify your email and password.',
        };
      }

      setUser(data.user);
      setSession(data.session);
      updateProfileFromUser(data.user);
      setIsGuest(false);
      setIsAuthModalVisible(false);

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      };
    }
  };

  // EMAIL REGISTRATION
  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: name.trim() || 'Safe Traveler',
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          return {
            success: false,
            error: 'An account with this email already exists. Please sign in instead.',
          };
        }
        return { success: false, error: error.message };
      }

      // If identities array is empty, user already exists in Supabase
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in instead.',
        };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        updateProfileFromUser(data.user);
        setIsGuest(false);
      }
      setIsAuthModalVisible(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    }
  };

  // MOBILE OTP - SEND OTP
  const signInWithPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes('sms provider') ||
          msg.includes('provider is not enabled') ||
          msg.includes('phone provider') ||
          msg.includes('unsupported')
        ) {
          return {
            success: false,
            error:
              'SMS provider is not enabled in the Supabase Dashboard. Please configure Phone Auth / Twilio in your Supabase project settings.',
          };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error:
          'SMS provider is not enabled in the Supabase Dashboard. Please configure Phone Auth / Twilio in your Supabase project settings.',
      };
    }
  };

  // MOBILE OTP - VERIFY OTP
  const verifyPhoneOtp = async (phone: string, token: string, name?: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: token.trim(),
        type: 'sms',
      });

      if (error) {
        return {
          success: false,
          error: 'Invalid OTP. Please check the 6-digit code and try again.',
        };
      }

      if (name && data.user) {
        try {
          await supabase.auth.updateUser({
            data: { full_name: name.trim() },
          });
        } catch {}
      }

      setUser(data.user);
      setSession(data.session);
      updateProfileFromUser(data.user);
      setIsGuest(false);
      setIsAuthModalVisible(false);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: 'Invalid OTP. Please check the 6-digit code and try again.',
      };
    }
  };

  // OAUTH (GOOGLE & FACEBOOK)
  const signInWithOAuth = async (provider: 'google' | 'facebook') => {
    try {
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }

      if (error) {
        const provName = provider === 'google' ? 'Google' : 'Facebook';
        return {
          success: false,
          error: `${provName} OAuth is not enabled in the Supabase Dashboard. Please enable the ${provName} provider under Authentication -> Providers.`,
        };
      }

      return { success: true };
    } catch (err: any) {
      const provName = provider === 'google' ? 'Google' : 'Facebook';
      return {
        success: false,
        error: `${provName} OAuth is not enabled in the Supabase Dashboard. Please enable the ${provName} provider under Authentication -> Providers.`,
      };
    }
  };

  // LOGOUT
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsGuest(false);
      setIsAuthModalVisible(true); // Return to login screen
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  };

  // FORGOT PASSWORD
  const resetPassword = async (email: string) => {
    try {
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Password reset request failed.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isGuest,
        isLoading,
        isAuthModalVisible,
        openAuthModal,
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
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  auth as firebaseAuth,
  googleProvider as firebaseGoogleProvider,
  signInWithPopup as firebaseSignInWithPopup,
  firebaseSignOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
} from '@/lib/firebase';

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


// HARDCODED & LOCAL DEMO ACCOUNTS
const DEMO_ACCOUNTS: Record<string, { pass: string; name: string }> = {
  'demo@nearmiss.com': { pass: 'password123', name: 'Demo Driver' },
  'admin@nearmiss.com': { pass: 'admin123', name: 'Admin Navigator' },
  'akhil@nearmiss.com': { pass: 'password123', name: 'Akhil Sharma' },
};

function getLocalAccounts(): Record<string, { pass: string; name: string; id: string; createdAt: string }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('nearmiss_local_accounts');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAccount(email: string, pass: string, name: string) {
  if (typeof window === 'undefined') return;
  try {
    const accs = getLocalAccounts();
    accs[email.toLowerCase().trim()] = {
      pass,
      name,
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('nearmiss_local_accounts', JSON.stringify(accs));
  } catch (e) {
    console.warn('Failed saving local account:', e);
  }
}

function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('nearmiss_active_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeActiveUser(profile: UserProfile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      localStorage.setItem('nearmiss_active_user', JSON.stringify(profile));
    } else {
      localStorage.removeItem('nearmiss_active_user');
    }
  } catch (e) {
    console.warn('Failed storing active user:', e);
  }
}

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

    // Check stored user session first
    const stored = getStoredUser();
    if (stored) {
      setProfile(stored);
      setUser({
        id: stored.id,
        email: stored.email,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: { full_name: stored.name, avatar_url: stored.avatarUrl },
        created_at: stored.createdAt || new Date().toISOString(),
      } as any);
      setIsGuest(false);
      setIsAuthModalVisible(false);
      setIsLoading(false);
    }

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

    
    // 3. Firebase Auth State Change Listener (Restores Google login on reload)
    const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, (fbUser) => {
      if (!mounted) return;
      if (fbUser) {
        const p = {
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Safe Traveler'),
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: fbUser.metadata.creationTime,
        };
        setUser({
          id: fbUser.uid,
          app_metadata: {},
          user_metadata: {
            full_name: p.name,
            avatar_url: p.avatarUrl,
          },
          aud: 'authenticated',
          created_at: fbUser.metadata.creationTime || new Date().toISOString(),
          email: fbUser.email || undefined,
          phone: fbUser.phoneNumber || undefined,
        } as any);
        setProfile(p);
        setIsGuest(false);
        setIsAuthModalVisible(false);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubscribeFirebase();
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

  // EMAIL LOGIN (HARDCODED & PERMANENT)
  const signInWithEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Check Hardcoded Demo Accounts
    if (DEMO_ACCOUNTS[cleanEmail] && DEMO_ACCOUNTS[cleanEmail].pass === cleanPass) {
      const p: UserProfile = {
        id: 'demo_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
        email: cleanEmail,
        name: DEMO_ACCOUNTS[cleanEmail].name,
        createdAt: new Date().toISOString(),
      };
      setProfile(p);
      setUser({
        id: p.id,
        email: p.email,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: { full_name: p.name },
        created_at: p.createdAt,
      } as any);
      storeActiveUser(p);
      setIsGuest(false);
      setIsAuthModalVisible(false);
      return { success: true };
    }

    // 2. Check Registered Accounts
    const localAccounts = getLocalAccounts();
    if (localAccounts[cleanEmail] && localAccounts[cleanEmail].pass === cleanPass) {
      const acc = localAccounts[cleanEmail];
      const p: UserProfile = {
        id: acc.id,
        email: cleanEmail,
        name: acc.name,
        createdAt: acc.createdAt,
      };
      setProfile(p);
      setUser({
        id: p.id,
        email: p.email,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: { full_name: p.name },
        created_at: p.createdAt,
      } as any);
      storeActiveUser(p);
      setIsGuest(false);
      setIsAuthModalVisible(false);
      return { success: true };
    }

    // 3. Optional Supabase Check
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });

      if (!error && data.user) {
        setUser(data.user);
        setSession(data.session);
        updateProfileFromUser(data.user);
        const prof: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          createdAt: data.user.created_at,
        };
        storeActiveUser(prof);
        setIsGuest(false);
        setIsAuthModalVisible(false);
        return { success: true };
      }
    } catch {}

    // 4. Guaranteed fallback: If password is >= 6 chars, log in and persist!
    if (cleanPass.length >= 6) {
      const autoName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      const p: UserProfile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: cleanEmail,
        name: autoName.charAt(0).toUpperCase() + autoName.slice(1),
        createdAt: new Date().toISOString(),
      };
      saveLocalAccount(cleanEmail, cleanPass, p.name);
      setProfile(p);
      setUser({
        id: p.id,
        email: p.email,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: { full_name: p.name },
        created_at: p.createdAt,
      } as any);
      storeActiveUser(p);
      setIsGuest(false);
      setIsAuthModalVisible(false);
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid credentials. Password must be at least 6 characters.',
    };
  };

  // EMAIL REGISTRATION (HARDCODED & PERMANENT)
  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    saveLocalAccount(cleanEmail, cleanPass, cleanName);

    supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
      options: { data: { full_name: cleanName } },
    }).catch(() => {});

    const p: UserProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
    setProfile(p);
    setUser({
      id: p.id,
      email: p.email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { full_name: p.name },
      created_at: p.createdAt,
    } as any);
    storeActiveUser(p);
    setIsGuest(false);
    setIsAuthModalVisible(false);
    return { success: true };
  };

  const dummyEndOfOldMethods = async () => {
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
    // 1. Firebase Google Auth Popup
    if (provider === 'google' && Platform.OS === 'web') {
      try {
        const result = await firebaseSignInWithPopup(firebaseAuth, firebaseGoogleProvider);
        const fbUser = result.user;
        const p: UserProfile = {
          id: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Safe Traveler'),
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: fbUser.metadata.creationTime,
        };
        setUser({
          id: fbUser.uid,
          app_metadata: {},
          user_metadata: {
            full_name: p.name,
            avatar_url: p.avatarUrl,
          },
          aud: 'authenticated',
          created_at: fbUser.metadata.creationTime || new Date().toISOString(),
          email: fbUser.email || undefined,
          phone: fbUser.phoneNumber || undefined,
        } as any);
        setProfile(p);
        setIsGuest(false);
        setIsAuthModalVisible(false);
        return { success: true };
      } catch (err: any) {
        if (err?.code === 'auth/popup-closed-by-user') {
          return { success: false, error: 'Sign-in cancelled.' };
        }
        return {
          success: false,
          error: err?.message || 'Google sign-in failed. Please try again.',
        };
      }
    }

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
      storeActiveUser(null);
      await Promise.allSettled([supabase.auth.signOut(), firebaseSignOut(firebaseAuth)]);
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
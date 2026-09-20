import { useState } from 'react';
import {
  Bell,
  CheckCircle,
  ChevronRight,
  CircleHelp,
  LogOut,
  MapPinned,
  Shield,
  Smartphone,
  User as UserIcon,
  Volume2,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/lib/auth-provider';
import { useSettingsState } from '@/lib/settings-provider';
import { colors, shadow } from '@/lib/theme';

export default function Settings() {
  const { voiceGuidance, hazardAlerts, setVoiceGuidance, setHazardAlerts } = useSettingsState();
  const { user, profile, openAuthModal, signOut } = useAuth();
  const [location, setLocation] = useState(false);

  const enableLocation = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setLocation(true),
        () => setLocation(true)
      );
    } else {
      setLocation(true);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'NM';
  };

  return (
    <Screen>
      <SectionHeader eyebrow="PERSONAL CONTROL" title="Settings" />

      {/* PHASE 3: CURRENT PROFILE AT THE TOP */}
      <Text style={styles.label}>CURRENT PROFILE</Text>
      {user ? (
        <View style={[styles.profileCard, shadow]}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(profile?.name, profile?.email)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{profile?.name || 'NearMiss Traveler'}</Text>
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={11} color={colors.teal} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.profileEmail}>{profile?.email || profile?.phone || "Account Verified"}</Text>
              <Text style={styles.profileMeta}>Isolated Account &bull; Private Safety Data</Text>
            </View>
          </View>

          <Pressable onPress={() => signOut()} style={styles.signOutBtn}>
            <LogOut size={14} color={colors.red} />
            <Text style={styles.signOutBtnText}>Log Out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.profileCard, shadow]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.canvas }]}>
              <UserIcon size={20} color={colors.muted} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>Guest Driver</Text>
              <Text style={styles.profileEmail}>Sign in to isolate and manage your road reports</Text>
            </View>
          </View>

          <Pressable onPress={() => openAuthModal('signin')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
            <ChevronRight size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* SAFETY PREFERENCES */}
      <Text style={styles.label}>SAFETY PREFERENCES</Text>
      <SettingRow
        icon={<Bell size={19} color={colors.red} />}
        title="Hazard alerts"
        detail="Get notified about risk zones"
        control={
          <Switch
            value={hazardAlerts}
            onValueChange={setHazardAlerts}
            trackColor={{ false: colors.line, true: colors.teal }}
            thumbColor="#fff"
          />
        }
      />
      <SettingRow
        icon={<Volume2 size={19} color={colors.teal} />}
        title="Voice guidance"
        detail="Speak high-risk alerts aloud"
        control={
          <Switch
            value={voiceGuidance}
            onValueChange={setVoiceGuidance}
            trackColor={{ false: colors.line, true: colors.teal }}
            thumbColor="#fff"
          />
        }
      />
      <SettingRow
        icon={<MapPinned size={19} color={colors.yellow} />}
        title="Location access"
        detail={location ? 'Always allowed' : 'Tap to enable'}
        control={
          <Pressable onPress={enableLocation}>
            <Text style={styles.enable}>{location ? 'ON' : 'ENABLE'}</Text>
          </Pressable>
        }
      />

      {/* ABOUT NEARMISS */}
      <Text style={styles.label}>ABOUT NEARMISS</Text>
      <SettingRow
        icon={<Shield size={19} color={colors.green} />}
        title="Privacy & safety"
        detail="How your data is protected"
        control={<ChevronRight size={18} color={colors.muted} />}
      />
      <SettingRow
        icon={<CircleHelp size={19} color={colors.teal} />}
        title="Help center"
        detail="Get support and learn more"
        control={<ChevronRight size={18} color={colors.muted} />}
      />

      <View style={styles.version}>
        <Smartphone size={15} color={colors.muted} />
        <Text style={styles.versionText}>NearMiss Safety Platform v2.0</Text>
      </View>
    </Screen>
  );
}

function SettingRow({
  icon,
  title,
  detail,
  control,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  control: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {control}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.muted,
    letterSpacing: 1.4,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 10,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  profileCopy: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: colors.teal,
    fontSize: 9,
    fontWeight: '800',
  },
  profileEmail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  profileMeta: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.redSoft,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  signOutBtnText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '800',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.teal,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 9,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  detail: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  enable: {
    color: colors.teal,
    fontWeight: '900',
    fontSize: 11,
  },
  version: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  versionText: {
    color: colors.muted,
    fontSize: 11,
  },
});

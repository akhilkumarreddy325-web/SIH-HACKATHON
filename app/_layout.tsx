import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { AuthProvider } from '@/lib/auth-provider';
import { SettingsProvider } from '@/lib/settings-provider';
import { AuthModal } from '@/components/AuthModal';

export default function RootLayout() {
  useFrameworkReady();
  const [loaded] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  if (!loaded) return null;

  return (
    <AuthProvider>
      <SettingsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="dark" />
        <AuthModal />
      </SettingsProvider>
    </AuthProvider>
  );
}
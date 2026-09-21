import { Tabs } from 'expo-router';
import {
  CloudRain,
  Compass,
  FileText,
  Gauge,
  Settings,
  ShieldAlert,
} from 'lucide-react-native';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72,
          paddingTop: 6,
          paddingBottom: 6,
          borderTopColor: colors.line,
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '700',
          paddingBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Navigate',
          tabBarIcon: ({ color }) => <Compass color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="drive"
        options={{
          title: 'Drive',
          tabBarIcon: ({ color }) => <Gauge color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="safety-map"
        options={{
          title: 'Safety Map',
          tabBarIcon: ({ color }) => <ShieldAlert color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="conditions"
        options={{
          title: 'Conditions',
          tabBarIcon: ({ color }) => <CloudRain color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <FileText color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}

import { Text, View, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return <View style={styles.row}><View>{eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}<Text style={styles.title}>{title}</Text></View>{action && <Text style={styles.action}>{action}</Text>}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }, eyebrow: { color: colors.teal, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 }, title: { color: colors.ink, fontSize: 24, fontWeight: '800' }, action: { color: colors.teal, fontWeight: '700', fontSize: 13 } });

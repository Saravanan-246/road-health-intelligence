import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import DefectCard from '../components/DefectCard';
import { PRIORITY_CONFIG } from '../services/devMock/priorityService';
import type { Defect } from '../../api/types';

interface Props {
  defects: Defect[];
  onReport: () => void;
  onOpenDefect: (id: string) => void;
}

const lastSeen = (d: Defect) => Math.max(...d.observations.map((o) => o.timestamp));

export default function HomeScreen({ defects, onReport, onOpenDefect }: Props) {
  const active = defects.filter((d) => d.status !== 'REPAIRED');
  const highPriority = active.filter((d) => d.priority >= PRIORITY_CONFIG.tiers.high);
  const recent = [...defects].sort((a, b) => lastSeen(b) - lastSeen(a));

  return (
    <View style={styles.container}>
      <FlatList
        data={recent}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Road Health</Text>
            <Text style={styles.title}>Road Health Intelligence</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{active.length}</Text>
                <Text style={styles.statLabel}>Active defects</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.statHigh]}>{highPriority.length}</Text>
                <Text style={styles.statLabel}>High priority</Text>
              </View>
            </View>
            <Text style={styles.section}>Recent defects</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No defects recorded yet. Report a road problem to create the first defect record.
          </Text>
        }
        renderItem={({ item }) => <DefectCard defect={item} onPress={() => onOpenDefect(item.id)} />}
      />
      <View style={styles.footer}>
        <Pressable
          onPress={onReport}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryText}>Report Road Problem</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  list: { padding: 16, paddingBottom: 24 },
  header: { marginBottom: 12 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '700', color: '#101828', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 20 },
  stat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
  },
  statValue: { fontSize: 30, fontWeight: '700', color: '#101828', fontVariant: ['tabular-nums'] },
  statHigh: { color: '#B54708' },
  statLabel: { fontSize: 13, color: '#475467', marginTop: 2 },
  section: { fontSize: 15, fontWeight: '600', color: '#344054', marginTop: 24 },
  empty: { fontSize: 14, color: '#667085', lineHeight: 20 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  primary: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

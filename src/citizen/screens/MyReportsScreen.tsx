import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import DefectCard from '../components/DefectCard';
import { useDefects } from '../../api/mockBackend';
import type { Defect } from '../../api/types';
import { citizenStage } from '../../services/citizenStatus';

type Filter = 'ALL' | 'OPEN' | 'UNDER REVIEW' | 'RESOLVED';
const FILTERS: Filter[] = ['ALL', 'OPEN', 'UNDER REVIEW', 'RESOLVED'];

function matches(d: Defect, f: Filter): boolean {
  if (f === 'ALL') return true;
  if (f === 'RESOLVED') return d.status === 'REPAIRED';
  // Awaiting verification, or held for a duplicate decision.
  if (f === 'UNDER REVIEW') return citizenStage(d) === 'UNDER_REVIEW' || !!d.pendingReviewOf;
  return d.status !== 'REPAIRED';
}

interface Props {
  userId: string;
  onOpenDefect: (id: string) => void;
  /** Omitted when shown as a bottom-navigation tab. */
  onBack?: () => void;
}

export default function MyReportsScreen({ userId, onOpenDefect, onBack }: Props) {
  const defects = useDefects();
  const [filter, setFilter] = useState<Filter>('ALL');
  const mine = defects
    .filter((d) => d.observations.some((o) => o.reporterId === userId))
    .filter((d) => matches(d, filter))
    .sort((a, b) => Math.max(...b.observations.map((o) => o.timestamp)) - Math.max(...a.observations.map((o) => o.timestamp)));

  return (
    <View style={styles.container}>
      <FlatList
        data={mine}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={12}>
                <Text style={styles.link}>‹ Home</Text>
              </Pressable>
            ) : null}
            <Text style={styles.title}>My Reports</Text>
            <View style={styles.chips}>
              {FILTERS.map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipOn]}>
                  <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No reports yet for this filter.</Text>}
        renderItem={({ item }) => <DefectCard defect={item} viewerId={userId} onPress={() => onOpenDefect(item.id)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  list: { padding: 16, paddingBottom: 32 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: '#0B1F3A', borderColor: '#0B1F3A' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  chipTextOn: { color: '#FFFFFF' },
  empty: { fontSize: 14, color: '#667085' },
});

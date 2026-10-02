import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AdminPriorityTag from '../components/AdminPriorityTag';
import { useDefects } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, type DefectStatus } from '../../api/types';
import { locationContextFor } from '../../services/locationContext';

const STATUS_FILTERS: (DefectStatus | 'ALL' | 'REVIEW')[] = [
  'ALL', 'REVIEW', 'CANDIDATE', 'CORROBORATED', 'VERIFIED', 'SCHEDULED', 'REPAIRED', 'RECURRED',
];

interface Props {
  onOpenDefect: (id: string) => void;
  /** Omitted when shown as a bottom-navigation tab. */
  onBack?: () => void;
}

export default function AdminDefectListScreen({ onOpenDefect, onBack }: Props) {
  const defects = useDefects();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL');

  const q = query.trim().toLowerCase();
  const rows = defects
    .filter((d) => !q || d.id.toLowerCase().includes(q) || DEFECT_TYPE_LABELS[d.defectType].toLowerCase().includes(q))
    .filter((d) => (status === 'ALL' ? true : status === 'REVIEW' ? !!d.pendingReviewOf : d.status === status))
    .sort((a, b) => b.priority - a.priority);

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={12}>
                <Text style={styles.link}>‹ Dashboard</Text>
              </Pressable>
            ) : null}
            <Text style={styles.title}>All Defects</Text>
            <TextInput
              style={styles.search}
              placeholder="Search by ID or type"
              placeholderTextColor="#98A2B3"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
            />
            <View style={styles.chips}>
              {STATUS_FILTERS.map((s) => (
                <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipOn]}>
                  <Text style={[styles.chipText, status === s && { color: '#FFFFFF' }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No defects match these filters.</Text>}
        renderItem={({ item: d }) => (
          <Pressable onPress={() => onOpenDefect(d.id)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.id}>{d.id}</Text>
              <Text style={styles.meta}>
                {DEFECT_TYPE_LABELS[d.defectType]} · Evidence {d.observations.length}
              </Text>
              <Text style={styles.status}>
                {d.status}
                {d.pendingReviewOf ? ` · REVIEW vs ${d.pendingReviewOf}` : ''}
                {d.possibleRecurrenceOf ? ` · POSSIBLE RECURRENCE of ${d.possibleRecurrenceOf}` : ''}
              </Text>
              {locationContextFor(d.latitude, d.longitude).level === 'HIGH' ? (
                <Text style={styles.context}>HIGH ATTENTION CONTEXT (demo facilities)</Text>
              ) : null}
            </View>
            <AdminPriorityTag score={d.priority} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  list: { padding: 16, paddingBottom: 32 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  search: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#101828',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 14, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: '#0B1F3A', borderColor: '#0B1F3A' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#344054' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 12,
  },
  id: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  meta: { fontSize: 13, color: '#475467' },
  status: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  context: { fontSize: 11, fontWeight: '700', color: '#6941C6' },
  empty: { fontSize: 14, color: '#667085' },
});

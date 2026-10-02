import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminPriorityTag from '../components/AdminPriorityTag';
import { priorityTier, useDefects } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, type Defect } from '../../api/types';
import { attentionLevel, useRiskAreas } from '../../services/riskHotspots';
import { locationContextFor } from '../../services/locationContext';

interface Props {
  onAllDefects: () => void;
  onMap: () => void;
  onRisk?: () => void;
  onOpenDefect: (id: string) => void;
  onIdentityDemo: () => void;
  onLogout: () => void;
}

const isHigh = (d: Defect) => ['Critical', 'High'].includes(priorityTier(d.priority));

export default function AdminDashboardScreen({ onAllDefects, onMap, onRisk, onOpenDefect, onIdentityDemo, onLogout }: Props) {
  const defects = useDefects();
  const { hotspots } = useRiskAreas();
  const topHotspot = hotspots[0];
  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will return to the role selection screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ]);
  const open = defects.filter((d) => d.status !== 'REPAIRED');
  const stats = [
    { label: 'Total defects', value: defects.length },
    { label: 'High priority', value: open.filter(isHigh).length },
    { label: 'Under review', value: defects.filter((d) => d.pendingReviewOf).length },
    { label: 'Repaired', value: defects.filter((d) => d.status === 'REPAIRED').length },
  ];
  const queue = [...open].sort((a, b) => b.priority - a.priority).slice(0, 5);
  const totalObs = defects.reduce((n, d) => n + d.observations.length, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>ROADGUARD AI · AUTHORITY</Text>
        <Pressable onPress={confirmLogout} hitSlop={12}>
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.sub}>Demo data — not live government records</Text>

      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.identity}>
        <Text style={styles.identityText}>
          {totalObs} CITIZEN REPORTS → {defects.length} PHYSICAL DEFECTS → {defects.length} DIGITAL DEFECT IDs
        </Text>
      </View>

      {onRisk ? (
        <Pressable onPress={onRisk} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.id}>Risk hotspots: {hotspots.length}</Text>
            <Text style={styles.meta}>
              {topHotspot
                ? `Highest attention ${topHotspot.id} · ${topHotspot.observationCount} reports · ${topHotspot.unresolvedCount} unresolved`
                : 'No area currently meets the hotspot criteria'}
            </Text>
          </View>
          {topHotspot ? (
            <View style={[styles.hsScore, { backgroundColor: attentionLevel(topHotspot.attentionScore).bg }]}>
              <Text style={[styles.hsScoreText, { color: attentionLevel(topHotspot.attentionScore).color }]}>
                {topHotspot.attentionScore}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.rowBetween}>
        <Text style={styles.section}>Priority queue</Text>
        <Pressable onPress={onAllDefects} hitSlop={8}>
          <Text style={styles.link}>All defects ›</Text>
        </Pressable>
      </View>
      {queue.length === 0 ? <Text style={styles.sub}>No open defects.</Text> : null}
      {queue.map((d) => (
        <Pressable key={d.id} onPress={() => onOpenDefect(d.id)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.id}>{d.id}</Text>
            <Text style={styles.meta}>
              {DEFECT_TYPE_LABELS[d.defectType]} · {d.observations.length} evidence · {d.status}
              {d.pendingReviewOf ? ' · REVIEW' : ''}
            </Text>
            {locationContextFor(d.latitude, d.longitude).level === 'HIGH' ? (
              <Text style={styles.context}>HIGH ATTENTION CONTEXT · near a critical facility (demo data)</Text>
            ) : null}
          </View>
          <AdminPriorityTag score={d.priority} />
        </Pressable>
      ))}

      <Pressable onPress={onIdentityDemo} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.secondaryText}>Identity Analysis Engine</Text>
      </Pressable>
      <Pressable onPress={onAllDefects} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.primaryText}>View All Defects</Text>
      </Pressable>
      <Pressable onPress={onMap} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.secondaryText}>Road Defect Map</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 12, fontWeight: '800', color: '#0F766E', letterSpacing: 0.8 },
  link: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#0B1F3A' },
  sub: { fontSize: 12, color: '#667085' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E4E7EC', padding: 14,
  },
  statValue: { fontSize: 30, fontWeight: '800', color: '#0B1F3A' },
  statLabel: { fontSize: 13, color: '#475467' },
  identity: { backgroundColor: '#0B1F3A', borderRadius: 12, padding: 14 },
  identityText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  section: { fontSize: 15, fontWeight: '700', color: '#344054' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 12,
  },
  id: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  meta: { fontSize: 12, color: '#475467' },
  context: { fontSize: 11, fontWeight: '700', color: '#6941C6' },
  hsScore: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  hsScoreText: { fontSize: 18, fontWeight: '800' },
  primary: { backgroundColor: '#0B1F3A', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: '#0B1F3A', paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#0B1F3A', fontSize: 15, fontWeight: '700' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

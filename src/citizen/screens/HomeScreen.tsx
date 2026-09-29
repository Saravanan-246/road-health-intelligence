/**
 * HomeScreen.tsx (Citizen)
 *
 * Welcome + quick stats + recent defects list.
 * Primary CTA: Report Road Problem.
 * Secondary: My Reports.
 */

import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import DefectCard from '../components/DefectCard';
import { PRIORITY_CONFIG } from '../services/devMock/priorityService';
import type { Defect } from '../../api/types';
import type { CitizenSession } from '../types';

interface Props {
  session: CitizenSession;
  defects: Defect[];
  onReport: () => void;
  onOpenDefect: (id: string) => void;
  onMyReports: () => void;
  onLogout: () => void;
}

const lastSeen = (d: Defect) => Math.max(...d.observations.map((o) => o.timestamp));

export default function HomeScreen({ session, defects, onReport, onOpenDefect, onMyReports, onLogout }: Props) {
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
            {/* Top bar */}
            <View style={styles.topBar}>
              <View>
                <Text style={styles.eyebrow}>Road Health Intelligence</Text>
                <Text style={styles.title}>Welcome, {session.displayName.split(' ')[0]}</Text>
              </View>
              <Pressable onPress={onLogout} hitSlop={10}>
                <Text style={styles.logoutText}>Sign out</Text>
              </Pressable>
            </View>

            {/* Stats */}
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

            {/* My Reports shortcut */}
            <Pressable
              style={({ pressed }) => [styles.myReportsBtn, pressed && { opacity: 0.8 }]}
              onPress={onMyReports}
            >
              <Text style={styles.myReportsText}>My Reports</Text>
              <Text style={styles.myReportsChevron}>›</Text>
            </Pressable>

            {defects.length > 0 && (
              <Text style={styles.section}>Recent defects</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No defects recorded yet</Text>
            <Text style={styles.emptyBody}>
              Report a road problem below to create the first defect record.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DefectCard defect={item} onPress={() => onOpenDefect(item.id)} />
        )}
      />

      {/* Footer CTA */}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', color: '#101828', marginTop: 2 },
  logoutText: { fontSize: 13, color: '#667085', paddingTop: 2 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 14 },
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
  myReportsBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  myReportsText: { fontSize: 15, fontWeight: '600', color: '#344054' },
  myReportsChevron: { fontSize: 20, color: '#9AA5B1' },
  section: { fontSize: 15, fontWeight: '600', color: '#344054', marginTop: 4, marginBottom: 4 },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 20,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#344054' },
  emptyBody: { fontSize: 13, color: '#667085', lineHeight: 19 },
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

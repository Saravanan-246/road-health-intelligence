/**
 * MyReportsScreen.tsx
 *
 * Lists all observations submitted by the current citizen.
 * Reads from citizenReportService → GET /observations/my.
 * Handles loading, empty, error, and retry states.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchMyReports } from '../services/citizenReportService';
import { formatCoordinates } from '../utils/distance';
import { DEFECT_TYPE_LABELS, SEVERITY_LABELS, type DuplicateDecision, type PriorityTier } from '../../api/types';
import type { MyReportRow } from '../types';

interface Props {
  onBack: () => void;
  onViewDefect: (defectId: string) => void;
}

const DECISION_BADGE: Record<DuplicateDecision, { label: string; bg: string; fg: string }> = {
  MERGE: { label: 'MERGE', bg: '#E3F4EA', fg: '#18794E' },
  REVIEW: { label: 'REVIEW', bg: '#FEF6D8', fg: '#8A6100' },
  DISTINCT: { label: 'NEW', bg: '#E8EEFD', fg: '#1D4ED8' },
};

const TIER_FG: Record<PriorityTier, string> = {
  Critical: '#B42318',
  High: '#B54708',
  Medium: '#8A6100',
  Low: '#18794E',
};

export default function MyReportsScreen({ onBack, onViewDefect }: Props) {
  const [reports, setReports] = useState<MyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyReports();
      // Newest first
      setReports([...rows].sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <Text style={styles.title}>My Reports</Text>
        <Text style={styles.subtitle}>Observations you have submitted</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading your reports…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.observation_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1D4ED8" />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyBody}>
                Tap "Report Road Problem" on the home screen to submit your first observation.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReportRow
              row={item}
              onPress={() => onViewDefect(item.defect_id)}
            />
          )}
        />
      )}
    </View>
  );
}

function ReportRow({ row, onPress }: { row: MyReportRow; onPress: () => void }) {
  const decision = DECISION_BADGE[row.duplicate_decision];
  const tierFg = TIER_FG[row.priority_tier];
  const date = new Date(row.timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Top row: defect ID + decision badge */}
      <View style={styles.cardRow}>
        <Text style={styles.defectId}>{row.defect_id}</Text>
        <View style={[styles.decisionBadge, { backgroundColor: decision.bg }]}>
          <Text style={[styles.decisionLabel, { color: decision.fg }]}>{decision.label}</Text>
        </View>
      </View>

      {/* Defect type + severity */}
      <Text style={styles.defectType}>
        {DEFECT_TYPE_LABELS[row.defect_type]} · {SEVERITY_LABELS[row.severity]}
      </Text>

      {/* Bottom row: date + priority + status */}
      <View style={styles.cardRow}>
        <Text style={styles.meta}>{date}</Text>
        <Text style={[styles.priority, { color: tierFg }]}>
          {row.priority_score} · {row.priority_tier}
        </Text>
      </View>
      <Text style={styles.coords}>
        {formatCoordinates(row.location.latitude, row.location.longitude)}
      </Text>
      <Text style={styles.status}>{row.status}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  back: { fontSize: 15, fontWeight: '600', color: '#1D4ED8', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#101828' },
  subtitle: { fontSize: 13, color: '#667085' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  loadingText: { fontSize: 14, color: '#667085' },
  errorText: { fontSize: 14, color: '#B42318', textAlign: 'center' },
  retryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  list: { padding: 16, paddingBottom: 32 },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 24,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#101828' },
  emptyBody: { fontSize: 14, color: '#667085', textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 6,
  },
  cardPressed: { opacity: 0.75 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  defectId: { fontSize: 14, fontWeight: '700', color: '#101828', fontVariant: ['tabular-nums'] },
  decisionBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  decisionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  defectType: { fontSize: 15, fontWeight: '600', color: '#344054' },
  meta: { fontSize: 12, color: '#667085' },
  priority: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  coords: { fontSize: 11, color: '#9AA5B1', fontVariant: ['tabular-nums'] },
  status: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#E8EEFD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

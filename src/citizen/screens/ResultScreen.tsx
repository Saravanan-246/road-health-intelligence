/**
 * ResultScreen.tsx
 *
 * Displays the backend analysis result after observation submission.
 *
 * Shows MERGE / REVIEW / DISTINCT, canonical defect info, priority, and status.
 * All values come directly from the backend — NONE are calculated here.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ObservationResult } from '../types';
import {
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type DuplicateDecision,
  type PriorityTier,
} from '../../api/types';
import { formatCoordinates } from '../utils/distance';

interface Props {
  result: ObservationResult;
  onGoHome: () => void;
  onViewDefect: (defectId: string) => void;
}

// ── Decision badge ────────────────────────────────────────────────────────────

const DECISION_CONFIG: Record<DuplicateDecision, { label: string; description: string; bg: string; fg: string }> = {
  MERGE: {
    label: 'MERGE',
    description: 'Your observation matched an existing defect record and has been added as evidence.',
    bg: '#E3F4EA',
    fg: '#18794E',
  },
  REVIEW: {
    label: 'REVIEW',
    description: 'A possible match was found. A reviewer will confirm whether this is a new or existing defect.',
    bg: '#FEF6D8',
    fg: '#8A6100',
  },
  DISTINCT: {
    label: 'DISTINCT',
    description: 'No matching defect was found nearby. A new defect record has been created.',
    bg: '#E8EEFD',
    fg: '#1D4ED8',
  },
};

const TIER_COLORS: Record<PriorityTier, { bg: string; fg: string }> = {
  Critical: { bg: '#FDE7E6', fg: '#B42318' },
  High: { bg: '#FFEDD9', fg: '#B54708' },
  Medium: { bg: '#FEF6D8', fg: '#8A6100' },
  Low: { bg: '#E3F4EA', fg: '#18794E' },
};

export default function ResultScreen({ result, onGoHome, onViewDefect }: Props) {
  const decision = DECISION_CONFIG[result.duplicate_decision];
  const tierColors = TIER_COLORS[result.priority_tier];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.eyebrow}>Observation Submitted</Text>
      <Text style={styles.title}>Analysis Complete</Text>
      <Text style={styles.obsId}>Observation {result.observation_id}</Text>

      {/* Decision card */}
      <View style={[styles.decisionCard, { backgroundColor: decision.bg, borderColor: decision.fg + '40' }]}>
        <Text style={[styles.decisionLabel, { color: decision.fg }]}>{decision.label}</Text>
        <Text style={[styles.decisionDesc, { color: decision.fg }]}>{decision.description}</Text>
      </View>

      {/* Canonical defect card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Canonical Defect Record</Text>
        <Text style={styles.defectId}>{result.defect_id}</Text>
        <Text style={styles.defectType}>{DEFECT_TYPE_LABELS[result.defect_type]}</Text>

        <View style={styles.row}>
          <InfoItem label="Severity" value={SEVERITY_LABELS[result.severity]} />
          <InfoItem label="Evidence" value={`${result.evidence_count} observation${result.evidence_count === 1 ? '' : 's'}`} />
        </View>

        <View style={styles.row}>
          <InfoItem label="Status" value={result.status} />
          <View style={[styles.priorityBadge, { backgroundColor: tierColors.bg }]}>
            <Text style={[styles.priorityScore, { color: tierColors.fg }]}>{result.priority_score}</Text>
            <Text style={[styles.priorityTier, { color: tierColors.fg }]}>{result.priority_tier}</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.locationLabel}>Location</Text>
        <Text style={styles.locationValue}>
          {formatCoordinates(result.location.latitude, result.location.longitude)}
        </Text>
      </View>

      {/* What this means */}
      <View style={styles.explainer}>
        <Text style={styles.explainerTitle}>One real-world defect · one record</Text>
        <Text style={styles.explainerBody}>
          Each defect on the road has a single canonical record (like {result.defect_id}).
          Multiple citizen observations become evidence for that one record — strengthening the priority score.
        </Text>
      </View>

      {/* Actions */}
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
        onPress={() => onViewDefect(result.defect_id)}
      >
        <Text style={styles.primaryButtonText}>View Defect Record</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
        onPress={onGoHome}
      >
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '700', color: '#101828', marginTop: 2 },
  obsId: { fontSize: 12, color: '#667085', fontVariant: ['tabular-nums'] },

  decisionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  decisionLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  decisionDesc: { fontSize: 14, lineHeight: 20 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 16,
    gap: 10,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#667085', letterSpacing: 0.5 },
  defectId: { fontSize: 22, fontWeight: '700', color: '#101828', fontVariant: ['tabular-nums'] },
  defectType: { fontSize: 16, color: '#344054' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#667085' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#101828', marginTop: 2 },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priorityScore: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priorityTier: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#E4E7EC' },
  locationLabel: { fontSize: 12, fontWeight: '600', color: '#667085' },
  locationValue: { fontSize: 13, color: '#101828', fontVariant: ['tabular-nums'] },

  explainer: {
    backgroundColor: '#F0F5FF',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  explainerTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  explainerBody: { fontSize: 13, color: '#344054', lineHeight: 19 },

  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#344054', fontSize: 15, fontWeight: '600' },
});

import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PriorityBadge from '../components/PriorityBadge';
import { formatCoordinates } from '../utils/distance';
import {
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type Defect,
  type PriorityBreakdown,
} from '../../api/types';

interface Props {
  defect: Defect;
  onBack: () => void;
}

const FACTOR_LABELS: Record<keyof PriorityBreakdown, string> = {
  severity: 'Severity',
  confidence: 'Confidence',
  observationSupport: 'Observation support',
  recency: 'Recency',
  roadContext: 'Road context',
};

export default function DefectScreen({ defect, onBack }: Props) {
  const count = defect.observations.length;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Home</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.id}>{defect.id}</Text>
        <Text style={styles.title}>{DEFECT_TYPE_LABELS[defect.defectType]}</Text>
        <View style={styles.row}>
          <Text style={styles.status}>{defect.status}</Text>
          <Text style={styles.muted}>
            {count} observation{count === 1 ? '' : 's'} · one defect record
          </Text>
        </View>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>{formatCoordinates(defect.latitude, defect.longitude)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.section}>Maintenance priority</Text>
          <PriorityBadge score={defect.priority} size="large" />
        </View>
        {(Object.keys(FACTOR_LABELS) as (keyof PriorityBreakdown)[]).map((key) => {
          const f = defect.priorityBreakdown[key];
          return (
            <View key={key} style={styles.factor}>
              <View style={styles.row}>
                <Text style={styles.factorName}>
                  {FACTOR_LABELS[key]} <Text style={styles.muted}>× {f.weight}</Text>
                </Text>
                <Text style={styles.factorPoints}>+{f.points.toFixed(1)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${f.value * 100}%` }]} />
              </View>
              <Text style={styles.note}>
                value {f.value.toFixed(2)} · {f.note}
              </Text>
            </View>
          );
        })}
        <Text style={styles.note}>
          Deterministic formula with configurable engineering weights. Computed{' '}
          {new Date(defect.priorityComputedAt).toLocaleString()}.
        </Text>
      </View>

      <Text style={styles.section}>Observation evidence ({count})</Text>
      {defect.observations.map((o, i) => (
        <View key={o.id} style={[styles.card, styles.obs]}>
          <Image source={{ uri: o.imageUri }} style={styles.thumb} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.obsTitle}>
              #{i + 1} · {DEFECT_TYPE_LABELS[o.defectType]} · {SEVERITY_LABELS[o.severity]}
            </Text>
            <Text style={styles.muted}>{new Date(o.timestamp).toLocaleString()}</Text>
            <Text style={styles.muted}>
              {formatCoordinates(o.latitude, o.longitude)} · {o.locationSource}
              {o.accuracyMeters !== null ? ` ±${o.accuracyMeters.toFixed(0)} m` : ''}
            </Text>
            <Text style={styles.muted}>
              Classified by {o.classificationSource}
              {o.confidence !== null ? ` · ${(o.confidence * 100).toFixed(0)}%` : ''}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 8,
  },
  id: { fontSize: 12, fontWeight: '600', color: '#667085', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '700', color: '#101828' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#E8EEFD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#475467', marginTop: 4 },
  value: { fontSize: 15, color: '#101828', fontVariant: ['tabular-nums'] },
  section: { fontSize: 15, fontWeight: '600', color: '#344054' },
  muted: { fontSize: 13, color: '#667085' },
  factor: { gap: 4, paddingTop: 6 },
  factorName: { fontSize: 14, fontWeight: '600', color: '#101828' },
  factorPoints: { fontSize: 14, fontWeight: '600', color: '#101828', fontVariant: ['tabular-nums'] },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#1D4ED8' },
  note: { fontSize: 12, color: '#667085' },
  obs: { flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#EEF0F3' },
  obsTitle: { fontSize: 14, fontWeight: '600', color: '#101828' },
});

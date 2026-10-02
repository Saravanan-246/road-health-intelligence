import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminPriorityTag from '../components/AdminPriorityTag';
import { useDefects } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, SEVERITY_LABELS, type RiskHotspot } from '../../api/types';
import { formatCoordinates } from '../../citizen/utils/distance';
import { ATTENTION_FACTOR_LABELS, attentionLevel } from '../../services/riskHotspots';
import { CONTEXT_LABELS, locationContextFor } from '../../services/locationContext';
import { DEMO_FACILITIES_NOTICE } from '../../data/demoFacilities';

interface Props {
  hotspot: RiskHotspot;
  onBack: () => void;
  onOpenDefect: (id: string) => void;
  onShowOnMap: () => void;
}

export default function HotspotDetailScreen({ hotspot: h, onBack, onOpenDefect, onShowOnMap }: Props) {
  const defects = useDefects();
  const related = defects.filter((d) => h.defectIds.includes(d.id)).sort((a, b) => b.priority - a.priority);
  const level = attentionLevel(h.attentionScore);
  const ctx = locationContextFor(h.latitude, h.longitude);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: level.color }]}>
        <Text style={styles.label}>RISK HOTSPOT</Text>
        <Text style={styles.bigId}>{h.id}</Text>
        <Text style={styles.meta}>
          Approximate centre {formatCoordinates(h.latitude, h.longitude)} · area radius ±{Math.round(h.radiusMeters)} m
        </Text>
        <View style={[styles.scoreBox, { backgroundColor: level.bg }]}>
          <Text style={[styles.scoreValue, { color: level.color }]}>{h.attentionScore}</Text>
          <View>
            <Text style={[styles.scoreLabel, { color: level.color }]}>Attention score</Text>
            <Text style={[styles.scoreLevel, { color: level.color }]}>{level.label}</Text>
          </View>
        </View>
        <Text style={styles.note}>Observed concentration requiring attention — not a prediction.</Text>
      </View>

      <View style={styles.grid}>
        <Fact label="Observed defects" value={String(h.defectCount)} />
        <Fact label="Reports (evidence)" value={String(h.observationCount)} />
        <Fact label="Highest severity" value={SEVERITY_LABELS[h.highestSeverity]} />
        <Fact label="Dominant type" value={DEFECT_TYPE_LABELS[h.dominantType]} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Maintenance state</Text>
        <Text style={styles.meta}>
          {h.unresolvedCount} unresolved · {h.repairedCount} repaired · {h.pendingReviewCount} pending duplicate review
          {h.recurredCount ? ` · ${h.recurredCount} recurred` : ''}
        </Text>
        <Text style={styles.meta}>Last report {new Date(h.lastObservedAt).toLocaleString()}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Why this is a hotspot</Text>
        {h.explanation.map((e) => (
          <Text key={e} style={styles.bullet}>• {e}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Location context</Text>
        <Text style={styles.meta}>{CONTEXT_LABELS[ctx.level]}</Text>
        {ctx.nearby.map((n) => (
          <Text key={n.facility.id} style={styles.bullet}>
            • {n.facility.name} · ~{Math.round(n.distanceM)} m ({n.rule})
          </Text>
        ))}
        <Text style={styles.note}>
          Shown for context only; it does not change the attention score. {DEMO_FACILITIES_NOTICE}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Attention score breakdown</Text>
        {(Object.keys(h.factors) as (keyof RiskHotspot['factors'])[]).map((k) => {
          const f = h.factors[k];
          return (
            <View key={k} style={styles.factor}>
              <View style={styles.rowBetween}>
                <Text style={styles.factorName}>{ATTENTION_FACTOR_LABELS[k]} × {f.weight}</Text>
                <Text style={styles.factorName}>+{f.points.toFixed(1)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${f.value * 100}%`, backgroundColor: level.color }]} /></View>
              <Text style={styles.note}>{f.note}</Text>
            </View>
          );
        })}
        <Text style={styles.note}>Priority values come from the existing defect priority formula.</Text>
      </View>

      <Text style={styles.section}>Related defects ({related.length})</Text>
      {related.map((d) => (
        <Pressable key={d.id} onPress={() => onOpenDefect(d.id)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowId}>{d.id}</Text>
            <Text style={styles.meta}>
              {DEFECT_TYPE_LABELS[d.defectType]} · {d.observations.length} evidence · {d.status}
              {d.pendingReviewOf ? ' · REVIEW' : ''}
            </Text>
          </View>
          <AdminPriorityTag score={d.priority} />
        </Pressable>
      ))}

      <Pressable onPress={onShowOnMap} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.primaryText}>Show on hotspot map</Text>
      </Pressable>
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 6 },
  label: { fontSize: 11, fontWeight: '800', color: '#7A2E0E', letterSpacing: 0.8 },
  bigId: { fontSize: 26, fontWeight: '800', color: '#0B1F3A' },
  meta: { fontSize: 13, color: '#475467' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 12, marginTop: 4 },
  scoreValue: { fontSize: 34, fontWeight: '800' },
  scoreLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  scoreLevel: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, color: '#667085' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 12 },
  factValue: { fontSize: 20, fontWeight: '800', color: '#0B1F3A' },
  factLabel: { fontSize: 12, color: '#475467' },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  bullet: { fontSize: 13, color: '#475467', lineHeight: 19 },
  factor: { gap: 3, paddingTop: 4 },
  factorName: { fontSize: 13, fontWeight: '600', color: '#101828' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  fill: { height: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 12,
  },
  rowId: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  primary: { backgroundColor: '#0B1F3A', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

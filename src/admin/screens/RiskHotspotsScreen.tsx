import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFECT_TYPE_LABELS, SEVERITY_LABELS } from '../../api/types';
import { formatCoordinates } from '../../citizen/utils/distance';
import { HOTSPOT_CONFIG, attentionLevel, useRiskAreas } from '../../services/riskHotspots';

interface Props {
  onOpenHotspot: (id: string) => void;
  onOpenDefect: (id: string) => void;
  onShowOnMap: () => void;
}

export default function RiskHotspotsScreen({ onOpenHotspot, onOpenDefect, onShowOnMap }: Props) {
  const { hotspots, monitored } = useRiskAreas();
  const reports = hotspots.reduce((n, h) => n + h.observationCount, 0);
  const open = hotspots.reduce((n, h) => n + h.unresolvedCount, 0);
  const w = HOTSPOT_CONFIG.weights;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ROADGUARD AI · AUTHORITY</Text>
      <Text style={styles.title}>Risk Hotspots</Text>
      <Text style={styles.sub}>Observed concentration requiring attention</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>What a hotspot is</Text>
        <Text style={styles.noticeText}>
          A road area where defect evidence has already accumulated — repeated reports, severe defects or unresolved
          maintenance. It is derived from recorded observations only and does not predict where defects will form.
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat value={hotspots.length} label="Hotspots" />
        <Stat value={reports} label="Reports inside" />
        <Stat value={open} label="Open defects inside" />
      </View>

      <Pressable onPress={onShowOnMap} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.secondaryText}>View on hotspot map</Text>
      </Pressable>

      {hotspots.length === 0 ? (
        <Text style={styles.sub}>No area currently meets the hotspot criteria.</Text>
      ) : null}

      {hotspots.map((h) => {
        const level = attentionLevel(h.attentionScore);
        return (
          <Pressable
            key={h.id}
            onPress={() => onOpenHotspot(h.id)}
            style={({ pressed }) => [styles.card, { borderLeftColor: level.color }, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>RISK HOTSPOT</Text>
                <Text style={styles.id}>{h.id}</Text>
                <Text style={styles.meta}>
                  Approx. {formatCoordinates(h.latitude, h.longitude)} · ±{Math.round(h.radiusMeters)} m
                </Text>
              </View>
              <View style={[styles.score, { backgroundColor: level.bg }]}>
                <Text style={[styles.scoreValue, { color: level.color }]}>{h.attentionScore}</Text>
                <Text style={[styles.scoreLabel, { color: level.color }]}>Attention</Text>
              </View>
            </View>
            <View style={styles.facts}>
              <Fact label="Observed defects" value={String(h.defectCount)} />
              <Fact label="Reports" value={String(h.observationCount)} />
              <Fact label="Highest severity" value={SEVERITY_LABELS[h.highestSeverity]} />
              <Fact label="Status" value={`${h.unresolvedCount} unresolved`} />
            </View>
            <Text style={styles.meta}>Dominant type: {DEFECT_TYPE_LABELS[h.dominantType]}</Text>
            <Text style={styles.why}>WHY</Text>
            {h.explanation.slice(0, 4).map((e) => (
              <Text key={e} style={styles.bullet}>• {e}</Text>
            ))}
            <Text style={styles.link}>View hotspot ›</Text>
          </Pressable>
        );
      })}

      {monitored.length ? (
        <View style={styles.block}>
          <Text style={styles.section}>Below hotspot threshold ({monitored.length})</Text>
          {monitored.map((m) => (
            <View key={m.key} style={styles.monitored}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.monitoredIds}>
                  {m.defectIds.map((id, i) => (
                    <Text key={id}>
                      {i ? ', ' : ''}
                      <Text style={styles.linkInline} onPress={() => onOpenDefect(id)}>{id}</Text>
                    </Text>
                  ))}
                </Text>
                <Text style={styles.meta}>{m.reason}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.section}>Method</Text>
        <Text style={styles.method}>
          Defect records within {HOTSPOT_CONFIG.linkDistanceMeters} m of each other are grouped into one area. An area
          becomes a hotspot when it holds at least {HOTSPOT_CONFIG.minObservations} reports and at least one unresolved
          defect.
        </Text>
        <Text style={styles.method}>
          Attention score (0–100) = highest open-defect priority × {w.priority} + report volume × {w.evidence} + confirmed
          defect records × {w.multiplicity} + unresolved share × {w.unresolved} + recurrence × {w.recurrence}.
        </Text>
        <Text style={styles.note}>Configurable engineering weights — not a statistical or predictive model.</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  eyebrow: { fontSize: 12, fontWeight: '800', color: '#0F766E', letterSpacing: 0.8 },
  title: { fontSize: 28, fontWeight: '700', color: '#0B1F3A' },
  sub: { fontSize: 13, color: '#667085' },
  notice: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 4 },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#0B1F3A' },
  noticeText: { fontSize: 13, color: '#475467', lineHeight: 19 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 12 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0B1F3A' },
  statLabel: { fontSize: 12, color: '#475467' },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: '#0B1F3A', paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: '#0B1F3A', fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', borderLeftWidth: 4,
    padding: 14, gap: 8,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  label: { fontSize: 11, fontWeight: '800', color: '#7A2E0E', letterSpacing: 0.8 },
  id: { fontSize: 22, fontWeight: '800', color: '#0B1F3A' },
  meta: { fontSize: 12, color: '#475467' },
  score: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  scoreValue: { fontSize: 26, fontWeight: '800' },
  scoreLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8 },
  factValue: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  factLabel: { fontSize: 11, color: '#667085' },
  why: { fontSize: 11, fontWeight: '800', color: '#344054', letterSpacing: 0.6, marginTop: 2 },
  bullet: { fontSize: 13, color: '#475467', lineHeight: 18 },
  link: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  linkInline: { color: '#1D4ED8', fontWeight: '700' },
  block: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  monitored: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  monitoredIds: { fontSize: 14, color: '#0B1F3A' },
  method: { fontSize: 13, color: '#475467', lineHeight: 19 },
  note: { fontSize: 12, color: '#667085', fontStyle: 'italic' },
});

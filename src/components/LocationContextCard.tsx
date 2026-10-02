import { StyleSheet, Text, View } from 'react-native';
import type { Defect, PriorityTier } from '../api/types';
import { DEMO_FACILITIES_NOTICE } from '../data/demoFacilities';
import { CONTEXT_LABELS, FACILITY_RULES, attentionContext, type ContextLevel } from '../services/locationContext';

const TIER_COLORS: Record<PriorityTier, [string, string]> = {
  Critical: ['#FDE7E6', '#B42318'],
  High: ['#FFEDD9', '#B54708'],
  Medium: ['#FEF6D8', '#8A6100'],
  Low: ['#E3F4EA', '#18794E'],
};

const LEVEL_COLORS: Record<ContextLevel, [string, string]> = {
  HIGH: ['#F4EBFF', '#6941C6'],
  ELEVATED: ['#EEF4FF', '#3538CD'],
  NORMAL: ['#F2F4F7', '#475467'],
};

/** Physical defect priority and location importance, shown side by side and never blended. */
export default function LocationContextCard({ defect, compact }: { defect: Defect; compact?: boolean }) {
  const a = attentionContext(defect);
  const [pBg, pFg] = TIER_COLORS[a.physicalTier];
  const [cBg, cFg] = LEVEL_COLORS[a.context.level];
  const [tBg, tFg] = TIER_COLORS[a.attentionTier];

  return (
    <View style={styles.card}>
      <Text style={styles.section}>Location context</Text>
      <View style={styles.row}>
        <View style={[styles.box, { backgroundColor: pBg }]}>
          <Text style={[styles.boxLabel, { color: pFg }]}>PHYSICAL DEFECT PRIORITY</Text>
          <Text style={[styles.boxValue, { color: pFg }]}>{a.physicalScore} · {a.physicalTier}</Text>
          <Text style={[styles.boxNote, { color: pFg }]}>Severity, evidence, recency</Text>
        </View>
        <View style={[styles.box, { backgroundColor: cBg }]}>
          <Text style={[styles.boxLabel, { color: cFg }]}>LOCATION IMPORTANCE</Text>
          <Text style={[styles.boxValue, { color: cFg, fontSize: 13 }]}>{CONTEXT_LABELS[a.context.level]}</Text>
          <Text style={[styles.boxNote, { color: cFg }]}>Nearby critical facilities</Text>
        </View>
      </View>
      <View style={[styles.attention, { backgroundColor: tBg }]}>
        <Text style={[styles.attentionLabel, { color: tFg }]}>Attention: {a.attentionTier}{a.raised ? ' (raised one tier by location)' : ''}</Text>
      </View>
      <Text style={styles.text}>{a.explanation}</Text>

      {!compact && a.context.nearby.length ? (
        <View style={{ gap: 4 }}>
          {a.context.nearby.map((n) => (
            <View key={n.facility.id} style={styles.facility}>
              <View style={styles.code}>
                <Text style={styles.codeText}>{FACILITY_RULES[n.facility.category].code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.facilityName}>{n.facility.name}</Text>
                <Text style={styles.note}>
                  ~{Math.round(n.distanceM)} m straight-line · {n.level === 'HIGH' ? 'HIGH' : 'ELEVATED'} ({n.rule})
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.note}>
        Location context never changes the physical priority score. It can raise attention by at most one tier, only for
        unresolved defects. {a.context.demoData ? DEMO_FACILITIES_NOTICE : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
  boxLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  boxValue: { fontSize: 16, fontWeight: '800' },
  boxNote: { fontSize: 11 },
  attention: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  attentionLabel: { fontSize: 13, fontWeight: '800' },
  text: { fontSize: 13, color: '#344054', lineHeight: 18 },
  facility: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  code: { minWidth: 26, height: 22, borderRadius: 4, backgroundColor: '#344054', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  codeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  facilityName: { fontSize: 13, fontWeight: '600', color: '#101828' },
  note: { fontSize: 11, color: '#667085', lineHeight: 16 },
});

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PriorityBadge from '../components/PriorityBadge';
import { Collapsible, DecisionChip, ObservationIdentity, SamePlaceNote } from '../../components/IdentityPanels';
import { useDefects, type SubmitResult } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, SEVERITY_LABELS, type DuplicateDecision } from '../../api/types';
import { formatCoordinates } from '../utils/distance';

interface Props {
  result: SubmitResult;
  onOpenDefect: (id: string) => void;
  onMyReports: () => void;
  onHome: () => void;
}

const FACTOR_LABELS: Record<string, string> = {
  severity: 'Severity',
  confidence: 'Detection confidence',
  observationSupport: 'Observation support',
  recency: 'Recency',
  roadContext: 'Road context',
};

const DECISION_TEXT: Record<DuplicateDecision, { title: string; body: string; color: string; bg: string }> = {
  MERGE: {
    title: 'MERGE',
    body: 'This observation corroborates an existing defect record and was added as evidence.',
    color: '#067647',
    bg: '#E3F4EA',
  },
  REVIEW: {
    title: 'REVIEW',
    body: 'A possible match was found but evidence is inconclusive. A review is required.',
    color: '#8A6100',
    bg: '#FEF6D8',
  },
  DISTINCT: {
    title: 'DISTINCT',
    body: 'This report was judged to show a different physical defect from existing records. A new defect record was created.',
    color: '#1D4ED8',
    bg: '#E8EEFD',
  },
};

export default function ReportResultScreen({ result, onOpenDefect, onMyReports, onHome }: Props) {
  const defects = useDefects();
  // Read the live record so later merges/status changes are reflected.
  const defect = defects.find((d) => d.id === result.defect.id) ?? result.defect;
  const obs = result.observation;
  const d = DECISION_TEXT[result.decision];
  const n = defect.observations.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>REPORT SUBMITTED · LOCAL DEMO STORE</Text>
      <Text style={styles.title}>Road Analysis</Text>

      <View style={styles.card}>
        <Text style={styles.section}>1 · Analysis</Text>
        <Row label="Defect type" value={DEFECT_TYPE_LABELS[obs.defectType]} />
        <Row label="Severity" value={SEVERITY_LABELS[obs.severity]} />
        <Row
          label="Detection confidence"
          value={obs.confidence !== null ? `${Math.round(obs.confidence * 100)}% (model confidence, not accuracy)` : 'Not available'}
        />
        <Row label="Classified by" value={obs.classificationSource === 'MODEL' ? 'Detector model' : 'Reporter (detector not connected)'} />
        <Row
          label="Location"
          value={`${formatCoordinates(obs.latitude, obs.longitude)} · ${obs.testLocation ? 'DEMO TEST LOCATION (not GPS)' : obs.locationSource}`}
        />
        <Row label="Motion evidence" value="Unavailable (not captured)" />
      </View>

      <View style={[styles.card, { borderColor: d.bg, borderWidth: 2 }]}>
        <Text style={styles.section}>2 · Duplicate analysis</Text>
        <DecisionChip decision={result.decision} large />
        <Text style={styles.body}>{d.body}</Text>
        {result.matchedDefectId && result.analysis ? (
          <Text style={styles.muted}>
            Compared with {result.matchedDefectId} · {result.analysis.distanceMeters.toFixed(1)} m from its location
          </Text>
        ) : null}
        <ObservationIdentity observation={obs} defects={defects} audience="citizen" initiallyOpen />
        <Collapsible title="How RoadGuard decides whether reports are the same defect">
          <SamePlaceNote />
        </Collapsible>
        {obs.duplicateAnalysis ? (
          <Collapsible title="Engine trace">
            {obs.duplicateAnalysis.reasons.map((r) => (
              <Text key={r} style={styles.reason}>• {r}</Text>
            ))}
          </Collapsible>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>3 · Digital Defect Identity</Text>
        <View style={styles.flow}>
          <Text style={styles.flowBig}>{n} REPORT{n === 1 ? '' : 'S'}</Text>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.flowBig}>1 PHYSICAL DEFECT</Text>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.defectId}>{defect.id}</Text>
        </View>
        <Row label="Evidence" value={`${n} observation${n === 1 ? '' : 's'}`} />
        <Row label="Status" value={defect.pendingReviewOf ? `${defect.status} · under review vs ${defect.pendingReviewOf}` : defect.status} />
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.section}>4 · Maintenance priority</Text>
          <PriorityBadge score={defect.priority} size="large" />
        </View>
        {Object.entries(defect.priorityBreakdown).map(([k, f]) => (
          <Row key={k} label={FACTOR_LABELS[k] ?? k} value={`+${f.points.toFixed(1)} · ${f.note}`} />
        ))}
        <Text style={styles.muted}>Deterministic engineering formula, computed by the service layer.</Text>
      </View>

      <Btn label={`Open ${defect.id}`} onPress={() => onOpenDefect(defect.id)} primary />
      <Btn label="My Reports" onPress={onMyReports} />
      <Btn label="Home" onPress={onHome} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.btnText, primary && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: '#0F766E', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 6 },
  section: { fontSize: 13, fontWeight: '700', color: '#475467', textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { fontSize: 14, color: '#101828' },
  muted: { fontSize: 12, color: '#475467' },
  reason: { fontSize: 12, color: '#344054' },
  flow: { alignItems: 'center', paddingVertical: 8 },
  flowBig: { fontSize: 16, fontWeight: '700', color: '#0B1F3A' },
  arrow: { fontSize: 18, color: '#0F766E' },
  defectId: { fontSize: 22, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  rowLabel: { width: 130, fontSize: 13, color: '#667085' },
  rowValue: { flex: 1, fontSize: 13, color: '#101828', fontWeight: '500' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  btnText: { fontSize: 15, fontWeight: '600', color: '#344054' },
});

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { findObservation } from '../api/mockBackend';
import type { Defect, DuplicateDecision, Observation, RoadFrame } from '../api/types';
import {
  DECISION_META,
  compareObservations,
  describeExistingEvidence,
  engineLabel,
  explainDuplicateAnalysis,
  explainObservationIdentity,
  formatDuration,
  type DecisionExplanation,
  type FactorTone,
  type PairEvidence,
} from '../services/identityExplanation';

const TONE_COLOR: Record<FactorTone, string> = {
  support: '#067647',
  against: '#B42318',
  caution: '#B54708',
  neutral: '#98A2B3',
};

export function DecisionChip({ decision, large }: { decision: DuplicateDecision; large?: boolean }) {
  const meta = DECISION_META[decision];
  return (
    <View style={[styles.chip, { backgroundColor: meta.bg }, large && styles.chipLarge]}>
      <Text style={[styles.chipDecision, { color: meta.color }, large && { fontSize: 18 }]}>{decision}</Text>
      <Text style={[styles.chipMeaning, { color: meta.color }]}>{meta.meaning}</Text>
    </View>
  );
}

export function Collapsible({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.collapsible}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.collapsibleHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
      >
        <Text style={styles.collapsibleTitle}>{title}</Text>
        <Text style={styles.collapsibleToggle}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

/** "Why merged / Why kept separate / Why pending review" with the engine's contributing factors. */
export function ExplanationView({ explanation, showNotUsed = true }: { explanation: DecisionExplanation; showNotUsed?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {explanation.sameArea ? <SameAreaCallout text={explanation.sameArea.text} /> : null}
      <Text style={styles.heading}>{explanation.heading}</Text>
      <Text style={styles.summary}>{explanation.summary}</Text>
      {explanation.factors.map((f, i) => (
        <View key={`${f.label}-${i}`} style={styles.factor}>
          <View style={[styles.toneBar, { backgroundColor: TONE_COLOR[f.tone] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.factorLabel}>{f.label}</Text>
            <Text style={styles.factorText}>{f.text}</Text>
          </View>
        </View>
      ))}
      {showNotUsed && explanation.notUsed.length ? (
        <View style={styles.notUsed}>
          {explanation.notUsed.map((n) => (
            <Text key={n} style={styles.notUsedText}>{n}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Nearby reports that were deliberately not merged. */
export function SameAreaCallout({ text }: { text: string }) {
  return (
    <View style={styles.sameArea}>
      <Text style={styles.sameAreaTitle}>SAME AREA ≠ SAME DEFECT</Text>
      <Text style={styles.sameAreaText}>{text}</Text>
    </View>
  );
}

const fmtPhotoTime = (o: Observation) =>
  o.imageCapturedAt
    ? `${new Date(o.imageCapturedAt).toLocaleString()} (photo metadata)`
    : o.imageUri
      ? 'not in photo metadata'
      : 'n/a (no image)';

const fmtAcc = (o: Observation) =>
  o.testLocation ? 'demo test point' : o.accuracyMeters !== null ? `±${o.accuracyMeters.toFixed(0)} m` : `unknown (${o.locationSource.toLowerCase()})`;

const fmtSide = (rf: RoadFrame) =>
  rf.side === null
    ? 'n/a'
    : `${rf.side} (${rf.lateral_offset_m?.toFixed(1) ?? '?'} m${(rf.lateral_offset_m ?? 99) <= 2 ? ', near centerline' : ''})`;

const fmtWay = (rf: RoadFrame) => (rf.snap_confidence === 'NONE' ? 'off-network' : `${rf.way_id} ${rf.way_name ?? ''}`.trim());

/**
 * Pairwise evidence grouped by channel. Covers geographic distance, GPS uncertainty,
 * road-frame projection, way, chainage, side, longitudinal and lateral separation,
 * temporal context and existing identity evidence.
 */
export function EvidencePanel({
  pair,
  decision,
  engineLabel,
  existingEvidence,
  labels = ['This report', 'Compared report'],
  bImageWithheld,
}: {
  pair: PairEvidence;
  decision: DuplicateDecision;
  engineLabel: string;
  existingEvidence: string;
  labels?: [string, string];
  /** Citizens do not see other citizens' photos; state that one exists without showing it. */
  bImageWithheld?: boolean;
}) {
  const { a, b, rfA, rfB } = pair;
  const two = (x: string, y: string) => `A: ${x}\nB: ${y}`;
  const imageB = b.imageUri ? (bImageWithheld ? 'attached (held for authority verification)' : 'attached') : 'none';
  return (
    <View style={styles.panel}>
      <Text style={styles.panelKey}>A = {labels[0]} · B = {labels[1]}</Text>

      <Group title="Location evidence">
        <Row label="GPS distance" value={`${pair.distanceM.toFixed(1)} m`} />
        <Row label="GPS accuracy" value={two(fmtAcc(a), fmtAcc(b))} />
      </Group>

      <Group title="Road evidence">
        <Row label="Projection" value={two(rfA.snap_confidence === 'NONE' ? 'no road within 50 m' : `${rfA.snap_confidence} confidence`, rfB.snap_confidence === 'NONE' ? 'no road within 50 m' : `${rfB.snap_confidence} confidence`)} />
        <Row label="Way ID" value={two(fmtWay(rfA), fmtWay(rfB))} />
        <Row label="Chainage" value={two(rfA.chainage_m !== null ? `${rfA.chainage_m.toFixed(1)} m` : 'n/a', rfB.chainage_m !== null ? `${rfB.chainage_m.toFixed(1)} m` : 'n/a')} />
        <Row label="Side" value={two(fmtSide(rfA), fmtSide(rfB))} />
        <Row
          label="Longitudinal sep."
          value={pair.chainageDeltaM !== null ? `${pair.chainageDeltaM.toFixed(1)} m along the road` : 'n/a (not on the same road)'}
        />
        <Row label="Lateral sep." value={pair.lateralDeltaM !== null ? `${pair.lateralDeltaM.toFixed(1)} m across the road` : 'n/a'} />
        <Row label="Road-frame fit" value={`${pair.compatibility.label} — ${pair.compatibility.text}`} />
      </Group>

      <Group title="Temporal evidence">
        <Row label="Report time" value={two(new Date(a.timestamp).toLocaleString(), new Date(b.timestamp).toLocaleString())} />
        <Row label="Photo time" value={two(fmtPhotoTime(a), fmtPhotoTime(b))} />
        <Row label="Time difference" value={`${formatDuration(pair.timeDeltaMs)} between reports`} />
      </Group>

      <Group title="Image evidence">
        <Row label="Image attached" value={two(a.imageUri ? 'attached' : 'none (staged record)', b.imageUri ? imageB : 'none (staged record)')} />
        <Row label="Use" value="Available for human verification. Not compared automatically — no image-comparison model is connected." />
      </Group>

      <Group title="Identity decision">
        <Row label="Existing evidence" value={existingEvidence} />
        <View style={{ gap: 4 }}>
          <DecisionChip decision={decision} />
          <Text style={styles.engine}>{engineLabel}</Text>
        </View>
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
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

/** Why identical coordinates do not mean the same defect, and different ones do not rule it out. */
export function SamePlaceNote() {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.factorText}>
        Coordinates alone do not decide identity. On mapped roads each report is projected onto the road and compared on
        the road it lies on, the side of the centreline, its position along the road, the GPS uncertainty of both fixes
        and how far apart in time they were; a defect-type conflict blocks an automatic merge. Off the mapped roads, a
        distance check that allows for GPS uncertainty is used instead.
      </Text>
      <Text style={styles.factorText}>
        <Text style={styles.factorLabel}>Nearly identical coordinates, different defects: </Text>
        two potholes on opposite carriageways can be a few metres apart; the road frame keeps them separate.
      </Text>
      <Text style={styles.factorText}>
        <Text style={styles.factorLabel}>Different coordinates, same defect: </Text>
        phone GPS can drift by tens of metres, so reports far apart on the map can still project to the same point on
        the same road.
      </Text>
      <Text style={styles.factorText}>
        When the evidence cannot separate these cases safely, the report is held for authority review instead of being
        merged or split automatically.
      </Text>
    </View>
  );
}

/**
 * Full explanation of one observation's recorded identity decision: the reasons from the
 * live pipeline, the evidence pair, and (for authorities) road-frame decision support.
 */
export function ObservationIdentity({
  observation,
  defects,
  audience,
  initiallyOpen = false,
}: {
  observation: Observation;
  defects: Defect[];
  audience: 'citizen' | 'admin';
  initiallyOpen?: boolean;
}) {
  const recorded = observation.duplicateDecision ?? 'DISTINCT';
  const compared = observation.comparedObservationId ? findObservation(observation.comparedObservationId) : null;
  const explanation = explainObservationIdentity(observation, compared?.observation ?? null);
  const pair: PairEvidence | null = compared ? compareObservations(observation, compared.observation) : null;
  const comparedDefect = defects.find((d) => d.id === observation.comparedDefectId);
  const identity = observation.identity;
  const radius = observation.duplicateAnalysis;
  // The legacy engine's view of the same candidate, for authorities comparing the two.
  const radiusView =
    audience === 'admin' && identity?.engine === 'roadframe-v1' && radius
      ? explainDuplicateAnalysis(radius.decision, radius, observation.comparedDefectId)
      : null;

  return (
    <View style={{ gap: 10 }}>
      <ExplanationView explanation={explanation} />
      <Text style={styles.engine}>{engineLabel(observation, audience)}</Text>
      {pair ? (
        <Collapsible title="Evidence panel" initiallyOpen={initiallyOpen && audience === 'admin'}>
          <EvidencePanel
            pair={pair}
            decision={recorded}
            engineLabel={engineLabel(observation, audience)}
            existingEvidence={describeExistingEvidence(comparedDefect, observation.comparedDefectId)}
            labels={['This report', `Compared report in ${observation.comparedDefectId}`]}
            bImageWithheld={audience === 'citizen'}
          />
        </Collapsible>
      ) : observation.comparedObservationId ? (
        <Text style={styles.notUsedText}>The compared report is no longer available (its record was deleted).</Text>
      ) : null}
      {audience === 'admin' && identity?.roadFrame ? (
        <Collapsible title="Road-frame reason trace (RoadFrame-V1)">
          {identity.roadFrame.reason_trace.map((r, i) => (
            <Text key={i} style={styles.trace}>{r}</Text>
          ))}
        </Collapsible>
      ) : null}
      {radiusView && radius ? (
        <Collapsible title={`Radius-V1 comparison: ${radius.decision} (legacy engine)`}>
          <View style={{ gap: 8 }}>
            <Text style={styles.notUsedText}>
              What the legacy GPS-radius engine returns for the same candidate. Not the decision — shown for comparison.
            </Text>
            {radius.decision !== identity?.automaticDecision ? (
              <Text style={styles.differs}>
                A radius-only check would return {radius.decision}; road-frame analysis returned {identity?.automaticDecision}.
              </Text>
            ) : null}
            <ExplanationView explanation={radiusView} showNotUsed={false} />
            <Text style={styles.groupTitle}>Engine trace</Text>
            {radius.reasons.map((r, i) => (
              <Text key={i} style={styles.trace}>{r}</Text>
            ))}
          </View>
        </Collapsible>
      ) : audience === 'admin' && radius ? (
        <Collapsible title="Engine trace (Radius-V1)">
          {radius.reasons.map((r, i) => (
            <Text key={i} style={styles.trace}>{r}</Text>
          ))}
        </Collapsible>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  chipLarge: { paddingHorizontal: 12, paddingVertical: 8 },
  chipDecision: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  chipMeaning: { fontSize: 12, fontWeight: '600' },
  collapsible: { borderTopWidth: 1, borderTopColor: '#E4E7EC', paddingTop: 8 },
  collapsibleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  collapsibleTitle: { fontSize: 13, fontWeight: '700', color: '#344054', flex: 1 },
  collapsibleToggle: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  collapsibleBody: { paddingTop: 8 },
  heading: { fontSize: 14, fontWeight: '800', color: '#0B1F3A' },
  summary: { fontSize: 13, color: '#101828', lineHeight: 19 },
  factor: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  toneBar: { width: 3, borderRadius: 2 },
  factorLabel: { fontSize: 12, fontWeight: '700', color: '#344054' },
  factorText: { fontSize: 13, color: '#475467', lineHeight: 18 },
  notUsed: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, gap: 4 },
  notUsedText: { fontSize: 12, color: '#667085', lineHeight: 17 },
  differs: { fontSize: 12, color: '#8A6100', backgroundColor: '#FEF6D8', borderRadius: 8, padding: 8, lineHeight: 17 },
  trace: { fontSize: 11, color: '#475467', fontFamily: 'monospace', lineHeight: 16 },
  panel: { gap: 10 },
  panelKey: { fontSize: 11, color: '#667085' },
  group: { borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 10, gap: 6, backgroundColor: '#FFFFFF' },
  groupTitle: { fontSize: 11, fontWeight: '800', color: '#0F766E', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  rowLabel: { width: 112, fontSize: 12, color: '#667085' },
  rowValue: { flex: 1, fontSize: 12, color: '#101828', lineHeight: 17 },
  engine: { fontSize: 11, color: '#667085' },
  sameArea: { borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#1D4ED8', backgroundColor: '#EEF2FF', padding: 10, gap: 3 },
  sameAreaTitle: { fontSize: 12, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.6 },
  sameAreaText: { fontSize: 13, color: '#1E293B', lineHeight: 18 },
});

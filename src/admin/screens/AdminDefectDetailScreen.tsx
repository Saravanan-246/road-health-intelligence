import { useState, useMemo } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminPriorityTag from '../components/AdminPriorityTag';
import { Collapsible, DecisionChip, ObservationIdentity } from '../../components/IdentityPanels';
import LocationContextCard from '../../components/LocationContextCard';
import {
  EDIT_NOTE_MAX_LENGTH,
  deleteDefect,
  editDefect,
  resolveRecurrence,
  resolveReview,
  updateStatus,
  getIssuesByDefect,
  useDefects,
} from '../../api/mockBackend';
import { CITIZEN_ISSUE_LABELS, DEFECT_TYPE_LABELS, SEVERITY_LABELS, type Defect, type DefectStatus, type DefectType } from '../../api/types';
import { projectToRoadFrame } from '../../services/roadFrame';
import { evidenceIntegrity, type IntegrityStatus } from '../../services/evidenceIntegrity';

const INTEGRITY_COLORS: Record<IntegrityStatus, string> = { PASS: '#067647', WARN: '#B54708', FAIL: '#B42318', INFO: '#667085' };

const STATUSES: DefectStatus[] = ['CANDIDATE', 'CORROBORATED', 'VERIFIED', 'SCHEDULED', 'REPAIRED', 'RECURRED'];
const TYPES = Object.keys(DEFECT_TYPE_LABELS) as DefectType[];

interface Props {
  defect: Defect;
  adminId: string;
  onBack: () => void;
  onOpenDefect: (id: string) => void;
  /** Opens the admin map focused on this defect and its report positions. */
  onShowOnMap?: (id: string) => void;
}

const FACTOR_LABELS: Record<string, string> = {
  severity: 'Severity',
  confidence: 'Detection confidence',
  observationSupport: 'Observation support',
  recency: 'Recency',
  roadContext: 'Road context',
};

const fmt = (lat: number, lon: number) => `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

export default function AdminDefectDetailScreen({ defect, adminId, onBack, onOpenDefect, onShowOnMap }: Props) {
  const allDefects = useDefects();
  const [pendingStatus, setPendingStatus] = useState<DefectStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState<DefectType>(defect.defectType);
  const [draftStatus, setDraftStatus] = useState<DefectStatus>(defect.status);
  const [draftNote, setDraftNote] = useState('');

  const roadFrames = useMemo(
    () => defect.observations.map((obs) => ({ id: obs.id, roadFrame: projectToRoadFrame(obs) })),
    [defect.observations],
  );

  const startEdit = () => {
    setDraftType(defect.defectType);
    setDraftStatus(defect.status);
    setDraftNote('');
    setEditing(true);
  };

  const saveEdit = () => {
    editDefect(defect.id, { defectType: draftType, status: draftStatus, note: draftNote }, adminId);
    setEditing(false);
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete Defect?',
      `This permanently removes ${defect.id} and its ${defect.observations.length} associated local observation(s) from the current demo store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            onBack(); // leave the screen first so it never renders a deleted record
            deleteDefect(defect.id, adminId);
          },
        },
      ],
      { cancelable: true },
    );
  const confirmRecurrence = (action: 'REOPEN' | 'DISMISS') => {
    const target = defect.possibleRecurrenceOf;
    if (!target) return;
    Alert.alert(
      action === 'REOPEN' ? `Reopen ${target}?` : 'Dismiss recurrence?',
      action === 'REOPEN'
        ? `${target} will change from REPAIRED to RECURRED and its reporters will see the update. ${defect.id} stays as the new report.`
        : `The link to ${target} is removed. Both records stay unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action === 'REOPEN' ? 'Reopen' : 'Dismiss', style: 'destructive', onPress: () => resolveRecurrence(defect.id, action, adminId) },
      ],
      { cancelable: true },
    );
  };
  const n = defect.observations.length;
  const knownAcc = defect.observations.map((o) => o.accuracyMeters).filter((a): a is number => a !== null);
  // The observation whose duplicate analysis opened the review.
  const reviewObs = defect.observations.find((o) => o.duplicateDecision === 'REVIEW') ?? defect.observations[0];
  const worst = defect.observations.reduce(
    (w, o) => (['LOW', 'MEDIUM', 'HIGH', 'SEVERE'].indexOf(o.severity) > ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'].indexOf(w) ? o.severity : w),
    defect.observations[0]?.severity ?? 'LOW',
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>DIGITAL DEFECT ID</Text>
        <Text style={styles.bigId}>{defect.id}</Text>
        <Text style={styles.type}>{DEFECT_TYPE_LABELS[defect.defectType]} · {SEVERITY_LABELS[worst]} severity</Text>
        <Text style={styles.meta}>
          Approx. location {fmt(defect.latitude, defect.longitude)} · mean of {n} report{n === 1 ? '' : 's'}
          {knownAcc.length ? ` · best GPS accuracy ±${Math.min(...knownAcc).toFixed(0)} m` : ' · GPS accuracy unknown'}
        </Text>
        <Text style={styles.status}>Status: {defect.status}</Text>
        {!editing ? (
          <View style={styles.btnRow}>
            <Btn label="EDIT" onPress={startEdit} />
            <Btn label="DELETE" danger onPress={confirmDelete} />
          </View>
        ) : null}
        {onShowOnMap ? <Btn label="SHOW ON MAP" onPress={() => onShowOnMap(defect.id)} /> : null}
      </View>

      {defect.possibleRecurrenceOf ? (
        <View style={[styles.card, styles.recurrence]}>
          <Text style={styles.section}>Possible recurrence</Text>
          <Text style={styles.meta}>
            This report matches repaired defect{' '}
            <Text style={styles.linkInline} onPress={() => onOpenDefect(defect.possibleRecurrenceOf!)}>
              {defect.possibleRecurrenceOf}
            </Text>
            {' '}(same identity evidence as its previous reports). The defect may have come back after repair.
          </Text>
          <View style={styles.btnRow}>
            <Btn label="REOPEN AS RECURRED" primary onPress={() => confirmRecurrence('REOPEN')} />
            <Btn label="DISMISS" onPress={() => confirmRecurrence('DISMISS')} />
          </View>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.section}>Edit defect</Text>
          <Text style={styles.note}>Defect type</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => setDraftType(t)} style={[styles.chip, draftType === t && styles.chipCurrent]}>
                <Text style={[styles.chipText, draftType === t && { color: '#FFFFFF' }]}>{DEFECT_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Status</Text>
          <View style={styles.chips}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setDraftStatus(s)} style={[styles.chip, draftStatus === s && styles.chipCurrent]}>
                <Text style={[styles.chipText, draftStatus === s && { color: '#FFFFFF' }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Note for the timeline (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Reclassified after site visit"
            placeholderTextColor="#98A2B3"
            value={draftNote}
            onChangeText={setDraftNote}
            maxLength={EDIT_NOTE_MAX_LENGTH}
          />
          <Text style={styles.note}>
            Severity and priority come from the reported observations and are not edited here.
          </Text>
          <View style={styles.btnRow}>
            <Btn label="SAVE" primary onPress={saveEdit} />
            <Btn label="CANCEL" onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : null}

      <View style={styles.identity}>
        <Text style={styles.identityText}>{n} OBSERVATION{n === 1 ? '' : 'S'}</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.identityText}>1 PHYSICAL DEFECT</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.identityId}>{defect.id}</Text>
      </View>

      {/* Duplicate review */}
      <View style={styles.card}>
        <Text style={styles.section}>Identity decision</Text>
        {defect.pendingReviewOf ? (
          <>
            <Text style={styles.reviewTitle}>REVIEW REQUIRED</Text>
            <DecisionChip decision="REVIEW" />
            <Text style={styles.meta}>
              Possible duplicate of{' '}
              <Text style={styles.linkInline} onPress={() => onOpenDefect(defect.pendingReviewOf!)}>
                {defect.pendingReviewOf}
              </Text>
              . It was not merged automatically; the recorded reasons are below.
            </Text>
            {reviewObs ? <ObservationIdentity observation={reviewObs} defects={allDefects} audience="admin" initiallyOpen /> : null}
            <View style={styles.btnRow}>
              <Btn label="CONFIRM MERGE" primary onPress={() => {
                const target = defect.pendingReviewOf!;
                resolveReview(defect.id, 'MERGE', adminId);
                onOpenDefect(target);
              }} />
              <Btn label="KEEP DISTINCT" onPress={() => resolveReview(defect.id, 'DISTINCT', adminId)} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.meta}>No open review. Each observation's recorded decision and why it occurred:</Text>
            {defect.observations.map((o, i) => (
              <Collapsible key={o.id} title={`#${i + 1} · ${o.id} · ${o.duplicateDecision ?? '—'}`}>
                <ObservationIdentity observation={o} defects={allDefects} audience="admin" />
              </Collapsible>
            ))}
          </>
        )}
      </View>

      {/* Priority */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.section}>Priority</Text>
          <AdminPriorityTag score={defect.priority} large />
        </View>
        {Object.entries(defect.priorityBreakdown).map(([k, f]) => (
          <View key={k} style={styles.factor}>
            <View style={styles.rowBetween}>
              <Text style={styles.factorName}>{FACTOR_LABELS[k] ?? k} × {f.weight}</Text>
              <Text style={styles.factorName}>+{f.points.toFixed(1)}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${f.value * 100}%` }]} /></View>
            <Text style={styles.note}>{f.note}</Text>
          </View>
        ))}
        <Text style={styles.note}>Configurable engineering weights — not an official government formula.</Text>
      </View>

      <LocationContextCard defect={defect} />

      {/* Maintenance */}
      <View style={styles.card}>
        <Text style={styles.section}>Maintenance status</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setPendingStatus(s === defect.status ? null : s)}
              style={[styles.chip, s === defect.status && styles.chipCurrent, s === pendingStatus && styles.chipPending]}
            >
              <Text style={[styles.chipText, (s === defect.status || s === pendingStatus) && { color: '#FFFFFF' }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        {pendingStatus ? (
          <View style={styles.confirm}>
            <Text style={styles.meta}>Change {defect.status} → {pendingStatus}?</Text>
            <View style={styles.btnRow}>
              <Btn label="CONFIRM" primary onPress={() => { updateStatus(defect.id, pendingStatus, adminId); setPendingStatus(null); }} />
              <Btn label="CANCEL" onPress={() => setPendingStatus(null)} />
            </View>
          </View>
        ) : null}
        {defect.status === 'REPAIRED' ? (
          <Text style={styles.note}>Repair verification: awaiting after-repair evidence (no re-scan yet).</Text>
        ) : null}
      </View>

      {/* Lifecycle */}
      <View style={styles.card}>
        <Text style={styles.section}>Lifecycle</Text>
        {(defect.history ?? []).map((h, i) => (
          <Text key={i} style={styles.meta}>
            • {new Date(h.at).toLocaleString()} — {h.from === null ? `Reported (${h.to})` : h.from === h.to ? h.note : `${h.from} → ${h.to}`}
            {h.note && h.from !== h.to && h.from !== null ? ` · ${h.note}` : ''} · {h.by}
          </Text>
        ))}
      </View>

      {/* Citizen issues */}
      {(() => {
        const issues = getIssuesByDefect(defect.id);
        return issues.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.section}>Citizen issues ({issues.length})</Text>
            {issues.map((issue) => (
              <View key={issue.id} style={{ gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E4E7EC' }}>
                <Text style={styles.factorName}>{CITIZEN_ISSUE_LABELS[issue.issueType]}</Text>
                <Text style={styles.note}>
                  {issue.details || '(no details provided)'}
                </Text>
                <Text style={[styles.note, { fontSize: 11 }]}>
                  {issue.id} · {new Date(issue.createdAt).toLocaleString()} · {issue.status}
                </Text>
              </View>
            ))}
          </View>
        ) : null;
      })()}

      {/* Evidence */}
      <Text style={styles.section}>Evidence ({n} observations)</Text>
      {defect.observations.map((o, idx) => {
        const rf = roadFrames[idx]?.roadFrame;
        return (
          <View key={o.id} style={[styles.card, styles.obs]}>
            {o.imageUri ? (
              <Image source={{ uri: o.imageUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.noImg]}><Text style={styles.noImgText}>No image (staged)</Text></View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.factorName}>{o.id} · {o.duplicateDecision ?? '—'}</Text>
              <Text style={styles.note}>{new Date(o.timestamp).toLocaleString()}</Text>
              <Text style={styles.note}>
                GPS {fmt(o.latitude, o.longitude)} · {o.locationSource}
                {o.testLocation
                  ? ' · DEMO TEST LOCATION (not GPS)'
                  : o.accuracyMeters !== null
                    ? ` ±${o.accuracyMeters.toFixed(0)} m`
                    : ' · accuracy unknown'}
              </Text>
              <View style={{ marginTop: 4, padding: 8, borderRadius: 8, backgroundColor: '#F2F4F7', gap: 3 }}>
                <Text style={styles.factorName}>IMAGE VALIDATION</Text>
                <Text style={styles.note}>
                  Status: {o.imageValidation?.status === 'VALID' ? 'VALID ROAD IMAGE' : o.imageValidation?.status === 'INVALID' ? 'INVALID IMAGE' : 'REVIEW REQUIRED'}
                </Text>
                {o.imageValidation?.defectType ? (
                  <Text style={styles.note}>Validated category: {DEFECT_TYPE_LABELS[o.imageValidation.defectType]}</Text>
                ) : null}
                <Text style={styles.note}>Evidence: {o.imageValidation?.referenceMatch ? 'Reference comparison' : 'No reference match'}</Text>
                {o.imageValidation?.referenceSimilarity != null ? (
                  <Text style={styles.note}>Reference similarity: {(o.imageValidation.referenceSimilarity * 100).toFixed(1)}%</Text>
                ) : null}
                <Text style={styles.note}>{o.imageValidation?.reason ?? 'This observation predates image validation.'}</Text>
                {o.imageValidation?.analyzedAt ? (
                  <Text style={styles.note}>Checked: {new Date(o.imageValidation.analyzedAt).toLocaleString()}</Text>
                ) : null}
              </View>
              {rf && rf.snap_confidence !== 'NONE' && (
                <>
                  <Text style={[styles.note, { color: '#0F766E', fontWeight: '600' }]}>
                    Road: {rf.way_name}
                  </Text>
                  <Text style={styles.note}>
                    Chainage {rf.chainage_m?.toFixed(1) ?? '?'} m · Side {rf.side ?? '?'} · Lateral offset {rf.lateral_offset_m?.toFixed(1) ?? '?'} m
                  </Text>
                </>
              )}
              <Text style={styles.note}>
                {DEFECT_TYPE_LABELS[o.defectType]} / {SEVERITY_LABELS[o.severity]} · by {o.classificationSource} · confidence{' '}
                {o.confidence !== null ? `${Math.round(o.confidence * 100)}%` : 'n/a'} · motion evidence not captured
              </Text>
              <Text style={styles.note}>
                Photo: {o.imageSource === 'CAMERA' ? 'camera' : o.imageSource === 'GALLERY' ? 'gallery' : 'source not recorded'}
                {o.imageCapturedAt ? ` · taken ${new Date(o.imageCapturedAt).toLocaleString()}` : ''}
              </Text>
              <Text style={styles.note}>Reporter ref {o.reporterId ?? 'unknown'} (pseudonymous)</Text>
              <Collapsible title="Evidence integrity">
                {evidenceIntegrity(o, defect).map((c) => (
                  <Text key={c.label} style={styles.note}>
                    <Text style={{ fontWeight: '800', color: INTEGRITY_COLORS[c.status] }}>{c.status}</Text> {c.label}: {c.text}
                  </Text>
                ))}
              </Collapsible>
            </View>
          </View>
        );
      })}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Btn({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, danger && styles.btnDanger, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.btnText, primary && { color: '#FFFFFF' }, danger && { color: '#B42318' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  linkInline: { color: '#1D4ED8', fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 6 },
  label: { fontSize: 11, fontWeight: '800', color: '#0F766E', letterSpacing: 0.8 },
  bigId: { fontSize: 26, fontWeight: '800', color: '#0B1F3A' },
  type: { fontSize: 15, fontWeight: '600', color: '#101828' },
  meta: { fontSize: 13, color: '#475467' },
  status: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  identity: { backgroundColor: '#0B1F3A', borderRadius: 12, padding: 14, alignItems: 'center' },
  identityText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  identityId: { color: '#5EEAD4', fontSize: 20, fontWeight: '800' },
  arrow: { color: '#5EEAD4', fontSize: 16 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  reviewTitle: { fontSize: 20, fontWeight: '800', color: '#8A6100' },
  recurrence: { borderLeftWidth: 4, borderLeftColor: '#B54708' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  factor: { gap: 3, paddingTop: 4 },
  factorName: { fontSize: 13, fontWeight: '600', color: '#101828' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  fill: { height: 6, backgroundColor: '#0F766E' },
  note: { fontSize: 12, color: '#667085' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 14, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 10, paddingVertical: 8 },
  chipCurrent: { backgroundColor: '#0B1F3A', borderColor: '#0B1F3A' },
  chipPending: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#344054' },
  confirm: { backgroundColor: '#F0FDFA', borderRadius: 8, padding: 10, gap: 8 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  btnPrimary: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  btnDanger: { borderColor: '#B42318' },
  input: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#101828', backgroundColor: '#FFFFFF',
  },
  btnText: { fontSize: 13, fontWeight: '700', color: '#344054' },
  obs: { flexDirection: 'row', gap: 10 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#EEF0F3' },
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  noImgText: { fontSize: 9, color: '#667085', textAlign: 'center' },
});

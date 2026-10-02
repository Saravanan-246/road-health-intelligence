import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PriorityBadge from '../components/PriorityBadge';
import ReportIssueModal from '../components/ReportIssueModal';
import IssueSubmittedModal from '../components/IssueSubmittedModal';
import StatusStepper from '../components/StatusStepper';
import { Collapsible, DecisionChip, ObservationIdentity, SamePlaceNote } from '../../components/IdentityPanels';
import LocationContextCard from '../../components/LocationContextCard';
import { STAGE_META, citizenStage } from '../../services/citizenStatus';
import { formatCoordinates } from '../utils/distance';
import { submitCitizenIssue, useDefects, useIssues } from '../../api/mockBackend';
import {
  CITIZEN_ISSUE_LABELS,
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type CitizenIssueType,
  type Defect,
  type PriorityBreakdown,
} from '../../api/types';

interface Props {
  defect: Defect;
  onBack: () => void;
  userId?: string;
}

const FACTOR_LABELS: Record<keyof PriorityBreakdown, string> = {
  severity: 'Severity',
  confidence: 'Confidence',
  observationSupport: 'Observation support',
  recency: 'Recency',
  roadContext: 'Road context',
};

export default function DefectScreen({ defect, onBack, userId }: Props) {
  const defects = useDefects();
  const issues = useIssues();
  const myIssues = issues.filter((i) => i.defectId === defect.id && i.reporterId === userId);
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [issueSentModalVisible, setIssueSentModalVisible] = useState(false);

  const handleReportIssue = (issueType: CitizenIssueType, details: string) => {
    if (!userId) return;
    try {
      submitCitizenIssue(defect.id, issueType, details, userId);
    } catch (e) {
      Alert.alert('Issue not submitted', e instanceof Error ? e.message : 'Please try again.');
      return;
    }
    setIssueModalVisible(false);
    setIssueSentModalVisible(true);
  };

  const handleIssueSubmitted = () => {
    setIssueSentModalVisible(false);
  };
  const count = defect.observations.length;
  const knownAcc = defect.observations.map((o) => o.accuracyMeters).filter((a): a is number => a !== null);
  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.link}>‹ Back</Text>
        </Pressable>

      <View style={styles.card}>
        <Text style={styles.idLabel}>DIGITAL DEFECT ID</Text>
        <Text style={styles.id}>{defect.id}</Text>
        <Text style={styles.title}>{DEFECT_TYPE_LABELS[defect.defectType]}</Text>
        <View style={styles.row}>
          <Text style={styles.status}>{STAGE_META[citizenStage(defect)].label.toUpperCase()}</Text>
          <Text style={styles.muted}>
            {count} observation{count === 1 ? '' : 's'} · one defect record
          </Text>
        </View>
        {defect.pendingReviewOf ? (
          <Text style={styles.review}>Under authority review: possible duplicate of {defect.pendingReviewOf}</Text>
        ) : null}
        <View style={styles.flow}>
          <Text style={styles.flowText}>{count} REPORT{count === 1 ? '' : 'S'} → 1 PHYSICAL DEFECT → {defect.id}</Text>
        </View>
        <Text style={styles.label}>Approximate location</Text>
        <Text style={styles.value}>{formatCoordinates(defect.latitude, defect.longitude)}</Text>
        <Text style={styles.note}>
          Average of {count} report{count === 1 ? '' : 's'}.{' '}
          {knownAcc.length
            ? `Best GPS accuracy ±${Math.min(...knownAcc).toFixed(0)} m — the true position may differ by that much.`
            : 'GPS accuracy unknown (manually entered location).'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Report status</Text>
        <StatusStepper defect={defect} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Why this decision occurred</Text>
        <Text style={styles.note}>
          Each report was compared with existing records when it was submitted. These are the recorded reasons.
        </Text>
        {defect.observations.map((o, i) => {
          const mine = !!userId && o.reporterId === userId;
          return (
            <Collapsible
              key={o.id}
              title={`Report #${i + 1}${mine ? ' (yours)' : ''} · ${o.duplicateDecision ?? 'DISTINCT'}`}
              initiallyOpen={mine}
            >
              <View style={{ gap: 8 }}>
                <DecisionChip decision={o.duplicateDecision ?? 'DISTINCT'} />
                <ObservationIdentity observation={o} defects={defects} audience="citizen" />
              </View>
            </Collapsible>
          );
        })}
        <Collapsible title="How RoadGuard decides whether reports are the same defect">
          <SamePlaceNote />
        </Collapsible>
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

      <LocationContextCard defect={defect} compact />

      <View style={styles.card}>
        <Text style={styles.section}>Lifecycle timeline</Text>
        {(defect.history ?? []).map((h, i) => (
          <View key={i} style={styles.tl}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.factorName}>{h.from === null ? `REPORTED · ${h.to}` : h.from === h.to ? h.note ?? h.to : `${h.from} → ${h.to}`}</Text>
              <Text style={styles.note}>
                {new Date(h.at).toLocaleString()}
                {h.note && h.from !== h.to ? ` · ${h.note}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Observation evidence ({count})</Text>
      {defect.observations.map((o, i) => {
        const mine = !!userId && o.reporterId === userId;
        return (
        <View key={o.id} style={[styles.card, styles.obs]}>
          {o.imageUri && mine ? (
            <Image source={{ uri: o.imageUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.noImg]}>
              <Text style={styles.noImgText}>
                {o.imageUri ? 'Image held for authority verification' : 'No image (staged record)'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.obsTitle}>
              #{i + 1} · {DEFECT_TYPE_LABELS[o.defectType]} · {SEVERITY_LABELS[o.severity]}
              {mine ? <Text style={styles.mine}>  YOUR REPORT</Text> : null}
            </Text>
            <Text style={styles.muted}>{new Date(o.timestamp).toLocaleString()}</Text>
            <Text style={styles.muted}>
              {formatCoordinates(o.latitude, o.longitude)} · {o.locationSource}
              {o.testLocation ? ' · DEMO TEST LOCATION' : o.accuracyMeters !== null ? ` ±${o.accuracyMeters.toFixed(0)} m` : ''}
            </Text>
            <Text style={styles.muted}>
              {o.duplicateDecision ? `Duplicate decision: ${o.duplicateDecision} · ` : ''}Classified by {o.classificationSource}
              {o.confidence !== null ? ` · ${(o.confidence * 100).toFixed(0)}%` : ''}
            </Text>
          </View>
        </View>
        );
      })}

      {myIssues.length ? (
        <View style={styles.card}>
          <Text style={styles.section}>Your issue reports ({myIssues.length})</Text>
          {myIssues.map((issue) => (
            <View key={issue.id} style={styles.issue}>
              <Text style={styles.factorName}>{CITIZEN_ISSUE_LABELS[issue.issueType]}</Text>
              {issue.details ? <Text style={styles.note}>{issue.details}</Text> : null}
              <Text style={styles.note}>
                {issue.id} · {new Date(issue.createdAt).toLocaleString()} ·{' '}
                {issue.status === 'UNDER_REVIEW' ? 'Under admin review' : 'Resolved'}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>Your original report stays unchanged unless an authority corrects it.</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => setIssueModalVisible(true)}
        style={({ pressed }) => [styles.reportButton, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.reportButtonText}>Report an issue</Text>
      </Pressable>
      </ScrollView>

      <ReportIssueModal
        visible={issueModalVisible}
        onClose={() => setIssueModalVisible(false)}
        onSubmit={handleReportIssue}
      />

      <IssueSubmittedModal
        visible={issueSentModalVisible}
        onClose={handleIssueSubmitted}
      />
    </>
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
  idLabel: { fontSize: 11, fontWeight: '800', color: '#0F766E', letterSpacing: 0.8 },
  id: { fontSize: 26, fontWeight: '800', color: '#0B1F3A', letterSpacing: 0.3 },
  title: { fontSize: 18, fontWeight: '600', color: '#101828' },
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
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  noImgText: { fontSize: 9, color: '#667085', textAlign: 'center' },
  review: { fontSize: 13, color: '#8A6100', backgroundColor: '#FEF6D8', padding: 8, borderRadius: 8 },
  flow: { backgroundColor: '#E6F4F1', borderRadius: 8, padding: 10 },
  flowText: { fontSize: 13, fontWeight: '700', color: '#0F766E', textAlign: 'center' },
  tl: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0F766E', marginTop: 4 },
  obsTitle: { fontSize: 14, fontWeight: '600', color: '#101828' },
  mine: { fontSize: 10, fontWeight: '800', color: '#0F766E', letterSpacing: 0.5 },
  issue: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E4E7EC' },
  reportButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportButtonText: { fontSize: 14, fontWeight: '600', color: '#344054' },
});

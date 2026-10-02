import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { runIdentityTests, type TestResult } from '../../services/identityTests';
import { GROUP_LABELS, runSystemTests, type TestGroup } from '../../services/systemTests';
import { DEMO_CASES } from '../../data/identityDemoFixtures';
import { useMemo } from 'react';

interface Props {
  onBack: () => void;
}

const GROUP_OF = new Map(DEMO_CASES.map((c) => [c.id, c.group ?? 'CORE']));

export default function AdminTestScreen({ onBack }: Props) {
  const results = useMemo(() => runIdentityTests(), []);
  const system = useMemo(() => runSystemTests(), []);
  const passCount = results.filter((r) => r.passed).length;
  const checks = results.length * 2;
  const passedChecks = results.reduce(
    (n, r) => n + Number(r.radiusResult === r.radiusExpected) + Number(r.roadframeResult === r.roadframeExpected),
    0,
  );
  const core = results.filter((r) => GROUP_OF.get(r.caseId) !== 'SAME_AREA');
  const sameArea = results.filter((r) => GROUP_OF.get(r.caseId) === 'SAME_AREA');
  const systemPassed = system.filter((t) => t.passed).length;
  const groups = [...new Set(system.map((t) => t.group))] as TestGroup[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Test Suites</Text>
        <Text style={styles.subtitle}>Computed live from the engines each time this screen opens</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, passedChecks === checks ? styles.summaryPass : styles.summaryFail]}>
          <Text style={styles.summaryValue}>{passedChecks}/{checks}</Text>
          <Text style={styles.summaryLabel}>identity engine checks · {passCount}/{results.length} scenarios</Text>
        </View>
        <View style={[styles.summaryBox, systemPassed === system.length ? styles.summaryPass : styles.summaryFail]}>
          <Text style={styles.summaryValue}>{systemPassed}/{system.length}</Text>
          <Text style={styles.summaryLabel}>system scenarios</Text>
        </View>
      </View>

      <Text style={styles.section}>Core identity scenarios ({core.length} × 2 engines = {core.length * 2} checks)</Text>
      {core.map((r) => <IdentityCard key={r.caseId} result={r} />)}

      <Text style={styles.section}>Same area ≠ same defect ({sameArea.length} × 2 engines = {sameArea.length * 2} checks)</Text>
      {sameArea.map((r) => <IdentityCard key={r.caseId} result={r} />)}

      {groups.map((g) => (
        <View key={g} style={{ gap: 8 }}>
          <Text style={styles.section}>{GROUP_LABELS[g]}</Text>
          {system.filter((t) => t.group === g).map((t) => (
            <View key={t.id} style={[styles.card, !t.passed && styles.cardFail]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.caseName, { flex: 1 }]}>{t.id} · {t.name}</Text>
                <Text style={[styles.badge, t.passed ? styles.badgePass : styles.badgeFail]}>{t.passed ? 'PASS' : 'FAIL'}</Text>
              </View>
              <Text style={[styles.detail, !t.passed && { color: '#B42318' }]}>{t.detail}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>
        Identity scenarios check both engines against their expected decision. Sensor tests use synthetic vectors, not
        recorded measurements. No test modifies the demo data.
      </Text>
    </ScrollView>
  );
}

function IdentityCard({ result }: { result: TestResult }) {
  return (
    <View style={[styles.card, !result.passed && styles.cardFail]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.caseName, !result.passed && { color: '#B42318' }]}>{result.caseId}</Text>
        <Text style={[styles.badge, result.passed ? styles.badgePass : styles.badgeFail]}>{result.passed ? 'PASS' : 'FAIL'}</Text>
      </View>
      <View style={styles.engineRow}>
        <Engine label="RADIUS-V1" got={result.radiusResult} expected={result.radiusExpected} />
        <View style={styles.divider} />
        <Engine label="ROADFRAME-V1" got={result.roadframeResult} expected={result.roadframeExpected} />
      </View>
      {result.issue ? (
        <View style={styles.issueBox}>
          <Text style={styles.issueText}>{result.issue}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Engine({ label, got, expected }: { label: string; got: string; expected: string }) {
  return (
    <View style={styles.engine}>
      <Text style={styles.engineLabel}>{label}</Text>
      <View style={[styles.resultBox, got === 'MERGE' && styles.resultMerge, got === 'REVIEW' && styles.resultReview, got === 'DISTINCT' && styles.resultDistinct]}>
        <Text style={styles.resultText}>{got}</Text>
      </View>
      <Text style={styles.resultExpected}>Expected: {expected}</Text>
      {got !== expected ? <Text style={styles.mismatch}>Mismatch</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  header: { backgroundColor: '#0B1F3A', borderRadius: 12, padding: 16, gap: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: '#CBD5E1' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryBox: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 },
  summaryPass: { backgroundColor: '#DCFCE7' },
  summaryFail: { backgroundColor: '#FEE2E2' },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#0B1F3A' },
  summaryLabel: { fontSize: 11, color: '#667085', textAlign: 'center' },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 10 },
  cardFail: { borderColor: '#F97316', borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  caseName: { fontSize: 14, fontWeight: '700', color: '#0B1F3A' },
  badge: { fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  badgePass: { backgroundColor: '#DCFCE7', color: '#166534' },
  badgeFail: { backgroundColor: '#FEE2E2', color: '#B42318' },
  detail: { fontSize: 12, color: '#475467', lineHeight: 17 },
  engineRow: { flexDirection: 'row', gap: 12 },
  engine: { flex: 1, gap: 6 },
  engineLabel: { fontSize: 11, fontWeight: '700', color: '#667085', textTransform: 'uppercase' },
  resultBox: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  resultMerge: { backgroundColor: '#DCFCE7' },
  resultReview: { backgroundColor: '#FEF08A' },
  resultDistinct: { backgroundColor: '#FEE2E2' },
  resultText: { fontSize: 14, fontWeight: '800', color: '#0B1F3A' },
  resultExpected: { fontSize: 11, color: '#667085' },
  mismatch: { fontSize: 11, color: '#B42318', fontWeight: '700' },
  divider: { width: 1, backgroundColor: '#E4E7EC' },
  issueBox: { backgroundColor: '#FFF7ED', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#F97316' },
  issueText: { fontSize: 11, color: '#9A3412', lineHeight: 16 },
  footer: { fontSize: 11, color: '#98A2B3', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});

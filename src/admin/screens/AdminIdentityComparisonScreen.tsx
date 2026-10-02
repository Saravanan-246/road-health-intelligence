import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEMO_CASES } from '../../data/identityDemoFixtures';
import { analyzeDuplicate } from '../../citizen/services/devMock/duplicateService';
import { resolveRoadFrameIdentity } from '../../services/roadFrameIdentity';
import { compareObservations, explainRoadFrameDecision } from '../../services/identityExplanation';
import { DecisionChip, EvidencePanel, ExplanationView, SamePlaceNote } from '../../components/IdentityPanels';
import { useState } from 'react';

interface Props {
  onBack: () => void;
  onTest?: () => void;
}

export default function AdminIdentityComparisonScreen({ onBack, onTest }: Props) {
  const [selectedCase, setSelectedCase] = useState(0);
  const demoCase = DEMO_CASES[selectedCase];

  const radiusAnalysis = analyzeDuplicate(demoCase.obsA, {
    id: 'DEMO',
    defectType: demoCase.obsB.defectType,
    latitude: demoCase.obsB.latitude,
    longitude: demoCase.obsB.longitude,
    observations: [demoCase.obsB],
    status: 'CANDIDATE',
    priority: 50,
    priorityBreakdown: {
      severity: { value: 0.5, weight: 0.25, points: 12.5, note: 'HIGH severity' },
      confidence: { value: 0.5, weight: 0.1, points: 5, note: 'n/a' },
      observationSupport: { value: 0.5, weight: 0.2, points: 10, note: '1 observation' },
      recency: { value: 0.9, weight: 0.2, points: 18, note: 'Recent' },
      roadContext: { value: 0.5, weight: 0.25, points: 12.5, note: 'Urban' },
    },
    priorityComputedAt: Date.now(),
  });

  const roadframeDecision = resolveRoadFrameIdentity(demoCase.obsA, demoCase.obsB);
  const explanation = explainRoadFrameDecision(roadframeDecision, demoCase.obsA, demoCase.obsB);
  const pair = compareObservations(demoCase.obsA, demoCase.obsB);

  const disagree = radiusAnalysis.decision !== roadframeDecision.verdict;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.brand}>ROADGUARD IDENTITY ENGINE</Text>
        <Text style={styles.subtitle}>Same observations. Two decision models.</Text>
      </View>

      {(['CORE', 'SAME_AREA'] as const).map((group) => (
        <View key={group} style={{ gap: 8 }}>
          <Text style={styles.section}>{group === 'CORE' ? 'Core scenarios' : 'Same area ≠ same defect'}</Text>
          <View style={styles.caseGrid}>
            {DEMO_CASES.map((c, idx) =>
              (c.group ?? 'CORE') === group ? (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCase(idx)}
                  style={[styles.caseButton, selectedCase === idx && styles.caseButtonActive]}
                >
                  <Text style={[styles.caseButtonText, selectedCase === idx && { color: '#FFFFFF' }]}>
                    {c.id}
                  </Text>
                </Pressable>
              ) : null,
            )}
          </View>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{demoCase.title}</Text>
        <Text style={styles.cardDesc}>{demoCase.description}</Text>
        <Text style={styles.cardReason}>{demoCase.reasoning}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Why this decision occurred · RoadFrame-V1</Text>
        <DecisionChip decision={roadframeDecision.verdict} large />
        <ExplanationView explanation={explanation} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Observation A vs Observation B</Text>
        <EvidencePanel
          pair={pair}
          decision={roadframeDecision.verdict}
          engineLabel="Decided by RoadFrame-V1 on this staged pair."
          existingEvidence="None — an isolated demo pair with no prior defect record."
          labels={['Observation A', 'Observation B']}
        />
      </View>

      <View style={[styles.comparisonContainer, disagree && styles.comparisonDisagree]}>
        <View style={styles.comparisonEngine}>
          <Text style={styles.engineLabel}>RADIUS-V1</Text>
          <Text style={styles.engineDesc}>Uses raw GPS distance</Text>

          <View style={[styles.decisionBox, radiusAnalysis.decision === 'MERGE' && styles.decisionMerge, radiusAnalysis.decision === 'REVIEW' && styles.decisionReview, radiusAnalysis.decision === 'DISTINCT' && styles.decisionDistinct]}>
            <Text style={styles.decisionText}>{radiusAnalysis.decision}</Text>
          </View>

          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Distance</Text>
            <Text style={styles.detailValue}>{radiusAnalysis.distanceMeters.toFixed(1)} m</Text>
            {radiusAnalysis.reasons.map((r, i) => (
              <Text key={i} style={styles.reason}>• {r}</Text>
            ))}
          </View>
        </View>

        <View style={styles.comparisonDivider} />

        <View style={styles.comparisonEngine}>
          <Text style={styles.engineLabel}>ROADFRAME-V1</Text>
          <Text style={styles.engineDesc}>Uses road structure + chainage + side + accuracy</Text>

          <View style={[styles.decisionBox, roadframeDecision.verdict === 'MERGE' && styles.decisionMerge, roadframeDecision.verdict === 'REVIEW' && styles.decisionReview, roadframeDecision.verdict === 'DISTINCT' && styles.decisionDistinct]}>
            <Text style={styles.decisionText}>{roadframeDecision.verdict}</Text>
          </View>

          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Channels</Text>
            {Object.entries(roadframeDecision.channels).map(([name, channel]) => (
              <Text key={name} style={styles.channel}>
                • <Text style={{ fontWeight: '700' }}>{name}</Text>: {channel.verdict}
              </Text>
            ))}
            {roadframeDecision.veto && (
              <Text style={[styles.detailLabel, { color: '#B42318', marginTop: 6 }]}>
                VETO: {roadframeDecision.veto}
              </Text>
            )}
            <Text style={[styles.detailLabel, { marginTop: 6 }]}>Reason Trace</Text>
            {roadframeDecision.reason_trace.map((r, i) => (
              <Text key={i} style={styles.reason}>• {r}</Text>
            ))}
          </View>
        </View>
      </View>

      {disagree && (
        <View style={styles.disagreementBox}>
          <Text style={styles.disagreementTitle}>DECISION CORRECTED BY ROAD STRUCTURE</Text>
          <Text style={styles.disagreementText}>
            The radius engine chose {radiusAnalysis.decision}, but the road-frame engine chose {roadframeDecision.verdict}. This
            demonstrates how considering road geometry, chainage, and side-of-road can correct GPS-distance-only logic.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.section}>Same place is not the same defect</Text>
        <SamePlaceNote />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Engine Version</Text>
        <Text style={styles.meta}>{roadframeDecision.engine_version}</Text>
      </View>

      {onTest && (
        <Pressable onPress={onTest} style={({ pressed }) => [styles.testButton, pressed && { opacity: 0.85 }]}>
          <Text style={styles.testButtonText}>Test Suite Results</Text>
        </Pressable>
      )}

      <Text style={styles.footer}>
        DEMO / TEST DATA. This is a live hackathon prototype demonstrating the identity-resolution layer concept.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  header: { backgroundColor: '#0B1F3A', borderRadius: 12, padding: 16, gap: 4 },
  brand: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: '#CBD5E1' },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  caseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caseButton: { flex: 1, minWidth: 100, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E4E7EC', paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  caseButtonActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  caseButtonText: { fontSize: 12, fontWeight: '700', color: '#344054' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0B1F3A' },
  cardDesc: { fontSize: 13, color: '#475467', fontStyle: 'italic' },
  cardReason: { fontSize: 13, color: '#667085', lineHeight: 18 },
  comparisonContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden' },
  comparisonDisagree: { borderColor: '#F97316', borderWidth: 2 },
  comparisonEngine: { padding: 14, gap: 10 },
  engineLabel: { fontSize: 13, fontWeight: '800', color: '#0F766E', letterSpacing: 0.4, textTransform: 'uppercase' },
  engineDesc: { fontSize: 12, color: '#667085', fontStyle: 'italic' },
  decisionBox: { borderRadius: 8, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  decisionMerge: { backgroundColor: '#DCFCE7' },
  decisionReview: { backgroundColor: '#FEF08A' },
  decisionDistinct: { backgroundColor: '#FEE2E2' },
  decisionText: { fontSize: 20, fontWeight: '800', color: '#0B1F3A' },
  detailBox: { gap: 4, paddingTop: 4 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#667085', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#0B1F3A' },
  reason: { fontSize: 12, color: '#475467', lineHeight: 16 },
  channel: { fontSize: 12, color: '#667085' },
  comparisonDivider: { height: 1, backgroundColor: '#E4E7EC' },
  disagreementBox: { backgroundColor: '#FFF7ED', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#F97316', padding: 14, gap: 6 },
  disagreementTitle: { fontSize: 13, fontWeight: '800', color: '#EA580C' },
  disagreementText: { fontSize: 12, color: '#9A3412', lineHeight: 18 },
  meta: { fontSize: 12, color: '#667085' },
  testButton: { backgroundColor: '#0B1F3A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  testButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  footer: { fontSize: 11, color: '#98A2B3', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});

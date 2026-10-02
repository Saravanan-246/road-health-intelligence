import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DUPLICATE_CONFIG } from '../../citizen/services/devMock/duplicateService';
import { PRIORITY_CONFIG, PRIORITY_WEIGHTS } from '../../citizen/services/devMock/priorityService';
import { HOTSPOT_CONFIG } from '../../services/riskHotspots';
import { FACILITY_RULES } from '../../services/locationContext';
import { SENSOR_CONFIG } from '../../services/sensors/motionMath';
import { DEMO_FACILITIES, DEMO_FACILITIES_NOTICE } from '../../data/demoFacilities';

/**
 * Read-only view of the parameters the engines actually run with. Values are imported from
 * the services, so this screen cannot drift from the code.
 */
export default function AdminSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>
        Engine configuration, read-only. In this prototype parameters are defined in code; they are shown here for
        transparency and cannot be changed from the app.
      </Text>

      <Section title="Identity resolution — live pipeline">
        <Row label="Decision engine" value="RoadFrame-V1 when both reports project onto the road network" />
        <Row label="Off-network fallback" value="Radius-V1 (GPS gate + defect type)" />
        <Row label="Road-frame tolerance" value="Combined GPS accuracy, clamped to 5–25 m (unknown accuracy = 15 m)" />
        <Row label="Centreline guard" value="Side not trusted within 2 m of the centreline" />
        <Row label="Opposite-side veto" value="Both reports > 2 m from the centreline on opposite sides → DISTINCT" />
        <Row label="Along-road guard" value="Gap beyond tolerance but inside GPS uncertainty → REVIEW, never MERGE" />
        <Row label="Uncertainty review" value="Tolerance above 20 m with an inconclusive gap → REVIEW" />
        <Row label="Merge safeguards" value={`Type conflict; combined uncertainty > ${DUPLICATE_CONFIG.maxUncertaintyForAutoMergeMeters} m; road snap > 5 m from centreline`} />
      </Section>

      <Section title="Radius-V1 (fallback and safeguards)">
        <Row label="Base search radius" value={`${DUPLICATE_CONFIG.candidateRadiusMeters} m + up to ${DUPLICATE_CONFIG.maxUncertaintyInflationMeters} m for GPS uncertainty`} />
        <Row label="Unknown accuracy" value={`${DUPLICATE_CONFIG.unknownAccuracyMeters} m assumed`} />
        <Row label="Thresholds" value={`MERGE ≥ ${DUPLICATE_CONFIG.mergeScore}, REVIEW ≥ ${DUPLICATE_CONFIG.reviewScore}`} />
      </Section>

      <Section title="Physical defect priority">
        {Object.entries(PRIORITY_WEIGHTS).map(([k, w]) => (
          <Row key={k} label={k} value={`weight ${w}`} />
        ))}
        <Row label="Tiers" value={`Critical ≥ ${PRIORITY_CONFIG.tiers.critical}, High ≥ ${PRIORITY_CONFIG.tiers.high}, Medium ≥ ${PRIORITY_CONFIG.tiers.medium}`} />
      </Section>

      <Section title="Location context">
        {Object.values(FACILITY_RULES).map((r) => (
          <Row key={r.label} label={r.label} value={`${r.highWithinM !== null ? `HIGH ≤ ${r.highWithinM} m · ` : ''}ELEVATED ≤ ${r.elevatedWithinM} m`} />
        ))}
        <Row label="Attention rule" value="HIGH context raises an unresolved defect by at most one tier" />
        <Row label="Facility data" value={`${DEMO_FACILITIES.length} staged demo facilities`} />
        <Text style={styles.note}>{DEMO_FACILITIES_NOTICE}</Text>
      </Section>

      <Section title="Risk hotspots">
        <Row label="Grouping distance" value={`${HOTSPOT_CONFIG.linkDistanceMeters} m`} />
        <Row label="Qualification" value={`≥ ${HOTSPOT_CONFIG.minObservations} reports and ≥ 1 unresolved defect`} />
      </Section>

      <Section title="Motion sensors (prototype)">
        <Row label="Sampling" value={`${1000 / SENSOR_CONFIG.sampleIntervalMs} Hz on the calibration screen`} />
        <Row label="Calibration" value={`${SENSOR_CONFIG.calibrationSamples} still samples, ±${SENSOR_CONFIG.maxStillStdDev} m/s² max movement`} />
        <Row label="Recalibration" value={`Gravity direction change > ${SENSOR_CONFIG.recalibrationAngleDeg}°`} />
        <Row label="Motion evidence" value="Not attached to reports; no detector connected" />
      </Section>

      <Section title="Notifications">
        <Row label="Delivery" value="In-app only, derived from the shared store" />
        <Row label="Push service" value="Not connected (no FCM / APNs)" />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.section}>{title}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  sub: { fontSize: 13, color: '#667085', lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 6 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  rowLabel: { width: 130, fontSize: 12, color: '#667085' },
  rowValue: { flex: 1, fontSize: 12, color: '#101828', lineHeight: 17 },
  note: { fontSize: 11, color: '#8A6100' },
});

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMotionCalibration } from '../../services/sensors/motionService';
import { SENSOR_CONFIG, type CalibrationState, type Vec3 } from '../../services/sensors/motionMath';

const STATE_META: Record<CalibrationState, { label: string; color: string; bg: string; text: string }> = {
  UNAVAILABLE: { label: 'UNAVAILABLE', color: '#475467', bg: '#F2F4F7', text: 'Motion sensors cannot be read on this device or in this environment.' },
  UNCALIBRATED: { label: 'NOT CALIBRATED', color: '#8A6100', bg: '#FEF6D8', text: 'Place the phone the way it will be held or mounted, keep it still, then calibrate.' },
  CALIBRATING: { label: 'CALIBRATING', color: '#1D4ED8', bg: '#E8EEFD', text: 'Hold the phone still for about two seconds.' },
  CALIBRATED: { label: 'CALIBRATED', color: '#067647', bg: '#E3F4EA', text: 'Readings below are expressed relative to the measured gravity direction.' },
  NEEDS_RECALIBRATION: { label: 'NEEDS RECALIBRATION', color: '#B42318', bg: '#FDE7E6', text: `The phone's orientation changed by more than ${SENSOR_CONFIG.recalibrationAngleDeg}°. Calibrate again in the new position.` },
};

type StageStatus = 'IMPLEMENTED' | 'PARTIAL' | 'PROTOTYPE' | 'PLANNED';
const STAGE_COLORS: Record<StageStatus, [string, string]> = {
  IMPLEMENTED: ['#E3F4EA', '#067647'],
  PARTIAL: ['#FEF6D8', '#8A6100'],
  PROTOTYPE: ['#FEF6D8', '#8A6100'],
  PLANNED: ['#F2F4F7', '#475467'],
};

const PIPELINE: { stage: string; status: StageStatus; detail: string }[] = [
  { stage: 'Raw sensor data', status: 'IMPLEMENTED', detail: `Device motion (acceleration including gravity) read at ${1000 / SENSOR_CONFIG.sampleIntervalMs} Hz on this screen.` },
  { stage: 'Device orientation', status: 'IMPLEMENTED', detail: 'Posture (portrait, landscape, flat, tilted) and tilt derived from the gravity direction.' },
  { stage: 'Orientation calibration', status: 'IMPLEMENTED', detail: 'Gravity measured while the phone is still; movement during calibration is rejected.' },
  { stage: 'Coordinate normalisation', status: 'PARTIAL', detail: 'Vertical and horizontal components are independent of how the phone is held. Forward/lateral split needs a heading (GPS course) and is planned.' },
  { stage: 'Gravity / baseline handling', status: 'IMPLEMENTED', detail: 'The calibrated gravity baseline is removed; a large change in gravity direction triggers recalibration.' },
  { stage: 'Normalised motion signal', status: 'IMPLEMENTED', detail: 'Live on this screen only.' },
  { stage: 'Road event features', status: 'PROTOTYPE', detail: `Peak, RMS and crest factor over ~2 s. Candidate thresholds (${SENSOR_CONFIG.eventPeakThreshold} m/s², crest ${SENSOR_CONFIG.eventCrestThreshold}) are not validated on road data.` },
  { stage: 'Defect evidence', status: 'PLANNED', detail: 'No detector is connected. Motion data is not attached to reports and is not used to decide anything.' },
];

const f = (n: number, d = 2) => n.toFixed(d);
const vec = (v: Vec3) => `x ${f(v.x)} · y ${f(v.y)} · z ${f(v.z)}`;

export default function SensorCalibrationScreen({ onBack }: { onBack: () => void }) {
  const m = useMotionCalibration();
  const meta = STATE_META[m.state];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Motion sensors</Text>
      <View style={styles.tag}>
        <Text style={styles.tagText}>PROTOTYPE · SENSOR PROCESSING FOUNDATION</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Why calibration is needed</Text>
        <Text style={styles.body}>
          A phone can be held in portrait or landscape, tilted, or mounted at any angle. The accelerometer's x, y and z
          axes turn with the phone, so the same road bump produces different raw numbers in each position. Calibration
          measures the direction of gravity while the phone is still, then expresses motion relative to it. Vertical
          movement then reads the same however the phone is held. The app does not assume the phone faces forward.
        </Text>
      </View>

      <View style={[styles.state, { backgroundColor: meta.bg }]}>
        <Text style={[styles.stateLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={[styles.stateText, { color: meta.color }]}>
          {m.state === 'UNAVAILABLE' && m.unavailableReason ? `${meta.text} ${m.unavailableReason}` : meta.text}
        </Text>
        {m.lastError ? <Text style={[styles.stateText, { color: '#B42318' }]}>{m.lastError}</Text> : null}
      </View>

      {m.available === null ? (
        <View style={styles.inline}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking motion sensors…</Text>
        </View>
      ) : null}

      {m.available ? (
        <Pressable
          onPress={m.startCalibration}
          disabled={m.state === 'CALIBRATING'}
          style={({ pressed }) => [styles.primary, m.state === 'CALIBRATING' && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryText}>{m.calibration ? 'Recalibrate' : 'Calibrate'} (hold still ~2 s)</Text>
        </Pressable>
      ) : null}

      {m.available && m.raw ? (
        <View style={styles.card}>
          <Text style={styles.section}>Live readings (this device)</Text>
          <Row label="Raw (m/s²)" value={vec(m.raw)} />
          {m.calibration ? (
            <>
              <Row label="Calibrated posture" value={`${m.calibration.posture} · tilt ${f(m.calibration.tiltDeg, 0)}° from flat`} />
              <Row label="Gravity baseline" value={`${f(m.calibration.magnitude)} m/s² (still ±${f(m.calibration.stdDev)})`} />
              <Row label="Vertical" value={m.normalised ? `${f(m.normalised.vertical)} m/s² (baseline removed)` : '—'} />
              <Row label="Horizontal" value={m.normalised ? `${f(m.normalised.horizontal)} m/s²` : '—'} />
              <Row label="Orientation drift" value={m.driftDeg !== null ? `${f(m.driftDeg, 1)}° (recalibrate above ${SENSOR_CONFIG.recalibrationAngleDeg}°)` : '—'} />
            </>
          ) : (
            <Text style={styles.muted}>Calibrate to see normalised readings.</Text>
          )}
          <Text style={styles.note}>Vertical is measured along the calibrated gravity axis; its sign follows the platform's convention, so features use magnitudes.</Text>
        </View>
      ) : null}

      {m.features ? (
        <View style={styles.card}>
          <Text style={styles.section}>Road event features (last ~2 s)</Text>
          <Row label="Peak |vertical|" value={`${f(m.features.peakAbsVertical)} m/s²`} />
          <Row label="RMS vertical" value={`${f(m.features.rmsVertical)} m/s²`} />
          <Row label="Crest factor" value={f(m.features.crestFactor, 1)} />
          <Row label="Motion event candidate" value={m.features.candidate ? 'Yes (prototype threshold)' : 'No'} />
          <Text style={styles.note}>
            A candidate is a sharp vertical movement, not a pothole detection. No detector is connected and nothing here is
            attached to reports.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>Processing pipeline</Text>
        {PIPELINE.map((p, i) => {
          const [bg, fg] = STAGE_COLORS[p.status];
          return (
            <View key={p.stage} style={styles.stage}>
              <Text style={styles.stageName}>{i + 1}. {p.stage}</Text>
              <View style={[styles.badge, { backgroundColor: bg }]}>
                <Text style={[styles.badgeText, { color: fg }]}>{p.status}</Text>
              </View>
              <Text style={styles.note}>{p.detail}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>Readings are processed on this device while this screen is open. Nothing is stored or sent.</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  tag: { alignSelf: 'flex-start', backgroundColor: '#FEF6D8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800', color: '#8A6100', letterSpacing: 0.5 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { fontSize: 13, color: '#475467', lineHeight: 19 },
  state: { borderRadius: 12, padding: 14, gap: 4 },
  stateLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  stateText: { fontSize: 13, lineHeight: 18 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { fontSize: 13, color: '#667085' },
  primary: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  rowLabel: { width: 130, fontSize: 13, color: '#667085' },
  rowValue: { flex: 1, fontSize: 13, color: '#101828', fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: '#667085', lineHeight: 17 },
  stage: { gap: 3, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  stageName: { fontSize: 14, fontWeight: '700', color: '#101828' },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  footer: { fontSize: 12, color: '#98A2B3', textAlign: 'center' },
});

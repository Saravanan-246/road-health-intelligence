import { StyleSheet, Text, View } from 'react-native';
import type { Defect } from '../../api/types';
import { STAGE_META, stageSteps } from '../../services/citizenStatus';

/** Citizen-facing report status: Submitted → Under review → Verified → Scheduled → Repaired (→ Reopened). */
export default function StatusStepper({ defect }: { defect: Defect }) {
  const steps = stageSteps(defect);
  const current = steps.find((s) => s.state === 'current');
  return (
    <View style={styles.wrap}>
      {steps.map((s, i) => (
        <View key={s.stage} style={styles.step}>
          <View style={styles.rail}>
            <View style={[styles.dot, s.state === 'done' && styles.dotDone, s.state === 'current' && styles.dotCurrent]} />
            {i < steps.length - 1 ? <View style={[styles.line, s.state === 'done' && styles.lineDone]} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 8 }}>
            <Text style={[styles.label, s.state === 'todo' && styles.labelTodo, s.state === 'current' && styles.labelCurrent]}>
              {STAGE_META[s.stage].label}
            </Text>
            {s.state === 'current' ? <Text style={styles.desc}>{STAGE_META[s.stage].description}</Text> : null}
          </View>
        </View>
      ))}
      {defect.pendingReviewOf ? (
        <Text style={styles.review}>Also under duplicate review: possible duplicate of {defect.pendingReviewOf}.</Text>
      ) : null}
      {current?.stage === 'REPAIRED' ? (
        <Text style={styles.desc}>If the defect comes back, report it again — the authority can reopen this record.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  step: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', marginTop: 3 },
  dotDone: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  dotCurrent: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  line: { width: 2, flex: 1, backgroundColor: '#E4E7EC', marginVertical: 2 },
  lineDone: { backgroundColor: '#0F766E' },
  label: { fontSize: 14, fontWeight: '600', color: '#101828' },
  labelTodo: { color: '#98A2B3', fontWeight: '500' },
  labelCurrent: { color: '#1D4ED8', fontWeight: '800' },
  desc: { fontSize: 12, color: '#667085' },
  review: { fontSize: 12, color: '#8A6100', backgroundColor: '#FEF6D8', borderRadius: 8, padding: 8, marginTop: 4 },
});

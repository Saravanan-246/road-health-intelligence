import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import PriorityBadge from './PriorityBadge';
import { DEFECT_TYPE_LABELS, type Defect } from '../../api/types';
import { formatCoordinates } from '../utils/distance';
import { STAGE_META, citizenStage } from '../../services/citizenStatus';

interface Props {
  defect: Defect;
  onPress: () => void;
  /** When set, only this reporter's own photos are shown (other citizens' evidence is withheld). */
  viewerId?: string;
}

export default function DefectCard({ defect, onPress, viewerId }: Props) {
  const count = defect.observations.length;
  const visible = viewerId ? defect.observations.filter((o) => o.reporterId === viewerId) : defect.observations;
  const thumb = visible[visible.length - 1]?.imageUri;
  const stage = citizenStage(defect);
  const acc = defect.observations.map((o) => o.accuracyMeters).filter((a): a is number => a !== null);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.id}>{defect.id}</Text>
          <PriorityBadge score={defect.priority} />
        </View>
        <Text style={styles.type}>{DEFECT_TYPE_LABELS[defect.defectType]}</Text>
        <View style={styles.pills}>
          <Text style={[styles.pill, stage === 'REPAIRED' ? styles.pillDone : styles.pillStatus]}>{STAGE_META[stage].label.toUpperCase()}</Text>
          {defect.pendingReviewOf ? <Text style={[styles.pill, styles.pillReview]}>DUPLICATE REVIEW</Text> : null}
          <Text style={styles.meta}>
            {count} report{count === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.coords}>
          ≈ {formatCoordinates(defect.latitude, defect.longitude)}
          {acc.length ? ` · ±${Math.min(...acc).toFixed(0)} m` : ' · accuracy unknown'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 12,
    gap: 12,
  },
  pressed: { opacity: 0.7 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#EEF0F3' },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  id: { fontSize: 16, fontWeight: '800', color: '#0B1F3A', flexShrink: 1 },
  type: { fontSize: 14, fontWeight: '500', color: '#344054' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  pillStatus: { color: '#1D4ED8', backgroundColor: '#E8EEFD' },
  pillDone: { color: '#18794E', backgroundColor: '#E3F4EA' },
  pillReview: { color: '#8A6100', backgroundColor: '#FEF6D8' },
  meta: { fontSize: 13, color: '#475467' },
  coords: { fontSize: 12, color: '#667085', fontVariant: ['tabular-nums'] },
});

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import PriorityBadge from './PriorityBadge';
import { DEFECT_TYPE_LABELS, type Defect } from '../types/defect';
import { formatCoordinates } from '../utils/distance';

interface Props {
  defect: Defect;
  onPress: () => void;
}

export default function DefectCard({ defect, onPress }: Props) {
  const count = defect.observations.length;
  const thumb = defect.observations[count - 1]?.imageUri;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.type}>{DEFECT_TYPE_LABELS[defect.defectType]}</Text>
          <PriorityBadge score={defect.priority} />
        </View>
        <Text style={styles.meta}>
          {defect.status} · {count} observation{count === 1 ? '' : 's'}
        </Text>
        <Text style={styles.coords}>{formatCoordinates(defect.latitude, defect.longitude)}</Text>
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
  type: { fontSize: 16, fontWeight: '600', color: '#101828', flexShrink: 1 },
  meta: { fontSize: 13, color: '#475467' },
  coords: { fontSize: 12, color: '#667085', fontVariant: ['tabular-nums'] },
});

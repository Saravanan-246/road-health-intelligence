import { StyleSheet, Text, View } from 'react-native';
import { priorityTier } from '../../api/mockBackend';

const COLORS = {
  Critical: ['#FDE7E6', '#B42318'],
  High: ['#FFEDD9', '#B54708'],
  Medium: ['#FEF6D8', '#8A6100'],
  Low: ['#E3F4EA', '#18794E'],
} as const;

export default function AdminPriorityTag({ score, large }: { score: number; large?: boolean }) {
  const tier = priorityTier(score);
  const [bg, fg] = COLORS[tier];
  return (
    <View style={[styles.tag, { backgroundColor: bg }, large && styles.large]}>
      <Text style={[styles.score, { color: fg }, large && { fontSize: 26 }]}>{score}</Text>
      <Text style={[styles.tier, { color: fg }]}>{tier}</Text>
    </View>
  );
}



const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  large: { paddingHorizontal: 14, paddingVertical: 8 },
  score: { fontSize: 15, fontWeight: '800' },
  tier: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});

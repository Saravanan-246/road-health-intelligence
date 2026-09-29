import { StyleSheet, Text, View } from 'react-native';
import { priorityTier } from '../services/devMock/priorityService';
import type { PriorityTier } from '../../api/types';

const TIER_COLORS: Record<PriorityTier, { bg: string; fg: string }> = {
  Critical: { bg: '#FDE7E6', fg: '#B42318' },
  High: { bg: '#FFEDD9', fg: '#B54708' },
  Medium: { bg: '#FEF6D8', fg: '#8A6100' },
  Low: { bg: '#E3F4EA', fg: '#18794E' },
};

interface Props {
  score: number;
  size?: 'small' | 'large';
}

export default function PriorityBadge({ score, size = 'small' }: Props) {
  const tier = priorityTier(score);
  const colors = TIER_COLORS[tier];
  const large = size === 'large';
  return (
    <View style={[styles.badge, large && styles.badgeLarge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.score, large && styles.scoreLarge, { color: colors.fg }]}>{score}</Text>
      <Text style={[styles.tier, { color: colors.fg }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeLarge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  score: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scoreLarge: { fontSize: 28 },
  tier: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});

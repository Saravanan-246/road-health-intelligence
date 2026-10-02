import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { markNotificationsSeen } from '../../api/mockBackend';
import { useNotifications } from '../hooks/useNotifications';

interface Props {
  userId: string;
  onBack: () => void;
  onOpenDefect: (id: string) => void;
}

export default function NotificationsScreen({ userId, onBack, onOpenDefect }: Props) {
  const { notifications, seenAt } = useNotifications(userId);
  // Remember what was unread when the screen opened, then mark everything seen.
  const [openedSeenAt] = useState(seenAt);
  useEffect(() => {
    markNotificationsSeen(userId);
  }, [userId, notifications.length]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={notifications}
      keyExtractor={(n) => n.id}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.link}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>IN-APP PROTOTYPE NOTIFICATIONS</Text>
            <Text style={styles.noticeText}>
              Status updates are generated inside the app from the shared demo store whenever a report or its defect
              changes. They appear here and as a badge while the app is open. No push notification service (Firebase
              Cloud Messaging or APNs) is connected, so nothing is delivered when the app is closed.
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No updates yet. Submit a report to follow its status here.</Text>}
      renderItem={({ item }) => {
        const isNew = item.at > openedSeenAt;
        return (
          <Pressable onPress={() => onOpenDefect(item.defectId)} style={({ pressed }) => [styles.card, isNew && styles.cardNew, pressed && { opacity: 0.85 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {isNew ? <Text style={styles.newTag}>NEW</Text> : null}
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.meta}>{new Date(item.at).toLocaleString()} · {item.defectId}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  notice: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 12, gap: 4 },
  noticeTitle: { fontSize: 11, fontWeight: '800', color: '#8A6100', letterSpacing: 0.5 },
  noticeText: { fontSize: 12, color: '#475467', lineHeight: 17 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 12, gap: 4 },
  cardNew: { borderLeftWidth: 4, borderLeftColor: '#1D4ED8' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#0B1F3A', flex: 1 },
  newTag: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', backgroundColor: '#1D4ED8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  body: { fontSize: 13, color: '#344054', lineHeight: 18 },
  meta: { fontSize: 11, color: '#667085' },
  empty: { fontSize: 14, color: '#667085' },
});

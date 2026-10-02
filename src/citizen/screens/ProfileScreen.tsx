import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDefects, useIssues, type MockUser } from '../../api/mockBackend';
import { useNotifications } from '../hooks/useNotifications';

interface Props {
  user: MockUser;
  onPrivacy: () => void;
  onNotifications: () => void;
  onSensors: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({ user, onPrivacy, onNotifications, onSensors, onLogout }: Props) {
  const defects = useDefects();
  const issues = useIssues();
  const { unread } = useNotifications(user.id);
  const reports = defects.reduce((n, d) => n + d.observations.filter((o) => o.reporterId === user.id).length, 0);
  const myIssues = issues.filter((i) => i.reporterId === user.id);

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will return to the role selection screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ROADGUARD AI · CITIZEN</Text>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Account information</Text>
        <Info label="Name" value={user.name} />
        <Info label="Username" value={user.username} />
        <Info label="Account type" value="Citizen reporter" />
        <Info label="Reporter reference" value={user.id} />
        <Text style={styles.note}>Your reporter reference links reports to you. Other citizens cannot see it.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Your activity</Text>
        <Info label="Reports submitted" value={String(reports)} />
        <Info
          label="Issues raised"
          value={`${myIssues.length}${myIssues.length ? ` (${myIssues.filter((i) => i.status === 'UNDER_REVIEW').length} under review)` : ''}`}
        />
      </View>

      <Item
        title={`Notifications${unread ? ` (${unread} new)` : ''}`}
        detail="Status updates on your reports — in-app prototype, not push"
        onPress={onNotifications}
      />
      <Item title="Privacy & Data" detail="What is collected with each report, why, and who can see it" onPress={onPrivacy} />
      <Item title="Motion sensors" detail="Orientation calibration and sensor pipeline (prototype)" onPress={onSensors} />

      <View style={styles.card}>
        <Text style={styles.section}>App information</Text>
        <Info label="Application" value="RoadGuard AI · prototype 1.0.0" />
        <Info label="Purpose" value="Smartphone-based road health intelligence" />
        <Info label="Data" value="Staged demo data — not live government records" />
        <Info label="Map data" value="© OpenStreetMap contributors" />
      </View>

      <Pressable onPress={confirmLogout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Item({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '700', color: '#101828' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  info: { flexDirection: 'row', gap: 8 },
  infoLabel: { width: 130, fontSize: 13, color: '#667085' },
  infoValue: { flex: 1, fontSize: 13, color: '#101828', fontWeight: '500' },
  note: { fontSize: 12, color: '#667085' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 14,
  },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  itemDetail: { fontSize: 12, color: '#667085' },
  chevron: { fontSize: 22, color: '#98A2B3' },
  logout: { borderRadius: 12, borderWidth: 1, borderColor: '#B42318', paddingVertical: 14, alignItems: 'center', backgroundColor: '#FFFFFF' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#B42318' },
});

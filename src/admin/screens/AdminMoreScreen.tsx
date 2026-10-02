import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIssues, type MockUser } from '../../api/mockBackend';
import { runIdentityTests } from '../../services/identityTests';
import { runSystemTests } from '../../services/systemTests';

interface Props {
  user: MockUser;
  onIdentityDemo: () => void;
  onTests: () => void;
  onSecurity: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export default function AdminMoreScreen({ user, onIdentityDemo, onTests, onSecurity, onSettings, onLogout }: Props) {
  const issues = useIssues();
  const openIssues = issues.filter((i) => i.status === 'UNDER_REVIEW').length;
  const tests = useMemo(() => runIdentityTests(), []);
  const system = useMemo(() => runSystemTests(), []);
  const checks = tests.length * 2;
  const passedChecks = tests.reduce(
    (n, t) => n + Number(t.radiusResult === t.radiusExpected) + Number(t.roadframeResult === t.roadframeExpected),
    0,
  );

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will return to the role selection screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ROADGUARD AI · AUTHORITY</Text>
      <Text style={styles.title}>More</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Account</Text>
        <Info label="Signed in as" value={user.name} />
        <Info label="Role" value="Road authority (ADMIN)" />
        <Info label="Account reference" value={user.id} />
        <Text style={styles.note}>Prototype sign-in with a demo account. Not production authentication.</Text>
      </View>

      <Text style={styles.group}>Identity intelligence</Text>
      <Item title="Identity Analysis Engine" detail="Compare radius and road-frame decisions on staged cases" onPress={onIdentityDemo} />
      <Item
        title="Tests"
        detail={`Identity: ${passedChecks}/${checks} engine checks · System scenarios: ${system.filter((t) => t.passed).length}/${system.length}`}
        onPress={onTests}
      />

      <Text style={styles.group}>Governance</Text>
      <Item title="Security & Privacy" detail="Implemented controls, prototype limits, production requirements" onPress={onSecurity} />
      <Item title="Settings" detail="Engine configuration (read-only), data sources, notification delivery" onPress={onSettings} />
      <View style={styles.card}>
        <Info label="Citizen issues open" value={String(openIssues)} />
        <Text style={styles.note}>Issues appear on the related defect's detail screen. Original reports are never altered by an issue.</Text>
      </View>

      <Text style={styles.group}>About</Text>
      <View style={styles.card}>
        <Info label="Application" value="RoadGuard AI · prototype 1.0.0" />
        <Info label="Data" value="Staged demo data held in memory on this device" />
        <Info label="Identity resolution" value="RoadFrame-V1 on mapped roads; Radius-V1 off-network fallback" />
        <Info label="Facilities" value="Staged demo dataset (not real locations)" />
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
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  eyebrow: { fontSize: 12, fontWeight: '800', color: '#0F766E', letterSpacing: 0.8 },
  title: { fontSize: 28, fontWeight: '700', color: '#0B1F3A', marginBottom: 4 },
  group: { fontSize: 12, fontWeight: '800', color: '#667085', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 14,
  },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#0B1F3A' },
  itemDetail: { fontSize: 12, color: '#667085' },
  chevron: { fontSize: 22, color: '#98A2B3' },
  info: { flexDirection: 'row', gap: 8 },
  infoLabel: { width: 130, fontSize: 13, color: '#667085' },
  infoValue: { flex: 1, fontSize: 13, color: '#101828', fontWeight: '500' },
  note: { fontSize: 12, color: '#667085' },
  logout: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#B42318', paddingVertical: 14, alignItems: 'center', backgroundColor: '#FFFFFF' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#B42318' },
});

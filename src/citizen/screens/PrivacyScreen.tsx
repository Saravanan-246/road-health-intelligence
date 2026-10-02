import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const COLLECTED: { item: string; why: string }[] = [
  { item: 'Road image (evidence)', why: 'Evidence is associated with your report for verification. The road authority uses it to confirm the defect.' },
  { item: 'GPS location and its accuracy', why: 'Location is used to identify the reported road position, place the defect on the map and decide whether reports describe the same defect.' },
  { item: 'Defect type', why: 'Selected by you; used to classify the defect and compare it with nearby reports.' },
  { item: 'Severity', why: 'Selected by you; used in the maintenance priority score.' },
  { item: 'Report time', why: 'Orders the evidence and shows the authority how recent the defect is.' },
  {
    item: 'Photo time and source',
    why: 'The capture time from the photo\'s metadata (if present) and whether it came from the camera or gallery, so an old photo can be recognised. Other photo metadata, including any location stored in the photo, is not read or kept.',
  },
  { item: 'Observation ID and Digital Defect ID', why: 'Lets you and the authority track this report and the defect it belongs to.' },
  { item: 'Reporter reference', why: 'Links reports to your account so they appear in My Reports. It is not shown to other citizens.' },
];

const NOT_COLLECTED = [
  'No background location tracking — location is read only while you are reporting or when you tap "Show my GPS position".',
  'The camera opens only when you tap "Take photo"; only the photo you take or choose is attached.',
  'Motion sensors are read only while the Motion sensors screen is open. The readings stay on the phone and are not stored or attached to reports.',
  'No contacts or other files.',
  'Status notifications are generated inside the app; no push-notification service receives your data.',
];

export default function PrivacyScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Privacy & Data</Text>

      <View style={styles.principle}>
        <Text style={styles.principleText}>Your data is used only to process and manage road-defect reports.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>What each report contains, and why</Text>
        {COLLECTED.map((c) => (
          <View key={c.item} style={styles.row}>
            <Text style={styles.item}>{c.item}</Text>
            <Text style={styles.why}>{c.why}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>What is not collected</Text>
        {NOT_COLLECTED.map((n) => (
          <Text key={n} style={styles.bullet}>• {n}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Who can see what</Text>
        <Text style={styles.bullet}>
          • Other citizens see defect records and the road data of each report — type, severity, location and time. They
          do not see your photos or your reporter reference.
        </Text>
        <Text style={styles.bullet}>
          • The road authority sees your report's evidence (image, location, time, type, severity) and a pseudonymous
          reporter reference, which it needs to verify and manage the defect.
        </Text>
        <Text style={styles.bullet}>• Your password is never displayed in the app, to other citizens or to the authority.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>How this prototype stores data</Text>
        <Text style={styles.bullet}>
          • Reports are held in an in-memory demo store on this device and are cleared when the app restarts. No report
          data is sent to a server in this build.
        </Text>
        <Text style={styles.bullet}>
          • Opening a map downloads the map library (from the unpkg CDN) and map tiles (from OpenStreetMap). Tile
          requests reveal the map area on screen to OpenStreetMap's servers; your reports are not sent.
        </Text>
        <Text style={styles.bullet}>
          • Sign-in uses demo accounts. This is a prototype, not production-grade security.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Your controls</Text>
        <Text style={styles.bullet}>
          • Use "Report an issue" on any defect to flag a wrong type, location, severity, image or a duplicate. Your
          original report is not changed or deleted — the issue is sent to the authority for review.
        </Text>
        <Text style={styles.bullet}>
          • You can deny or revoke location permission in your phone settings and enter a location manually instead.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  principle: { backgroundColor: '#E6F4F1', borderRadius: 12, padding: 14 },
  principleText: { fontSize: 15, fontWeight: '700', color: '#0F766E', lineHeight: 21 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  item: { fontSize: 14, fontWeight: '700', color: '#101828' },
  why: { fontSize: 13, color: '#475467', lineHeight: 18 },
  bullet: { fontSize: 13, color: '#475467', lineHeight: 19 },
});

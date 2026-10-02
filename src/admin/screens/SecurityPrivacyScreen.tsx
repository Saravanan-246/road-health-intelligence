import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Status = 'IMPLEMENTED' | 'PROTOTYPE' | 'PRODUCTION';

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  IMPLEMENTED: { label: 'Implemented', color: '#067647', bg: '#E3F4EA' },
  PROTOTYPE: { label: 'Prototype limitation', color: '#8A6100', bg: '#FEF6D8' },
  PRODUCTION: { label: 'Production requirement', color: '#344054', bg: '#EEF0F3' },
};

interface Control {
  status: Status;
  title: string;
  detail: string;
}

/**
 * Only controls that exist in this build are marked IMPLEMENTED. Anything a real deployment
 * needs but this prototype does not do is listed as a production requirement.
 */
const SECTIONS: { title: string; controls: Control[] }[] = [
  {
    title: 'Authentication',
    controls: [
      { status: 'IMPLEMENTED', title: 'Separate citizen and authority sign-in', detail: 'Credentials are checked against the requested role, so a citizen account cannot open the authority console.' },
      { status: 'IMPLEMENTED', title: 'Role-based navigation', detail: 'Authority screens and actions are only mounted after an authority sign-in.' },
      { status: 'IMPLEMENTED', title: 'Passwords never displayed', detail: 'Password fields are masked, and the sign-in function never returns the password to the app.' },
      { status: 'IMPLEMENTED', title: 'Role re-checked on authority actions', detail: 'Status changes, edits, deletions and review or recurrence decisions verify that the acting account is an authority, so bypassing a screen is not enough. In this prototype the check runs on the device.' },
      { status: 'PROTOTYPE', title: 'Demo accounts in the app', detail: 'Demo credentials are defined in the app bundle and checked on the device. This is not secure authentication.' },
      { status: 'PRODUCTION', title: 'Server-side authentication', detail: 'Salted password hashing (e.g. Argon2 or bcrypt), short-lived session tokens, and account lockout after repeated failures.' },
      { status: 'PRODUCTION', title: 'Server-side authorisation', detail: 'Every authority action must be re-checked by the backend. A role or identity claimed by the client must never be trusted.' },
    ],
  },
  {
    title: 'Data protection',
    controls: [
      { status: 'IMPLEMENTED', title: 'Minimal personal data in defect views', detail: 'Reports carry a pseudonymous reporter reference only. No names or contact details appear in defect, map or hotspot views.' },
      { status: 'IMPLEMENTED', title: 'Citizen identity separated from road data', detail: "Citizens see other people's reports only as road-defect records; their photos and reporter references are withheld." },
      { status: 'IMPLEMENTED', title: 'Evidence linked to observation records', detail: 'Each image, location and timestamp stays attached to its observation. Authority edits change defect-level fields only; the evidence itself is never edited (deleting a defect removes it, after confirmation).' },
      { status: 'IMPLEMENTED', title: 'Citizen issues never alter reports', detail: 'A reported issue is queued for authority review; the original report is not changed or deleted.' },
      { status: 'IMPLEMENTED', title: 'Photo metadata minimised', detail: 'Only the capture time is read from a photo\'s metadata. Location and device details in the metadata are not read or kept by the app (the image file itself is not stripped — see below).' },
      { status: 'PROTOTYPE', title: 'In-memory demo store', detail: 'Data lives in memory on this device and is cleared on restart. Nothing is encrypted at rest because nothing is persisted.' },
      { status: 'PRODUCTION', title: 'Transport and storage protection', detail: 'TLS for all API traffic, encryption at rest for evidence images, and a persisted audit log of authority actions.' },
      { status: 'PRODUCTION', title: 'Evidence privacy processing', detail: 'Strip image metadata and blur faces and number plates before evidence is shared; define a retention period.' },
    ],
  },
  {
    title: 'Input security',
    controls: [
      { status: 'IMPLEMENTED', title: 'Validated manual coordinates', detail: 'Latitude and longitude must be numeric and within valid ranges before a report can be submitted.' },
      { status: 'IMPLEMENTED', title: 'Controlled report fields', detail: 'Defect type, severity and issue category are chosen from fixed lists, and the store rejects unknown issue types.' },
      { status: 'IMPLEMENTED', title: 'Reports re-validated by the store', detail: 'Coordinates, accuracy, defect type, severity, time, reporter reference and image are re-checked when a report is stored; invalid reports are rejected with a message and nothing is saved.' },
      { status: 'IMPLEMENTED', title: 'Bounded free text', detail: 'Issue details and authority notes are trimmed and limited to 500 characters.' },
      { status: 'IMPLEMENTED', title: 'Confirmation for destructive actions', detail: 'Deleting a defect, changing maintenance status, reopening a repaired defect and logging out all require confirmation.' },
      { status: 'IMPLEMENTED', title: 'Map content escaped', detail: 'Text shown in map pop-ups is HTML-escaped, and links open in the system browser rather than inside the map.' },
      { status: 'IMPLEMENTED', title: 'Pinned map library', detail: 'The Leaflet map library is loaded with Subresource Integrity hashes.' },
      { status: 'PRODUCTION', title: 'Server-side validation and limits', detail: 'Re-validate every field on the server (client checks can be bypassed), check upload type and size, and rate-limit report submission.' },
    ],
  },
];

export default function SecurityPrivacyScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Security & Privacy</Text>
      <Text style={styles.sub}>What this prototype actually implements, and what a production deployment would require.</Text>

      <View style={styles.legend}>
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <Badge key={s} status={s} />
        ))}
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.section}>{section.title}</Text>
          {section.controls.map((c) => (
            <View key={c.title} style={styles.control}>
              <Badge status={c.status} />
              <Text style={styles.controlTitle}>{c.title}</Text>
              <Text style={styles.controlDetail}>{c.detail}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>
        This build makes no certification or regulatory compliance claims.
      </Text>
    </ScrollView>
  );
}

function Badge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#0B1F3A' },
  sub: { fontSize: 13, color: '#667085', lineHeight: 19 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', padding: 14, gap: 4 },
  section: { fontSize: 13, fontWeight: '800', color: '#344054', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  control: { gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  controlTitle: { fontSize: 14, fontWeight: '700', color: '#101828' },
  controlDetail: { fontSize: 13, color: '#475467', lineHeight: 18 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  footer: { fontSize: 12, color: '#98A2B3', textAlign: 'center' },
});

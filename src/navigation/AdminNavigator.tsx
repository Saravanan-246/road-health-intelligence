import { StyleSheet, Text, View } from 'react-native';

/** Admin experience entry point. Owned by Dharshna; screens live in src/admin/screens. */
export default function AdminNavigator() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.body}>Admin screens are not implemented yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: '#F5F6F8' },
  title: { fontSize: 24, fontWeight: '700', color: '#101828' },
  body: { fontSize: 15, color: '#475467', marginTop: 8 },
});

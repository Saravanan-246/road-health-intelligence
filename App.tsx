import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import CitizenNavigator from './src/navigation/CitizenNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';

type Role = 'CITIZEN' | 'ADMIN';

/**
 * Root: picks which independent experience to mount.
 * TEMPORARY role picker until src/auth/citizen and src/auth/admin logins exist.
 */
export default function App() {
  const [role, setRole] = useState<Role | null>(null);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        {role === 'CITIZEN' ? (
          <CitizenNavigator />
        ) : role === 'ADMIN' ? (
          <AdminNavigator />
        ) : (
          <View style={styles.picker}>
            <Text style={styles.title}>Road Health Intelligence</Text>
            <Pressable style={styles.button} onPress={() => setRole('CITIZEN')}>
              <Text style={styles.buttonText}>Continue as Citizen</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondary]} onPress={() => setRole('ADMIN')}>
              <Text style={[styles.buttonText, styles.secondaryText]}>Continue as Admin</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  picker: { flex: 1, justifyContent: 'center', padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#101828', marginBottom: 12 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD' },
  secondaryText: { color: '#344054' },
});

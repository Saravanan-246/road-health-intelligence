import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import CitizenNavigator from './src/navigation/CitizenNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';
import CitizenLoginScreen from './src/auth/citizen/CitizenLoginScreen';
import AdminLoginScreen from './src/auth/admin/AdminLoginScreen';
import type { MockUser } from './src/api/mockBackend';

type Stage =
  | { name: 'ENTRY' }
  | { name: 'CITIZEN_LOGIN' }
  | { name: 'ADMIN_LOGIN' }
  | { name: 'CITIZEN'; user: MockUser }
  | { name: 'ADMIN'; user: MockUser };

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'ENTRY' });
  const entry = () => setStage({ name: 'ENTRY' });

  // Android back on a login screen returns to role selection instead of closing the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage.name !== 'CITIZEN_LOGIN' && stage.name !== 'ADMIN_LOGIN') return false;
      setStage({ name: 'ENTRY' });
      return true;
    });
    return () => sub.remove();
  }, [stage.name]);

  let screen;
  switch (stage.name) {
    case 'CITIZEN_LOGIN':
      screen = <CitizenLoginScreen onBack={entry} onLogin={(user) => setStage({ name: 'CITIZEN', user })} />;
      break;
    case 'ADMIN_LOGIN':
      screen = <AdminLoginScreen onBack={entry} onLogin={(user) => setStage({ name: 'ADMIN', user })} />;
      break;
    case 'CITIZEN':
      screen = <CitizenNavigator user={stage.user} onLogout={entry} />;
      break;
    case 'ADMIN':
      screen = <AdminNavigator user={stage.user} onLogout={entry} />;
      break;
    default:
      screen = (
        <ScrollView style={styles.entryScroll} contentContainerStyle={styles.entry}>
          <Text style={styles.brand}>ROADGUARD AI</Text>
          <Text style={styles.tagline}>Smartphone-Based Road Health Intelligence</Text>
          <Text style={styles.flow}>Image · GPS · Duplicate analysis · Maintenance priority</Text>
          <Pressable style={styles.button} onPress={() => setStage({ name: 'CITIZEN_LOGIN' })}>
            <Text style={styles.buttonText}>CITIZEN</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => setStage({ name: 'ADMIN_LOGIN' })}>
            <Text style={styles.buttonText}>ADMIN / AUTHORITY</Text>
          </Pressable>
        </ScrollView>
      );
  }

  const dark = stage.name === 'ADMIN_LOGIN' || stage.name === 'ENTRY';
  // Signed-in stages have a bottom tab bar that pads itself for the bottom inset.
  const tabbed = stage.name === 'CITIZEN' || stage.name === 'ADMIN';
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.safe, dark && { backgroundColor: '#0B1F3A' }]}
        edges={tabbed ? ['top', 'left', 'right'] : undefined}
      >
        <StatusBar style={dark ? 'light' : 'dark'} />
        {screen}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  entryScroll: { flex: 1, backgroundColor: '#0B1F3A' },
  entry: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40, gap: 14 },
  brand: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  tagline: { fontSize: 16, color: '#CBD5E1' },
  flow: { fontSize: 13, color: '#5EEAD4', marginBottom: 20 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  secondary: { backgroundColor: '#0F766E' },
});

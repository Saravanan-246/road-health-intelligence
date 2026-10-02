import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, type MockUser } from '../../api/mockBackend';

interface Props {
  onLogin: (user: MockUser) => void;
  onBack: () => void;
}

export default function CitizenLoginScreen({ onLogin, onBack }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = () => {
    const user = login('CITIZEN', username, password);
    if (user) onLogin(user);
    else setError('Invalid username or password.');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.link}>‹ Back</Text>
        </Pressable>
        <View style={styles.body}>
          <Text style={styles.brand}>ROADGUARD AI</Text>
          <Text style={styles.title}>Road observations</Text>
          <Text style={styles.subtitle}>Report road defects from your smartphone</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#98A2B3"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            value={username}
            onChangeText={setUsername}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#98A2B3"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={submit} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
          <Text style={styles.hint}>Demo login: citizen / 123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6F8' },
  container: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', gap: 12, paddingVertical: 24 },
  brand: { fontSize: 13, fontWeight: '800', color: '#0F766E', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#0B1F3A' },
  subtitle: { fontSize: 15, color: '#667085', marginBottom: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#101828',
  },
  error: { color: '#B42318', fontSize: 13 },
  primary: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  hint: { fontSize: 12, color: '#667085', textAlign: 'center' },
});

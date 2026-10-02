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

export default function AdminLoginScreen({ onLogin, onBack }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = () => {
    const user = login('ADMIN', username, password);
    if (user) onLogin(user);
    else setError('Invalid authority credentials.');
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
          <Text style={styles.title}>Authority console</Text>
          <Text style={styles.subtitle}>Review and manage road defects</Text>
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
          <Text style={styles.hint}>Demo login: admin / 123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0B1F3A' },
  container: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  link: { color: '#9EC5FF', fontSize: 15, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', gap: 12, paddingVertical: 24 },
  brand: { fontSize: 13, fontWeight: '800', color: '#5EEAD4', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 15, color: '#CBD5E1', marginBottom: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 16, color: '#101828',
  },
  error: { color: '#FDA29B', fontSize: 13 },
  primary: { backgroundColor: '#0F766E', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  hint: { fontSize: 12, color: '#98A2B3', textAlign: 'center' },
});

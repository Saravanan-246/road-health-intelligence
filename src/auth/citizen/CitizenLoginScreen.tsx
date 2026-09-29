/**
 * CitizenLoginScreen.tsx
 *
 * Email + password login for citizen accounts.
 * On success calls onLogin with the resolved CitizenSession.
 * Real API integration goes through citizenAuthService only — nothing else.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { citizenLogin } from '../../citizen/services/citizenAuthService';
import type { CitizenSession } from '../../citizen/types';

interface Props {
  onLogin: (session: CitizenSession) => void;
}

export default function CitizenLoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailTrimmed = email.trim();
  const canSubmit = emailTrimmed.length > 0 && password.length > 0 && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const session = await citizenLogin({ email: emailTrimmed, password });
      onLogin(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Road Health Intelligence</Text>
          <Text style={styles.title}>Citizen Portal</Text>
          <Text style={styles.subtitle}>Sign in to report road defects</Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#9AA5B1"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9AA5B1"
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!canSubmit) && styles.buttonDisabled,
              pressed && canSubmit && { opacity: 0.85 },
            ]}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

          {!process.env.EXPO_PUBLIC_API_URL ? (
            <View style={styles.devHint}>
              <Text style={styles.devHintText}>
                Dev mode — use: citizen@rhi.dev / any password
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6F8' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 32 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.5, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: '700', color: '#101828' },
  subtitle: { fontSize: 15, color: '#475467', marginTop: 6 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#344054', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#101828',
  },
  errorBox: {
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDCA',
    padding: 12,
  },
  errorText: { fontSize: 14, color: '#B42318' },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  devHint: {
    backgroundColor: '#FEF6D8',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  devHintText: { fontSize: 12, color: '#8A6100', textAlign: 'center' },
});

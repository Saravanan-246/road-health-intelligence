/**
 * AnalysisScreen.tsx
 *
 * Shown immediately after the citizen submits an observation.
 * Provides honest processing states — no fake AI percentages.
 * Designed to connect to real backend progress events later.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import type { ObservationResult } from '../types';

interface Props {
  /** The in-flight promise from citizenObservationService.submitObservation */
  analysisPromise: Promise<ObservationResult>;
  /** Called with the resolved result when analysis succeeds */
  onResult: (result: ObservationResult) => void;
  /** Called with an error message when analysis fails */
  onError: (message: string) => void;
}

const STEPS = [
  'Uploading observation…',
  'Analyzing road condition…',
  'Checking existing reports…',
  'Preparing result…',
];

export default function AnalysisScreen({ analysisPromise, onResult, onError }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Cycle through honest status messages while the promise is pending
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current >= STEPS.length - 1) {
        clearInterval(interval);
        return;
      }
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      current += 1;
      setStepIndex(current);
    }, 900);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  // Resolve the analysis promise
  useEffect(() => {
    let cancelled = false;
    analysisPromise
      .then((result) => {
        if (!cancelled) onResult(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Submission failed. Please try again.';
          onError(msg);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1D4ED8" />
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.step}>{STEPS[stepIndex]}</Text>
      </Animated.View>
      <Text style={styles.note}>This usually takes a few seconds.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 32,
  },
  step: { fontSize: 18, fontWeight: '600', color: '#101828', textAlign: 'center' },
  note: { fontSize: 14, color: '#667085', textAlign: 'center' },
});

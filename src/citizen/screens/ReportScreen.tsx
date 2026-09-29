/**
 * ReportScreen.tsx (Citizen)
 *
 * Complete mobile reporting flow:
 *   Camera / Gallery → Image Preview → GPS → Description → Review → Submit
 *
 * Submission is delegated to citizenObservationService which calls the FastAPI backend.
 * The screen emits onSubmitted(result) so the navigator can transition to AnalysisScreen.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDeviceLocation, manualLocation } from '../services/locationService';
import { submitObservation } from '../services/citizenObservationService';
import { formatCoordinates } from '../utils/distance';
import type { LocationFix } from '../../api/types';
import type { ObservationResult } from '../types';

interface Props {
  onCancel: () => void;
  /** Called with the in-flight promise so AnalysisScreen can track it */
  onSubmitting: (promise: Promise<ObservationResult>) => void;
}

type Step = 'IMAGE' | 'LOCATION' | 'DESCRIPTION' | 'REVIEW';

export default function ReportScreen({ onCancel, onSubmitting }: Props) {
  const [step, setStep] = useState<Step>('IMAGE');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-request GPS on mount
  useEffect(() => { requestLocation(); }, []);

  const hasFix =
    location !== null &&
    location.latitude !== null &&
    location.longitude !== null &&
    location.source !== 'UNLOCATED';

  // ── Image capture ──────────────────────────────────────────────────────────

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    setImageUri(result.assets[0].uri);
    setPickError(null);
    setStep('LOCATION');
  };

  const pickFromGallery = async () => {
    setPickError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
    });
    handleImageResult(result);
  };

  const captureWithCamera = async () => {
    setPickError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPickError('Camera permission denied. Please select from gallery instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    handleImageResult(result);
  };

  // ── Location ───────────────────────────────────────────────────────────────

  const requestLocation = async () => {
    setLocating(true);
    setLocationError(null);
    const fix = await getDeviceLocation();
    setLocation(fix);
    if (fix.source === 'UNLOCATED') {
      setLocationError(fix.error ?? 'Location unavailable.');
    }
    setLocating(false);
  };

  const applyManual = () => {
    const fix = manualLocation(manualLat, manualLon);
    if (fix.source === 'UNLOCATED') {
      setManualError(fix.error ?? 'Invalid coordinates.');
    } else {
      setLocation(fix);
      setManualError(null);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!imageUri || !location) return;
    setSubmitting(true);
    const promise = submitObservation(imageUri, location, description.trim() || undefined);
    onSubmitting(promise);
  };

  // ── Step navigation ────────────────────────────────────────────────────────

  const canProceedToDescription = imageUri !== null && hasFix;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back */}
      <View style={styles.topRow}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.backLink}>‹ Cancel</Text>
        </Pressable>
      </View>
      <Text style={styles.screenTitle}>Report Road Problem</Text>

      {/* ── STEP 1: Image ─────────────────────────────────────────────────── */}
      <SectionHeader number={1} title="Road image" />
      <View style={styles.card}>
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <View style={styles.buttonRow}>
              <StepButton label="Change photo" onPress={pickFromGallery} />
              <StepButton label="Retake" onPress={captureWithCamera} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image selected</Text>
            </View>
            <View style={styles.buttonRow}>
              <StepButton label="Choose from gallery" onPress={pickFromGallery} />
              <StepButton label="Take photo" onPress={captureWithCamera} />
            </View>
          </>
        )}
        {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}
      </View>

      {/* ── STEP 2: Location ──────────────────────────────────────────────── */}
      <SectionHeader number={2} title="Location" />
      <View style={styles.card}>
        {locating ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator color="#1D4ED8" />
            <Text style={styles.mutedText}>Getting device location…</Text>
          </View>
        ) : hasFix && location ? (
          <View style={styles.locationSuccess}>
            <View style={styles.locationDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCoords}>
                {formatCoordinates(location.latitude!, location.longitude!)}
              </Text>
              <Text style={styles.locationMeta}>
                Source: {location.source}
                {location.accuracyMeters !== null
                  ? ` · Accuracy ±${location.accuracyMeters.toFixed(0)} m`
                  : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            {locationError ? (
              <Text style={styles.errorText}>{locationError}</Text>
            ) : (
              <Text style={styles.mutedText}>No location yet.</Text>
            )}
          </View>
        )}

        <StepButton label="Refresh location" onPress={requestLocation} disabled={locating} />

        <View style={styles.divider} />
        <Text style={styles.label}>Manual coordinates (fallback)</Text>
        <View style={styles.buttonRow}>
          <TextInput
            style={styles.coordInput}
            placeholder="Latitude"
            placeholderTextColor="#9AA5B1"
            keyboardType="numbers-and-punctuation"
            value={manualLat}
            onChangeText={setManualLat}
          />
          <TextInput
            style={styles.coordInput}
            placeholder="Longitude"
            placeholderTextColor="#9AA5B1"
            keyboardType="numbers-and-punctuation"
            value={manualLon}
            onChangeText={setManualLon}
          />
        </View>
        {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}
        <StepButton label="Apply manual coordinates" onPress={applyManual} />
      </View>

      {/* ── STEP 3: Description (optional) ───────────────────────────────── */}
      <SectionHeader number={3} title="Description (optional)" />
      <View style={styles.card}>
        <TextInput
          style={styles.descInput}
          placeholder="Describe what you observed, e.g. 'Large pothole near bus stop'"
          placeholderTextColor="#9AA5B1"
          multiline
          maxLength={500}
          value={description}
          onChangeText={setDescription}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      {/* ── STEP 4: Review & Submit ───────────────────────────────────────── */}
      <SectionHeader number={4} title="Review & submit" />
      <View style={styles.card}>
        <ReviewRow label="Image" value={imageUri ? '✓ Image selected' : '✗ No image'} ok={!!imageUri} />
        <ReviewRow
          label="Location"
          value={
            hasFix && location
              ? `✓ ${formatCoordinates(location.latitude!, location.longitude!)}`
              : '✗ No valid location'
          }
          ok={hasFix}
        />
        {description.trim() ? (
          <ReviewRow label="Description" value={description.trim()} ok={true} />
        ) : null}

        {!canProceedToDescription ? (
          <Text style={styles.hint}>
            {!imageUri ? 'An image is required. ' : ''}
            {!hasFix ? 'A valid location is required.' : ''}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canProceedToDescription && styles.submitDisabled,
            pressed && canProceedToDescription && { opacity: 0.85 },
          ]}
          onPress={handleSubmit}
          disabled={!canProceedToDescription || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit Observation</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Small internal components ─────────────────────────────────────────────────

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <Text style={styles.sectionHeader}>
      <Text style={styles.sectionNumber}>{number} · </Text>
      {title}
    </Text>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stepButton,
        disabled && styles.stepButtonDisabled,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.stepButtonText}>{label}</Text>
    </Pressable>
  );
}

function ReviewRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, ok ? styles.reviewOk : styles.reviewBad]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  topRow: { flexDirection: 'row' },
  backLink: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#101828', marginBottom: 8 },

  sectionHeader: { fontSize: 13, color: '#475467', marginTop: 10 },
  sectionNumber: { fontWeight: '700', color: '#344054' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 10,
  },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#EEF0F3' },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: '#EEF0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { fontSize: 14, color: '#9AA5B1' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  stepButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  stepButtonDisabled: { opacity: 0.4 },
  stepButtonText: { fontSize: 14, fontWeight: '600', color: '#344054' },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationSuccess: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#18794E',
  },
  locationCoords: { fontSize: 14, fontWeight: '600', color: '#101828', fontVariant: ['tabular-nums'] },
  locationMeta: { fontSize: 12, color: '#667085', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E4E7EC' },
  label: { fontSize: 13, fontWeight: '600', color: '#475467' },
  coordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#101828',
  },
  descInput: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#101828',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#9AA5B1', textAlign: 'right' },

  reviewRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reviewLabel: { fontSize: 13, fontWeight: '600', color: '#475467', width: 80 },
  reviewValue: { flex: 1, fontSize: 13 },
  reviewOk: { color: '#18794E' },
  reviewBad: { color: '#B42318' },

  hint: { fontSize: 13, color: '#667085', textAlign: 'center' },

  submitButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  errorText: { fontSize: 13, color: '#B42318' },
  mutedText: { fontSize: 13, color: '#667085' },
});

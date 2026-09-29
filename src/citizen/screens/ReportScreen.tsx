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
import { detectRoadDefect, type DetectionResult } from '../services/devMock/detectionService';
import { getDeviceLocation, manualLocation } from '../services/locationService';
import { findBestDuplicate, type DuplicateMatch } from '../services/devMock/duplicateService';
import { makeId } from '../services/devMock/defectService';
import { formatCoordinates } from '../utils/distance';
import {
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type Defect,
  type DefectType,
  type LocationFix,
  type Observation,
  type Severity,
} from '../../api/types';

interface Props {
  defects: Defect[];
  onCancel: () => void;
  /** mergeIntoId null → create a new defect record. */
  onCommit: (observation: Observation, mergeIntoId: string | null) => void;
}

interface Pending {
  observation: Observation;
  match: DuplicateMatch | null;
}

const DEFECT_TYPES = Object.keys(DEFECT_TYPE_LABELS) as DefectType[];
const SEVERITIES = Object.keys(SEVERITY_LABELS) as Severity[];

export default function ReportScreen({ defects, onCancel, onCommit }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [defectType, setDefectType] = useState<DefectType>('POTHOLE');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const requestLocation = async () => {
    setLocating(true);
    setLocation(await getDeviceLocation());
    setLocating(false);
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleImage = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    setImageUri(uri);
    setPending(null);
    const d = await detectRoadDefect(uri);
    setDetection(d);
    if (d.source === 'MODEL') {
      if (d.defectType) setDefectType(d.defectType);
      if (d.severity) setSeverity(d.severity);
    }
  };

  const pickFromGallery = async () => {
    setPickError(null);
    handleImage(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }));
  };

  const captureWithCamera = async () => {
    setPickError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPickError('Camera permission denied — select from gallery instead.');
      return;
    }
    handleImage(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }));
  };

  const applyManual = () => {
    const fix = manualLocation(manualLat, manualLon);
    setManualError(fix.error ?? null);
    if (fix.source === 'MANUAL') setLocation(fix);
  };

  const hasFix =
    location !== null && location.latitude !== null && location.longitude !== null && location.source !== 'UNLOCATED';
  const canCreate = imageUri !== null && hasFix;

  const createObservation = () => {
    if (!imageUri || !location || location.latitude === null || location.longitude === null) return;
    if (location.source === 'UNLOCATED') return;
    const fromModel = detection?.source === 'MODEL';
    const observation: Observation = {
      id: makeId('OB'),
      imageUri,
      defectType,
      severity,
      confidence: fromModel ? detection.confidence : null,
      classificationSource: fromModel ? 'MODEL' : 'REPORTER',
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
      locationSource: location.source,
      timestamp: Date.now(),
    };
    setPending({ observation, match: findBestDuplicate(observation, defects) });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.link}>‹ Back</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Report Road Problem</Text>

      {/* 1. Image */}
      <Text style={styles.section}>1 · Road image</Text>
      <View style={styles.card}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
        <View style={styles.buttonRow}>
          <Button label="Choose from gallery" onPress={pickFromGallery} />
          <Button label="Take photo" onPress={captureWithCamera} />
        </View>
        {pickError ? <Text style={styles.error}>{pickError}</Text> : null}
      </View>

      {/* 2. Detection / classification */}
      <Text style={styles.section}>2 · Defect assessment</Text>
      <View style={styles.card}>
        {detection ? (
          <View style={[styles.notice, detection.source === 'MODEL' ? styles.noticeOk : styles.noticeWarn]}>
            <Text style={styles.noticeTitle}>
              Detector: {detection.source === 'MODEL' ? 'MODEL' : 'UNAVAILABLE (demo mode)'}
            </Text>
            <Text style={styles.noticeText}>
              {detection.message}
              {detection.source === 'MODEL' && detection.confidence !== null
                ? ` Confidence ${(detection.confidence * 100).toFixed(0)}%.`
                : ''}
              {detection.source === 'MODEL' && detection.isDefect === false
                ? ' Model found no defect — confirm before submitting.'
                : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Add an image to run detection.</Text>
        )}
        <Text style={styles.label}>Defect type</Text>
        <View style={styles.chips}>
          {DEFECT_TYPES.map((t) => (
            <Chip key={t} label={DEFECT_TYPE_LABELS[t]} selected={defectType === t} onPress={() => setDefectType(t)} />
          ))}
        </View>
        <Text style={styles.label}>Severity</Text>
        <View style={styles.chips}>
          {SEVERITIES.map((s) => (
            <Chip key={s} label={SEVERITY_LABELS[s]} selected={severity === s} onPress={() => setSeverity(s)} />
          ))}
        </View>
      </View>

      {/* 3. Location */}
      <Text style={styles.section}>3 · Location</Text>
      <View style={styles.card}>
        {locating ? (
          <View style={styles.inline}>
            <ActivityIndicator />
            <Text style={styles.muted}>Getting device location…</Text>
          </View>
        ) : hasFix && location ? (
          <View>
            <Text style={styles.value}>{formatCoordinates(location.latitude!, location.longitude!)}</Text>
            <Text style={styles.muted}>
              Source: {location.source} · Accuracy:{' '}
              {location.accuracyMeters !== null ? `±${location.accuracyMeters.toFixed(0)} m` : 'unknown'}
            </Text>
          </View>
        ) : (
          <Text style={styles.error}>{location?.error ?? 'No location yet.'} Observation is UNLOCATED.</Text>
        )}
        <Button label="Use device location" onPress={requestLocation} disabled={locating} />

        <Text style={styles.label}>Manual fallback</Text>
        <View style={styles.buttonRow}>
          <TextInput
            style={styles.input}
            placeholder="Latitude"
            keyboardType="numbers-and-punctuation"
            value={manualLat}
            onChangeText={setManualLat}
          />
          <TextInput
            style={styles.input}
            placeholder="Longitude"
            keyboardType="numbers-and-punctuation"
            value={manualLon}
            onChangeText={setManualLon}
          />
        </View>
        {manualError ? <Text style={styles.error}>{manualError}</Text> : null}
        <Button label="Set manual location" onPress={applyManual} />
      </View>

      {/* 4. Create observation + duplicate check */}
      {!pending ? (
        <>
          <Button label="Create Observation" onPress={createObservation} disabled={!canCreate} primary />
          {!canCreate ? (
            <Text style={styles.hint}>An image and a location are required.</Text>
          ) : null}
        </>
      ) : (
        <DuplicatePanel
          pending={pending}
          onCommit={(mergeIntoId) => onCommit(pending.observation, mergeIntoId)}
          onEdit={() => setPending(null)}
        />
      )}
    </ScrollView>
  );
}

function DuplicatePanel({
  pending,
  onCommit,
  onEdit,
}: {
  pending: Pending;
  onCommit: (mergeIntoId: string | null) => void;
  onEdit: () => void;
}) {
  const { match } = pending;
  return (
    <View style={styles.card}>
      <Text style={styles.section}>Duplicate check</Text>
      {match ? (
        <>
          <Text style={styles.value}>
            {match.analysis.decision} · score {match.analysis.score.toFixed(2)} · {match.analysis.distanceMeters.toFixed(1)} m
            from {match.defect.id}
          </Text>
          {match.analysis.reasons.map((r) => (
            <Text key={r} style={styles.reason}>• {r}</Text>
          ))}
          {match.analysis.decision === 'REVIEW' ? (
            <Text style={styles.hint}>Evidence is inconclusive — reporter decides.</Text>
          ) : null}
          <Button
            label={`Add as evidence to ${match.defect.id}`}
            onPress={() => onCommit(match.defect.id)}
            primary={match.analysis.decision === 'MERGE'}
          />
          <Button label="Create separate defect record" onPress={() => onCommit(null)} />
        </>
      ) : (
        <>
          <Text style={styles.muted}>No existing defect within the candidate gate — DISTINCT.</Text>
          <Button label="Create Defect Record" onPress={() => onCommit(null)} primary />
        </>
      )}
      <Pressable onPress={onEdit} hitSlop={8}>
        <Text style={[styles.link, { textAlign: 'center', marginTop: 4 }]}>Edit observation</Text>
      </Pressable>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  topRow: { flexDirection: 'row' },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#101828', marginBottom: 4 },
  section: { fontSize: 14, fontWeight: '600', color: '#344054', marginTop: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 10,
  },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#EEF0F3' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: {
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8', paddingVertical: 15 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#344054' },
  buttonTextPrimary: { color: '#FFFFFF', fontSize: 16 },
  notice: { borderRadius: 8, padding: 10, gap: 2 },
  noticeOk: { backgroundColor: '#E3F4EA' },
  noticeWarn: { backgroundColor: '#FEF6D8' },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#101828' },
  noticeText: { fontSize: 13, color: '#344054' },
  label: { fontSize: 13, fontWeight: '600', color: '#475467' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { fontSize: 13, color: '#344054' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 15, fontWeight: '600', color: '#101828', fontVariant: ['tabular-nums'] },
  muted: { fontSize: 13, color: '#667085' },
  error: { fontSize: 13, color: '#B42318' },
  hint: { fontSize: 13, color: '#667085', textAlign: 'center' },
  reason: { fontSize: 13, color: '#475467' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#101828',
  },
});

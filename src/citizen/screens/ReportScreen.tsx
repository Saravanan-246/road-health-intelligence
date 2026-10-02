import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  getDeviceLocation,
  manualLocation,
} from '../services/locationService';

import {
  extractExifGps,
  exifGpsToLocationFix,
  hasExifGps,
} from '../services/exifGpsService';

import {
  submitObservation,
  type SubmitResult,
} from '../../api/mockBackend';

import {
  imageAssessmentDiffers,
  validateRoadImage,
  type ImageValidationResult,
} from '../../api/imageValidation';

import { formatCoordinates } from '../utils/distance';
import { STALE_PHOTO_DAYS } from '../../services/evidenceIntegrity';

import {
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type DefectType,
  type LocationFix,
  type Severity,
} from '../../api/types';

interface Props {
  reporterId: string;
  onCancel: () => void;
  onSubmitted: (result: SubmitResult) => void;
}

interface ImageMetadata {
  source: 'CAMERA' | 'GALLERY';
  capturedAt: number | null;
  exifGps: {
    latitude: number;
    longitude: number;
  } | null;
  hasExifGps: boolean;
  fileName?: string | null;
  mimeType?: string | null;
}

const DEFECT_TYPES = Object.keys(
  DEFECT_TYPE_LABELS,
) as DefectType[];

const SEVERITIES = Object.keys(
  SEVERITY_LABELS,
) as Severity[];

const LOW_ACCURACY_METERS = 20;

function exifCaptureTime(
  exif: Record<string, unknown> | null | undefined,
): number | null {
  if (!exif) return null;

  const nested = (exif['{Exif}'] ?? {}) as Record<
    string,
    unknown
  >;

  const raw =
    exif.DateTimeOriginal ??
    nested.DateTimeOriginal ??
    exif.DateTime;

  if (typeof raw !== 'string') {
    return null;
  }

  const match = raw.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) {
    return null;
  }

  const timestamp = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

export default function ReportScreen({
  reporterId,
  onCancel,
  onSubmitted,
}: Props) {
  const [imageUri, setImageUri] =
    useState<string | null>(null);

  const [imageMeta, setImageMeta] =
    useState<ImageMetadata | null>(null);

  const [imageValidation, setImageValidation] =
    useState<ImageValidationResult | null>(null);

  const [validationLoading, setValidationLoading] =
    useState(false);

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const [defectType, setDefectType] =
    useState<DefectType>('POTHOLE');

  const [severity, setSeverity] =
    useState<Severity>('MEDIUM');

  const [location, setLocation] =
    useState<LocationFix | null>(null);

  const [locating, setLocating] =
    useState(false);

  const [manualLat, setManualLat] =
    useState('');

  const [manualLon, setManualLon] =
    useState('');

  const [manualError, setManualError] =
    useState<string | null>(null);

  const [pickError, setPickError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const [locationKind, setLocationKind] =
    useState<'GPS' | 'MANUAL' | 'EXIF' | null>(null);

  const [showLocationConfirm, setShowLocationConfirm] =
    useState(false);

  const pendingImageMeta =
    useRef<ImageMetadata | null>(null);

  const validationRequest = useRef(0);

  const locationRequest = useRef(0);

  const requestLocation = async () => {
    const requestId = ++locationRequest.current;

    setLocating(true);
    setManualError(null);

    try {
      const fix = await getDeviceLocation();

      if (requestId !== locationRequest.current) {
        return;
      }

      setLocation(fix);

      if (fix.source === 'DEVICE') {
        setLocationKind('GPS');
      } else {
        setLocationKind(null);
      }
    } catch {
      if (requestId === locationRequest.current) {
        setLocation(null);
        setLocationKind(null);
      }
    } finally {
      if (requestId === locationRequest.current) {
        setLocating(false);
      }
    }
  };

  const cancelPendingGps = () => {
    locationRequest.current++;
    setLocating(false);
  };

  useEffect(() => {
    void requestLocation();

    return () => {
      validationRequest.current++;
      locationRequest.current++;
    };
  }, []);

  const runImageValidation = async (
    uri: string,
    fileName?: string | null,
    mimeType?: string | null,
  ) => {
    const requestId = ++validationRequest.current;

    setImageValidation(null);
    setValidationError(null);
    setValidationLoading(true);

    try {
      const result = await validateRoadImage(
        uri,
        fileName,
        mimeType,
      );

      if (requestId === validationRequest.current) {
        setImageValidation(result);

        if (
          result.status === 'VALID' &&
          result.defect_type
        ) {
          const detectedType =
            result.defect_type as DefectType;

          if (DEFECT_TYPE_LABELS[detectedType]) {
            setDefectType(detectedType);
          }
        }
      }
    } catch {
      if (requestId === validationRequest.current) {
        setValidationError(
          'Image analysis is currently unavailable. Please try again.',
        );
      }
    } finally {
      if (requestId === validationRequest.current) {
        setValidationLoading(false);
      }
    }
  };

  const resetImageState = () => {
    validationRequest.current++;

    setImageUri(null);
    setImageMeta(null);
    setImageValidation(null);
    setValidationError(null);
    setValidationLoading(false);

    pendingImageMeta.current = null;
    setShowLocationConfirm(false);
  };

   const handleImage = async (
    result: ImagePicker.ImagePickerResult,
    source: 'CAMERA' | 'GALLERY',
  ) => {
    if (
      result.canceled ||
      !result.assets?.length
    ) {
      return;
    }

    const asset = result.assets[0];

    const uri = asset.uri;
    const exif = asset.exif;

    const capturedAt = exifCaptureTime(exif);

    const exifHasGps = hasExifGps(exif);

    // Extract the complete EXIF GPS object.
    const extractedExifGps = exifHasGps
      ? extractExifGps(exif)
      : null;

    // Keep EXIF GPS only when latitude and longitude
    // are valid finite numbers.
    const validExifGpsData =
      extractedExifGps !== null &&
      typeof extractedExifGps.latitude === 'number' &&
      Number.isFinite(extractedExifGps.latitude) &&
      typeof extractedExifGps.longitude === 'number' &&
      Number.isFinite(extractedExifGps.longitude)
        ? extractedExifGps
        : null;

    // ImageMetadata stores only the coordinates needed
    // by the UI, with guaranteed number types.
    const exifCoordinates: {
      latitude: number;
      longitude: number;
    } | null =
      validExifGpsData !== null
        ? {
            latitude: validExifGpsData.latitude,
            longitude: validExifGpsData.longitude,
          }
        : null;

    const meta: ImageMetadata = {
      source,
      capturedAt,
      exifGps: exifCoordinates,
      hasExifGps: validExifGpsData !== null,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    };

    // New image = new evidence context.
    // Prevent previous image/location/validation data
    // from being reused.
    locationRequest.current++;

    setLocation(null);
    setLocationKind(null);
    setManualError(null);

    setImageUri(uri);
    setImageMeta(meta);

    // Automatically validate the newly selected image.
    void runImageValidation(
      uri,
      meta.fileName,
      meta.mimeType,
    );

    // -----------------------------------------
    // CAMERA PHOTO
    // -----------------------------------------
    if (source === 'CAMERA') {
      pendingImageMeta.current = null;

      const requestId =
        ++locationRequest.current;

      setLocating(true);

      try {
        const fix = await getDeviceLocation();

        if (
          requestId !==
          locationRequest.current
        ) {
          return;
        }

        setLocation(fix);

        if (fix.source === 'DEVICE') {
          setLocationKind('GPS');
        } else {
          setLocationKind(null);
        }
      } catch {
        if (
          requestId ===
          locationRequest.current
        ) {
          setLocation(null);
          setLocationKind(null);
        }
      } finally {
        if (
          requestId ===
          locationRequest.current
        ) {
          setLocating(false);
        }
      }

      return;
    }

    // -----------------------------------------
    // GALLERY PHOTO WITH EXIF GPS
    // -----------------------------------------
    if (validExifGpsData !== null) {
      cancelPendingGps();

      // Pass the COMPLETE EXIF GPS object here.
      // exifGpsToLocationFix() expects the full
      // ExifGpsData structure.
      const exifLocation =
        exifGpsToLocationFix(
          validExifGpsData,
        );

      setLocation(exifLocation);
      setLocationKind('EXIF');

      pendingImageMeta.current = null;
      setShowLocationConfirm(false);

      return;
    }

    // -----------------------------------------
    // GALLERY PHOTO WITHOUT EXIF GPS
    // -----------------------------------------
    pendingImageMeta.current = meta;
    setShowLocationConfirm(true);
  };

  const pickFromGallery = async () => {
    setPickError(null);

    try {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: ['images'],
            quality: 0.7,
            exif: true,
          },
        );

      await handleImage(
        result,
        'GALLERY',
      );
    } catch (error) {
      setPickError(
        error instanceof Error
          ? `Unable to open gallery: ${error.message}`
          : 'Unable to open gallery',
      );
    }
  };
  const captureWithCamera = async () => {
    setPickError(null);

    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setPickError(
          'Camera permission denied. Please allow camera access.',
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync(
          {
            mediaTypes: ['images'],
            quality: 0.7,
            exif: true,
          },
        );

      await handleImage(
        result,
        'CAMERA',
      );
    } catch (error) {
      setPickError(
        error instanceof Error
          ? `Unable to open camera: ${error.message}`
          : 'Unable to open camera',
      );
    }
  };

  const confirmUseCurrentLocation =
    async () => {
      setShowLocationConfirm(false);

      if (!pendingImageMeta.current) {
        return;
      }

      const requestId =
        ++locationRequest.current;

      setLocating(true);
      setLocation(null);

      try {
        const fix =
          await getDeviceLocation();

        if (
          requestId !==
          locationRequest.current
        ) {
          return;
        }

        setLocation(fix);

        setLocationKind(
          fix.source === 'DEVICE'
            ? 'GPS'
            : null,
        );
      } finally {
        if (
          requestId ===
          locationRequest.current
        ) {
          setLocating(false);
        }
      }

      pendingImageMeta.current = null;
    };

  const rejectGalleryImage = () => {
    setShowLocationConfirm(false);
    pendingImageMeta.current = null;

    resetImageState();
  };

  useEffect(() => {
    if (
      showLocationConfirm &&
      pendingImageMeta.current &&
      !pendingImageMeta.current.hasExifGps
    ) {
      Alert.alert(
        'Photo Location',
        'This photo does not contain GPS metadata. Use your current device location for this report?',
        [
          {
            text: 'Choose another photo',
            onPress:
              rejectGalleryImage,
            style: 'cancel',
          },
          {
            text: 'Use Current Location',
            onPress:
              confirmUseCurrentLocation,
          },
        ],
      );
    }
  }, [showLocationConfirm]);

  const applyManual = () => {
    const fix = manualLocation(
      manualLat.trim(),
      manualLon.trim(),
    );

    setManualError(
      fix.error ?? null,
    );

    if (fix.source === 'MANUAL') {
      cancelPendingGps();

      setLocation(fix);
      setLocationKind('MANUAL');
    }
  };

  const hasFix =
    location !== null &&
    location.latitude !== null &&
    location.longitude !== null &&
    location.source !== 'UNLOCATED';

  const imageIsValid =
    imageValidation?.valid === true &&
    imageValidation.status === 'VALID';

  const canCreate =
    imageUri !== null &&
    hasFix &&
    imageIsValid &&
    !validationLoading &&
    !submitting;

  const submit = () => {
    if (!imageUri) {
      return;
    }

    if (
      !location ||
      location.latitude === null ||
      location.longitude === null ||
      location.source === 'UNLOCATED'
    ) {
      setSubmitError(
        'A valid location is required before submission.',
      );
      return;
    }

    if (!imageIsValid) {
      setSubmitError(
        'Please validate the road image before submission.',
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result =
        submitObservation({
          reporterId,

          imageUri,

          defectType,

          severity,

          confidence: null,

          classificationSource:
            'REPORTER',

          latitude:
            location.latitude,

          longitude:
            location.longitude,

          accuracyMeters:
            location.accuracyMeters,

          locationSource:
            location.source as
              | 'EXIF'
              | 'DEVICE'
              | 'MANUAL',

          imageSource:
            imageMeta?.source,

          imageCapturedAt:
            imageMeta?.capturedAt ??
            null,

          imageValidation: {
            status:
              imageValidation.status,

            imageType:
              imageValidation.image_type,

            defectType:
              imageValidation.defect_type,

            reason:
              imageValidation.reason,

            referenceMatch:
              imageValidation.reference_match,

            referenceSimilarity:
              imageValidation.reference_similarity,

            analyzedAt:
              imageValidation.analyzed_at,
          },

          timestamp: Date.now(),
        });

      onSubmitted(result);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `Unable to submit report: ${error.message}`
          : 'Unable to submit report',
      );

      setSubmitting(false);
    }
  };

  const isStalePhoto =
    Boolean(imageMeta?.capturedAt) &&
    Date.now() -
      Number(imageMeta?.capturedAt) >
      STALE_PHOTO_DAYS *
        24 *
        60 *
        60 *
        1000;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}
        <View style={styles.topRow}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
          >
            <Text style={styles.link}>
              ‹ Back
            </Text>
          </Pressable>
        </View>

        <Text style={styles.title}>
          Report Road Problem
        </Text>

        {/* ================================
            1. ROAD IMAGE
            ================================ */}

        <Text style={styles.section}>
          1 · Road image
        </Text>

        <View style={styles.card}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
            />
          ) : (
            <View
              style={
                styles.imagePlaceholder
              }
            >
              <Text
                style={
                  styles.placeholderTitle
                }
              >
                Add road evidence
              </Text>

              <Text style={styles.muted}>
                Take a photo or choose an
                image of the road defect.
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              label="Choose from gallery"
              onPress={
                pickFromGallery
              }
            />

            <Button
              label="Take photo"
              onPress={
                captureWithCamera
              }
            />
          </View>

          {pickError ? (
            <Text style={styles.error}>
              {pickError}
            </Text>
          ) : null}

          {imageUri && imageMeta ? (
            <View
              style={
                styles.metaBlock
              }
            >
              <Text style={styles.muted}>
                {imageMeta.source ===
                'CAMERA'
                  ? 'Captured with camera'
                  : 'Selected from gallery'}
              </Text>

              {imageMeta.exifGps ? (
                <View
                  style={[
                    styles.notice,
                    styles.noticeOk,
                  ]}
                >
                  <Text
                    style={
                      styles.noticeTitle
                    }
                  >
                    PHOTO LOCATION DETECTED
                  </Text>

                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    GPS metadata:{' '}
                    {formatCoordinates(
                      imageMeta.exifGps
                        .latitude,
                      imageMeta.exifGps
                        .longitude,
                    )}
                  </Text>
                </View>
              ) : imageMeta.source ===
                'GALLERY' ? (
                <Text
                  style={styles.muted}
                >
                  No GPS metadata found
                  in photo.
                </Text>
              ) : null}

              <Text style={styles.muted}>
                Photo time:{' '}
                {imageMeta.capturedAt
                  ? new Date(
                      imageMeta.capturedAt,
                    ).toLocaleString()
                  : 'Not available'}
              </Text>

              {isStalePhoto ? (
                <View
                  style={[
                    styles.notice,
                    styles.noticeWarn,
                  ]}
                >
                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    This is an older photo.
                    A recent image provides
                    stronger road evidence.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text
            style={styles.privacyHint}
          >
            Photo location is used to
            identify the reported road
            position.
          </Text>
        </View>

        {/* ================================
            2. DEFECT ASSESSMENT
            ================================ */}

        <Text style={styles.section}>
          2 · Defect assessment
        </Text>

        <View style={styles.card}>
          {imageIsValid ? (
            <>
              {imageAssessmentDiffers(
                imageValidation,
                defectType,
              ) ? (
                <View
                  style={[
                    styles.notice,
                    styles.noticeWarn,
                  ]}
                >
                  <Text
                    style={
                      styles.noticeTitle
                    }
                  >
                    ASSESSMENT DIFFERENCE
                  </Text>

                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    The image assessment
                    differs from your
                    selected defect type.
                  </Text>

                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    Image:{' '}
                    {imageValidation?.defect_type
                      ? DEFECT_TYPE_LABELS[
                          imageValidation
                            .defect_type as DefectType
                        ]
                      : 'Unclassified'}
                    {' · '}
                    Selected:{' '}
                    {
                      DEFECT_TYPE_LABELS[
                        defectType
                      ]
                    }
                  </Text>
                </View>
              ) : null}

              <Text style={styles.label}>
                Defect type
              </Text>

              <View style={styles.chips}>
                {DEFECT_TYPES.map(
                  (type) => (
                    <Chip
                      key={type}
                      label={
                        DEFECT_TYPE_LABELS[
                          type
                        ]
                      }
                      selected={
                        defectType ===
                        type
                      }
                      onPress={() =>
                        setDefectType(
                          type,
                        )
                      }
                    />
                  ),
                )}
              </View>

              <Text style={styles.label}>
                Severity
              </Text>

              <View style={styles.chips}>
                {SEVERITIES.map(
                  (level) => (
                    <Chip
                      key={level}
                      label={
                        SEVERITY_LABELS[
                          level
                        ]
                      }
                      selected={
                        severity ===
                        level
                      }
                      onPress={() =>
                        setSeverity(
                          level,
                        )
                      }
                    />
                  ),
                )}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>
              Defect assessment becomes
              available after the road
              image is validated.
            </Text>
          )}
        </View>

        {/* ================================
            4. LOCATION
            ================================ */}

        <Text style={styles.section}>
          3 · Location
        </Text>

        <View style={styles.card}>
          {locating ? (
            <View style={styles.inline}>
              <ActivityIndicator />

              <Text style={styles.muted}>
                Getting device location...
              </Text>
            </View>
          ) : null}

          {!locating &&
          hasFix &&
          location ? (
            <View>
              <Text style={styles.label}>
                {locationKind === 'EXIF'
                  ? 'LOCATION FROM PHOTO'
                  : locationKind === 'GPS'
                    ? 'LOCATION DETECTED'
                    : 'MANUAL LOCATION'}
              </Text>

              <Text
                style={styles.value}
              >
                {formatCoordinates(
                  location.latitude!,
                  location.longitude!,
                )}
              </Text>

              <Text style={styles.muted}>
                Source:{' '}
                {locationKind === 'EXIF'
                  ? 'Image GPS'
                  : location.source}
                {' · '}
                Accuracy:{' '}
                {location.accuracyMeters !==
                null
                  ? `±${location.accuracyMeters.toFixed(
                      0,
                    )} m`
                  : 'unknown'}
              </Text>

              {locationKind !==
                'EXIF' &&
              (location.accuracyMeters ===
                null ||
                location.accuracyMeters >
                  LOW_ACCURACY_METERS) ? (
                <View
                  style={[
                    styles.notice,
                    styles.noticeWarn,
                    { marginTop: 8 },
                  ]}
                >
                  <Text
                    style={
                      styles.noticeText
                    }
                  >
                    {location.accuracyMeters ===
                    null
                      ? 'Location accuracy is unknown.'
                      : `Location accuracy is low (±${location.accuracyMeters.toFixed(
                          0,
                        )} m).`}{' '}
                    Identity matching may
                    require review.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!locating && !hasFix ? (
            <View
              style={[
                styles.notice,
                styles.noticeWarn,
              ]}
            >
              <Text
                style={
                  styles.noticeTitle
                }
              >
                LOCATION REQUIRED
              </Text>

              <Text
                style={
                  styles.noticeText
                }
              >
                Enable device location or
                provide a location manually.
              </Text>
            </View>
          ) : null}

          <Button
            label={
              locating
                ? 'Getting location...'
                : 'Use device location'
            }
            onPress={requestLocation}
            disabled={locating}
          />

          <Text style={styles.label}>
            Manual fallback
          </Text>

          <View style={styles.buttonRow}>
            <TextInput
              style={styles.input}
              placeholder="Latitude"
              keyboardType="numbers-and-punctuation"
              value={manualLat}
              onChangeText={
                setManualLat
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Longitude"
              keyboardType="numbers-and-punctuation"
              value={manualLon}
              onChangeText={
                setManualLon
              }
            />
          </View>

          {manualError ? (
            <Text style={styles.error}>
              {manualError}
            </Text>
          ) : null}

          <Button
            label="Set manual location"
            onPress={applyManual}
          />

          <Text
            style={styles.privacyHint}
          >
            Location is used to identify
            the reported road position and
            support identity matching.
          </Text>
        </View>

        {/* ================================
            5. REVIEW & SUBMIT
            ================================ */}

        <Text style={styles.section}>
          4 · Review & submit
        </Text>

        <View style={styles.card}>
          <Text style={styles.muted}>
            Image:{' '}
            {imageUri
              ? 'Attached'
              : 'Not attached'}
            {' · '}
            Location:{' '}
            {hasFix
              ? 'Set'
              : 'Not set'}
          </Text>

          <Text style={styles.muted}>
            {DEFECT_TYPE_LABELS[
              defectType
            ]}{' '}
            /{' '}
            {SEVERITY_LABELS[
              severity
            ]}
          </Text>

          <View
            style={styles.privacyBox}
          >
            <Text
              style={styles.privacyTitle}
            >
              Privacy & data use
            </Text>

            <Text
              style={styles.privacyText}
            >
              This report uses the image,
              location, accuracy, defect type,
              severity and time to process
              the road-defect report.
            </Text>
          </View>
        </View>

        <Button
          label={
            submitting
              ? 'Submitting...'
              : 'Submit Report'
          }
          onPress={submit}
          disabled={!canCreate}
          primary
        />

        {!imageUri ? (
          <Text style={styles.hint}>
            Add a road image to continue.
          </Text>
        ) : null}

        {imageUri && validationError ? (
          <Text style={styles.hint}>
            Retry image analysis before
            continuing.
          </Text>
        ) : null}

        {imageUri &&
        imageValidation?.status ===
          'INVALID' ? (
          <Text style={styles.hint}>
            A valid road-defect image is
            required.
          </Text>
        ) : null}

        {imageUri &&
        imageValidation?.status ===
          'REVIEW_REQUIRED' ? (
          <Text style={styles.hint}>
            Image analysis requires review
            before submission.
          </Text>
        ) : null}

        {imageValidation?.status ===
          'VALID' &&
        !hasFix ? (
          <Text style={styles.hint}>
            A location is required before
            submission.
          </Text>
        ) : null}

        {submitError ? (
          <Text style={styles.error}>
            {submitError}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
        primary &&
          styles.buttonPrimary,
        disabled &&
          styles.buttonDisabled,
        pressed &&
          styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          primary &&
            styles.buttonTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected &&
          styles.chipSelected,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected &&
            styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },

  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 10,
  },

  topRow: {
    flexDirection: 'row',
  },

  link: {
    color: '#1D4ED8',
    fontSize: 15,
    fontWeight: '600',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 4,
  },

  section: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginTop: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 10,
  },

  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: '#EEF0F3',
  },

  imagePlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },

  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#344054',
  },

  metaBlock: {
    gap: 6,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },

  button: {
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },

  buttonPrimary: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    paddingVertical: 15,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#344054',
  },

  buttonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  notice: {
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },

  noticeOk: {
    backgroundColor: '#E3F4EA',
  },

  noticeWarn: {
    backgroundColor: '#FEF6D8',
  },

  noticeError: {
    backgroundColor: '#FEF3F2',
  },

  noticeNeutral: {
    backgroundColor: '#F2F4F7',
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101828',
  },

  noticeText: {
    fontSize: 13,
    color: '#344054',
    lineHeight: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475467',
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  chipSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },

  chipText: {
    fontSize: 13,
    color: '#344054',
  },

  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#101828',
    fontVariant: ['tabular-nums'],
  },

  muted: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
  },

  error: {
    fontSize: 13,
    color: '#B42318',
    lineHeight: 18,
  },

  hint: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  privacyHint: {
    fontSize: 12,
    color: '#667085',
    lineHeight: 17,
  },

  privacyBox: {
    backgroundColor: '#E6F4F1',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },

  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },

  privacyText: {
    fontSize: 12,
    color: '#344054',
    lineHeight: 17,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#FFFFFF',
  },
});
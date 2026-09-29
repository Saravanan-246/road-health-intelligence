/**
 * citizenObservationService.ts
 *
 * Submits a new road defect observation to the backend.
 * Dev adapter is active when EXPO_PUBLIC_API_URL is not set.
 *
 * Correct dependency flow:
 *   ReportScreen → citizenObservationService → src/api/client.ts → FastAPI
 */

import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import type { ObservationRequest, ObservationResult } from '../types';
import type { LocationFix } from '../../api/types';

// ---------------------------------------------------------------------------
// TEMPORARY DEV ADAPTER
// Remove this block and the devSubmitObservation function when
// POST /observations is live. Replace with realSubmitObservation only.
// ---------------------------------------------------------------------------
const DEV_MODE = !process.env.EXPO_PUBLIC_API_URL;

async function devSubmitObservation(req: ObservationRequest): Promise<ObservationResult> {
  // Lazy-load dev mock helpers so they never appear in a production bundle
  const { makeId } = await import('./devMock/defectService');
  const { priorityTier } = await import('./devMock/priorityService');

  await new Promise((r) => setTimeout(r, 2200)); // simulate analysis round-trip

  const priority_score = Math.round(35 + Math.random() * 45); // placeholder only
  return {
    observation_id: makeId('OB'),
    defect_id: makeId('RD'),
    defect_type: 'POTHOLE',        // placeholder — backend classifies
    severity: 'MEDIUM',            // placeholder — backend classifies
    duplicate_decision: 'DISTINCT',
    evidence_count: 1,
    priority_score,
    priority_tier: priorityTier(priority_score),
    status: 'CANDIDATE',
    location: { latitude: req.latitude, longitude: req.longitude },
    message: 'Observation recorded (dev mode — no real backend)',
  };
}
// ---------------------------------------------------------------------------

/** Build the multipart FormData for the observation endpoint. */
function buildFormData(req: ObservationRequest): FormData {
  const form = new FormData();
  // React Native accepts {uri, type, name} as a Blob substitute
  form.append('image', {
    uri: req.imageUri,
    type: 'image/jpeg',
    name: 'observation.jpg',
  } as unknown as Blob);
  form.append('latitude', String(req.latitude));
  form.append('longitude', String(req.longitude));
  if (req.accuracyMeters !== null) {
    form.append('accuracy_meters', String(req.accuracyMeters));
  }
  form.append('location_source', req.locationSource);
  form.append('timestamp', String(req.timestamp));
  if (req.description) {
    form.append('description', req.description);
  }
  return form;
}

/**
 * Submit a citizen observation.
 *
 * TODAY:  calls devSubmitObservation (temporary adapter)
 * LATER:  remove DEV_MODE branch, call realSubmitObservation directly
 */
export async function submitObservation(
  imageUri: string,
  locationFix: LocationFix,
  description?: string,
): Promise<ObservationResult> {
  if (
    locationFix.latitude === null ||
    locationFix.longitude === null ||
    locationFix.source === 'UNLOCATED'
  ) {
    throw new Error('A valid GPS location is required to submit an observation.');
  }

  const req: ObservationRequest = {
    imageUri,
    latitude: locationFix.latitude,
    longitude: locationFix.longitude,
    accuracyMeters: locationFix.accuracyMeters,
    locationSource: locationFix.source as 'DEVICE' | 'MANUAL' | 'EXIF',
    timestamp: Date.now(),
    description,
  };

  if (DEV_MODE) {
    return devSubmitObservation(req);
  }
  return realSubmitObservation(req);
}

async function realSubmitObservation(req: ObservationRequest): Promise<ObservationResult> {
  const form = buildFormData(req);
  return apiRequest<ObservationResult>(ENDPOINTS.observations, {
    method: 'POST',
    body: form,
  });
}

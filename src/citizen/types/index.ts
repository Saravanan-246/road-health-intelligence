/**
 * Citizen-specific types.
 *
 * These mirror the backend response contract. Do NOT calculate or derive these
 * values in React Native — they come from FastAPI.
 */

import type { DefectType, DuplicateDecision, PriorityTier, Severity, DefectStatus } from '../../api/types';

/** Authenticated citizen session. */
export interface CitizenSession {
  userId: string;
  token: string;
  email: string;
  displayName: string;
}

/** Request body sent to POST /observations. */
export interface ObservationRequest {
  imageUri: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  locationSource: 'DEVICE' | 'MANUAL' | 'EXIF';
  timestamp: number;
  description?: string;
}

/**
 * Backend response from POST /observations.
 * The backend determines defect_type, severity, duplicate_decision, priority — not the app.
 */
export interface ObservationResult {
  observation_id: string;
  defect_id: string;
  defect_type: DefectType;
  severity: Severity;
  duplicate_decision: DuplicateDecision;
  evidence_count: number;
  priority_score: number;
  priority_tier: PriorityTier;
  status: DefectStatus;
  location: {
    latitude: number;
    longitude: number;
  };
  message?: string;
}

/** A single report row returned from GET /observations/my. */
export interface MyReportRow {
  observation_id: string;
  defect_id: string;
  defect_type: DefectType;
  severity: Severity;
  status: DefectStatus;
  duplicate_decision: DuplicateDecision;
  priority_score: number;
  priority_tier: PriorityTier;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

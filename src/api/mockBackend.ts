

/**
 * TEMPORARY local stand-in for the FastAPI backend (single source of truth for
 * both Citizen and Admin until src/api/client.ts is wired to the real server).
 *
 * All seed records are STAGED DEMO DATA, not real government or live road data.
 * Decisions and scores are produced by the dev-mock services, never hardcoded.
 */
import { useSyncExternalStore } from 'react';
import { addObservation, createDefect, makeId } from '../citizen/services/devMock/defectService';
import { priorityTier as tierOf } from '../citizen/services/devMock/priorityService';
import { projectToRoadFrame } from '../services/roadFrame';
import { resolveLiveIdentity } from '../services/identityPipeline';
import {
  CITIZEN_ISSUE_LABELS,
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type CitizenIssue,
  type CitizenIssueType,
  type Defect,
  type DefectStatus,
  type DefectType,
  type DuplicateAnalysis,
  type DuplicateDecision,
  type Observation,
  type PriorityTier,
  type StatusChange,
} from './types';

export type Role = 'CITIZEN' | 'ADMIN';

export interface MockUser {
  id: string;
  role: Role;
  name: string;
  username: string;
}

// Dev-only mock credentials. Not a real authentication system.
const USERS: (MockUser & { password: string })[] = [
  { id: 'USR-CIT-001', role: 'CITIZEN', name: 'Citizen', username: 'citizen', password: '123' },
  { id: 'USR-ADM-001', role: 'ADMIN', name: 'Road Authority', username: 'admin', password: '123' },
];

export function login(role: Role, username: string, password: string): MockUser | null {
  const u = USERS.find(
    (x) => x.role === role && x.username === username.trim().toLowerCase() && x.password === password,
  );
  if (!u) return null;
  const { password: _pw, ...user } = u;
  return user;
}

export function priorityTier(score: number): PriorityTier {
  return tierOf(score);
}

/**
 * Authority actions re-check the actor's role here, not only in the navigation. In this
 * prototype the check runs on the device; a production backend must enforce it server-side.
 */
function requireAuthority(actorId: string): void {
  const actor = USERS.find((u) => u.id === actorId);
  if (!actor || actor.role !== 'ADMIN') throw new Error('Not authorised: this action requires the authority role.');
}

/* ---------------- store ---------------- */

/** A notification that cannot be derived from current records (e.g. the defect was deleted). */
export interface StoredNotice {
  id: string;
  userId: string;
  at: number;
  defectId: string;
  title: string;
  body: string;
}

interface State {
  defects: Defect[];
  issues: CitizenIssue[];
  notices: StoredNotice[];
  /** Per user: notifications at or before this time have been seen. */
  notificationsSeenAt: Record<string, number>;
}

let state: State = { defects: [], issues: [], notices: [], notificationsSeenAt: {} };
const listeners = new Set<() => void>();
let nextSeq = 127;
let nextIssueId = 1;

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDefects(): Defect[] {
  return useSyncExternalStore(subscribe, () => state.defects);
}

export function useIssues(): CitizenIssue[] {
  return useSyncExternalStore(subscribe, () => state.issues);
}

export function useNotices(): StoredNotice[] {
  return useSyncExternalStore(subscribe, () => state.notices);
}

export function useNotificationsSeenAt(userId: string): number {
  return useSyncExternalStore(subscribe, () => state.notificationsSeenAt[userId] ?? 0);
}

export function markNotificationsSeen(userId: string, at = Date.now()): void {
  if ((state.notificationsSeenAt[userId] ?? 0) >= at) return;
  setState({ notificationsSeenAt: { ...state.notificationsSeenAt, [userId]: at } });
}

export function getDefect(id: string): Defect | undefined {
  return state.defects.find((d) => d.id === id);
}

export function getIssuesByDefect(defectId: string): CitizenIssue[] {
  return state.issues.filter((i) => i.defectId === defectId);
}

/** Finds an observation in any defect (observations move between defects when a review is merged). */
export function findObservation(id: string): { observation: Observation; defect: Defect } | null {
  for (const defect of state.defects) {
    const observation = defect.observations.find((o) => o.id === id);
    if (observation) return { observation, defect };
  }
  return null;
}

const TYPE_PREFIX: Record<DefectType, string> = {
  POTHOLE: 'PTH',
  CRACK: 'CRK',
  RUTTING: 'RUT',
  SURFACE_WEAR: 'SRF',
  OTHER: 'DEF',
};

/** CBE only when inside the Coimbatore area. */
export function regionCode(lat: number, lon: number): 'CBE' | 'LOC' {
  return lat > 10.85 && lat < 11.2 && lon > 76.8 && lon < 77.15 ? 'CBE' : 'LOC';
}

/** Digital Defect Identity, e.g. PTH-CBE-000127. */
function defectId(type: DefectType, lat: number, lon: number): string {
  return `${TYPE_PREFIX[type]}-${regionCode(lat, lon)}-${String(nextSeq++).padStart(6, '0')}`;
}

export interface SubmitResult {
  observation: Observation;
  decision: DuplicateDecision;
  analysis: DuplicateAnalysis | null;
  defect: Defect;
  /** Existing defect matched by duplicate analysis (MERGE or REVIEW), if any. */
  matchedDefectId: string | null;
}

export type NewObservation = Omit<
  Observation,
  'id' | 'duplicateDecision' | 'duplicateAnalysis' | 'comparedDefectId' | 'comparedObservationId' | 'identity' | 'roadFrame'
>;

const LOCATION_SOURCES = ['EXIF', 'DEVICE', 'MANUAL'];
const CLASSIFICATION_SOURCES = ['MODEL', 'REPORTER'];

/**
 * Store-side validation of a report. The report form validates too, but its checks can be
 * bypassed, so every submission is re-checked here. Returns human-readable problems.
 */
export function validateObservationInput(
  input: NewObservation,
  now = Date.now(),
  { allowMissingImage = false } = {},
): string[] {
  const errors: string[] = [];
  if (typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90) {
    errors.push('Latitude must be a number between −90 and 90.');
  }
  if (typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) {
    errors.push('Longitude must be a number between −180 and 180.');
  }
  if (input.accuracyMeters !== null && !(Number.isFinite(input.accuracyMeters) && input.accuracyMeters >= 0)) {
    errors.push('GPS accuracy must be a non-negative number or unknown.');
  }
  if (!(input.defectType in DEFECT_TYPE_LABELS)) errors.push('Unknown defect type.');
  if (!(input.severity in SEVERITY_LABELS)) errors.push('Unknown severity.');
  if (!LOCATION_SOURCES.includes(input.locationSource)) errors.push('Unknown location source.');
  if (!CLASSIFICATION_SOURCES.includes(input.classificationSource)) errors.push('Unknown classification source.');
  if (input.confidence !== null && !(Number.isFinite(input.confidence) && input.confidence >= 0 && input.confidence <= 1)) {
    errors.push('Detector confidence must be between 0 and 1.');
  }
  if (!Number.isFinite(input.timestamp) || input.timestamp > now + 5 * 60_000) errors.push('Report time is invalid.');
  if (typeof input.reporterId !== 'string' || !input.reporterId.trim()) errors.push('Reporter reference is missing.');
  if (typeof input.imageUri !== 'string' || (!allowMissingImage && !input.imageUri.trim())) {
    errors.push('An image is required as evidence.');
  }
  if (!allowMissingImage && (!input.imageValidation || input.imageValidation.status !== 'VALID' || !input.imageValidation.referenceMatch)) {
    errors.push('A valid road-defect image validation result is required before submission.');
  }
  if (input.imageCapturedAt != null && !Number.isFinite(input.imageCapturedAt)) errors.push('Photo time is invalid.');
  return errors;
}

/** POST /observations equivalent: validation → identity resolution → create or merge → priority. */
export function submitObservation(input: NewObservation, now = Date.now()): SubmitResult {
  return submit(input, now, false);
}

function submit(input: NewObservation, now: number, staged: boolean): SubmitResult {
  const errors = validateObservationInput(input, now, { allowMissingImage: staged });
  if (errors.length) throw new Error(errors.join(' '));

  // REVIEW-pending defects are not merge targets until an authority resolves them.
  const candidates = state.defects.filter((d) => !d.pendingReviewOf && d.status !== 'REPAIRED');
  const draft: Observation = {
    ...input,
    id: makeId('OB'),
    roadFrame: projectToRoadFrame({ ...input, id: '', timestamp: now } as Observation),
  };
  const { best: match, nearest } = resolveLiveIdentity(draft, candidates, now);
  const decision: DuplicateDecision = match ? match.decision : 'DISTINCT';
  // Keep the evidence behind the decision so it can be explained later. For DISTINCT the
  // nearest open defect is recorded; it does not influence the decision.
  const compared = match ?? nearest;
  const observation: Observation = {
    ...draft,
    duplicateDecision: decision,
    duplicateAnalysis: compared?.radius,
    comparedDefectId: compared?.defect.id ?? null,
    comparedObservationId: compared?.reference.id ?? null,
    identity: compared?.record ?? {
      engine: draft.roadFrame?.snap_confidence === 'NONE' ? 'radius-v1-fallback' : 'roadframe-v1',
      automaticDecision: 'DISTINCT',
      roadFrame: null,
      safeguards: [],
    },
  };

  let defect: Defect;
  let defects: Defect[];
  if (match && decision === 'MERGE') {
    const updated = addObservation(match.defect, observation, now);
    defect = {
      ...match.defect,
      ...updated,
      history:
        updated.status !== match.defect.status
          ? [...(match.defect.history ?? []), { from: match.defect.status, to: updated.status, at: now, by: 'system', note: 'Corroborated by additional report' }]
          : match.defect.history,
    };
    defects = state.defects.map((d) => (d.id === defect.id ? defect : d));
  } else {
    const created = createDefect(observation, now);
    // A new record at the place of a repaired defect may be the same defect coming back.
    // It is only flagged; the authority decides whether to reopen the repaired record.
    const repaired = state.defects.filter((d) => d.status === 'REPAIRED');
    const recurrence = resolveLiveIdentity(draft, repaired, now).best;
    defect = {
      ...created,
      id: defectId(observation.defectType, observation.latitude, observation.longitude),
      pendingReviewOf: decision === 'REVIEW' && match ? match.defect.id : null,
      possibleRecurrenceOf: recurrence?.defect.id ?? null,
      history: [{ from: null, to: created.status, at: now, by: observation.reporterId ?? 'unknown' }],
    };
    defects = [...state.defects, defect];
  }
  setState({ defects, issues: state.issues });
  return { observation, decision, analysis: match?.radius ?? null, defect, matchedDefectId: match?.defect.id ?? null };
}

/** PATCH /defects/{id}/status equivalent. */
export function updateStatus(id: string, to: DefectStatus, by: string, note?: string): void {
  requireAuthority(by);
  setState({
    defects: state.defects.map((d) =>
      d.id === id && d.status !== to
        ? { ...d, status: to, history: [...(d.history ?? []), { from: d.status, to, at: Date.now(), by, note }] }
        : d,
    ),
    issues: state.issues,
  });
}

export interface DefectEdit {
  defectType?: DefectType;
  status?: DefectStatus;
  note?: string;
}

export const EDIT_NOTE_MAX_LENGTH = 500;

/**
 * Authority correction of defect-level fields. Observations (evidence) are never modified,
 * so severity and priority, which derive from them, are unchanged.
 */
export function editDefect(id: string, edit: DefectEdit, by: string): void {
  requireAuthority(by);
  const d = getDefect(id);
  if (!d) return;
  const newType = edit.defectType ?? d.defectType;
  const to = edit.status ?? d.status;
  const parts = [
    newType !== d.defectType ? `Edited type ${d.defectType} → ${newType}` : '',
    edit.note?.trim().slice(0, EDIT_NOTE_MAX_LENGTH) ?? '',
  ].filter(Boolean);
  if (newType === d.defectType && to === d.status && !parts.length) return;
  const entry: StatusChange = { from: d.status, to, at: Date.now(), by, note: parts.join(' · ') || undefined };
  setState({
    defects: state.defects.map((x) =>
      x.id === id ? { ...x, defectType: newType, status: to, history: [...(x.history ?? []), entry] } : x,
    ),
    issues: state.issues,
  });
}

/**
 * Removes the defect and its observations from the in-memory demo store (this session only;
 * no backend is connected). Any review that pointed at it is closed.
 */
export function deleteDefect(id: string, by: string): void {
  requireAuthority(by);
  const target = getDefect(id);
  if (!target) return;
  const now = Date.now();
  // The record disappears, so its reporters are told explicitly.
  const reporters = [...new Set(target.observations.map((o) => o.reporterId).filter((r): r is string => !!r))];
  const notices: StoredNotice[] = reporters.map((userId) => ({
    id: `RM-${id}-${userId}`,
    userId,
    at: now,
    defectId: id,
    title: 'Record removed',
    body: `The road authority removed defect record ${id}. Your report is no longer listed.`,
  }));
  setState({
    notices: [...state.notices, ...notices],
    defects: state.defects
      .filter((d) => d.id !== id)
      .map((d) =>
        d.pendingReviewOf === id
          ? {
              ...d,
              pendingReviewOf: null,
              history: [...(d.history ?? []), { from: d.status, to: d.status, at: now, by, note: `Review closed: ${id} was deleted` }],
            }
          : d,
      ),
    issues: state.issues,
  });
}

/** Authority resolution of a REVIEW decision. */
export function resolveReview(id: string, resolution: 'MERGE' | 'DISTINCT', by: string): void {
  requireAuthority(by);
  const pending = getDefect(id);
  if (!pending?.pendingReviewOf) return;
  const now = Date.now();
  if (resolution === 'DISTINCT') {
    setState({
      defects: state.defects.map((d) =>
        d.id === id
          ? {
              ...d,
              pendingReviewOf: null,
              // Record the authority's resolution, mirroring the MERGE path below.
              observations: d.observations.map((o) => ({ ...o, duplicateDecision: 'DISTINCT' as const })),
              history: [...(d.history ?? []), { from: d.status, to: d.status, at: now, by, note: 'Review: kept distinct' }],
            }
          : d,
      ),
      issues: state.issues,
    });
    return;
  }
  let target = getDefect(pending.pendingReviewOf);
  if (!target) return;
  for (const o of pending.observations) {
    target = { ...target, ...addObservation(target, { ...o, duplicateDecision: 'MERGE' }, now) };
  }
  const merged: Defect = {
    ...target,
    history: [
      ...(target.history ?? []),
      { from: target.status, to: target.status, at: now, by, note: `Review: merged ${id}` },
    ],
  };
  setState({
    defects: state.defects.filter((d) => d.id !== id).map((d) => (d.id === merged.id ? merged : d)),
    issues: state.issues,
  });
}

/**
 * Authority decision on a flagged possible recurrence. REOPEN marks the repaired defect as
 * RECURRED (its reporters see the change); DISMISS only clears the flag. Both are recorded.
 */
export function resolveRecurrence(id: string, action: 'REOPEN' | 'DISMISS', by: string): void {
  requireAuthority(by);
  const flagged = getDefect(id);
  const repairedId = flagged?.possibleRecurrenceOf;
  if (!flagged || !repairedId) return;
  const now = Date.now();
  const repaired = getDefect(repairedId);
  const reopen = action === 'REOPEN' && !!repaired;
  setState({
    defects: state.defects.map((d) => {
      if (d.id === id) {
        return {
          ...d,
          possibleRecurrenceOf: null,
          history: [...(d.history ?? []), { from: d.status, to: d.status, at: now, by, note: reopen ? `Recurrence confirmed: ${repairedId} reopened` : `Recurrence of ${repairedId} dismissed` }],
        };
      }
      if (reopen && d.id === repairedId && d.status !== 'RECURRED') {
        return { ...d, status: 'RECURRED', history: [...(d.history ?? []), { from: d.status, to: 'RECURRED', at: now, by, note: `Reopened: recurrence reported as ${id}` }] };
      }
      return d;
    }),
  });
}

export const ISSUE_DETAILS_MAX_LENGTH = 500;

/**
 * Records a citizen concern about a report. The original report is never modified or deleted
 * here; the issue is only queued for authority review. Inputs are re-validated because the
 * form's own checks can be bypassed.
 */
export function submitCitizenIssue(
  defectId: string,
  issueType: CitizenIssueType,
  details: string,
  reporterId: string,
): CitizenIssue {
  if (!getDefect(defectId)) throw new Error('This defect record no longer exists.');
  if (!(issueType in CITIZEN_ISSUE_LABELS)) throw new Error('Unknown issue type.');
  const clean = details.trim().slice(0, ISSUE_DETAILS_MAX_LENGTH);
  if (issueType === 'OTHER' && !clean) throw new Error('Please describe the issue.');
  const issue: CitizenIssue = {
    id: `ISS-${String(nextIssueId++).padStart(6, '0')}`,
    defectId,
    issueType,
    details: clean,
    reporterId,
    status: 'UNDER_REVIEW',
    createdAt: Date.now(),
  };
  setState({
    ...state,
    issues: [...state.issues, issue],
  });
  return issue;
}

/* ---------------- staged demo seed ---------------- */

/**
 * Staged test location in the same lane as PTH-CBE-000127 (simulated ±5 m fix). For demos only.
 * It projects onto demo road OSM-001, side A, ~3 m from the centreline.
 */
export const STAGED_TEST_LOCATION = { latitude: 11.016826, longitude: 76.9557862, accuracyMeters: 5 };

function seed() {
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.now();
  const base = { imageUri: '', confidence: null, classificationSource: 'REPORTER' as const };
  const obs = (o: Partial<NewObservation> & Pick<NewObservation, 'latitude' | 'longitude'>, ageDays: number) => {
    const timestamp = t0 - ageDays * day;
    return submit(
      {
        ...base,
        defectType: 'POTHOLE',
        severity: 'HIGH',
        accuracyMeters: 6,
        locationSource: 'DEVICE',
        reporterId: 'USR-CIT-001',
        timestamp,
        ...o,
      },
      t0,
      true,
    );
  };

  // Staged points on demo road OSM-001 (projected by the real road-frame projector).
  // Three reports of one pothole, all in the same lane (side A, 2.6–3.5 m from the centreline)
  // → PTH-CBE-000127 (2 × MERGE decided by road-frame identity resolution).
  const first = obs({ latitude: 11.0168202, longitude: 76.9557818, severity: 'SEVERE', accuracyMeters: 5 }, 3);
  obs({ latitude: 11.016833, longitude: 76.9557881, reporterId: 'USR-CIT-002' }, 2);
  obs({ latitude: 11.0168113, longitude: 76.955778, reporterId: 'USR-CIT-003' }, 1);
  // Unrelated crack across town, off the demo road network → DISTINCT (radius fallback).
  const crack = obs({ latitude: 11.0045, longitude: 76.9616, defectType: 'CRACK', severity: 'MEDIUM' }, 5);
  // Manually located (accuracy unknown), ~20 m further along the same lane → REVIEW: the gap
  // is beyond tolerance but inside GPS uncertainty, so it cannot be merged automatically.
  obs(
    { latitude: 11.0169549, longitude: 76.9559164, locationSource: 'MANUAL', accuracyMeters: null, reporterId: 'USR-CIT-004' },
    0.5,
  );
  // Older rutting defect, since repaired.
  const rut = obs({ latitude: 11.025, longitude: 76.94, defectType: 'RUTTING', severity: 'MEDIUM', reporterId: 'USR-CIT-002' }, 20);
  // A second pothole in the opposite lane, ~6 m from PTH-CBE-000127 → DISTINCT
  // (same area, different defect: opposite side of the centreline).
  obs({ latitude: 11.0167844, longitude: 76.9558255, severity: 'MEDIUM', accuracyMeters: 5, reporterId: 'USR-CIT-005' }, 1.5);

  updateStatus(first.defect.id, 'VERIFIED', 'USR-ADM-001', 'Site inspection');
  updateStatus(first.defect.id, 'SCHEDULED', 'USR-ADM-001', 'Awaiting repair crew');
  updateStatus(crack.defect.id, 'VERIFIED', 'USR-ADM-001');
  updateStatus(rut.defect.id, 'SCHEDULED', 'USR-ADM-001');
  updateStatus(rut.defect.id, 'REPAIRED', 'USR-ADM-001', 'Resurfaced');
}

seed();

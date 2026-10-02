/**
 * Live identity resolution for submitted reports.
 *
 * Road-Frame Identity Resolution (RoadFrame-V1) decides whenever both observations project
 * onto the road network. The legacy radius engine (Radius-V1) is kept for two jobs:
 *  - off-network fallback, when either observation has no road frame;
 *  - safeguards on a road-frame MERGE (defect-type conflict, GPS uncertainty limit).
 * Neither engine is replaced; this module only decides which one answers.
 */
import type {
  Defect,
  DuplicateAnalysis,
  DuplicateDecision,
  IdentityRecord,
  IdentitySafeguard,
  Observation,
} from '../api/types';
import { analyzeDuplicate } from '../citizen/services/devMock/duplicateService';
import { haversineMeters } from '../citizen/utils/distance';
import { resolveRoadFrameIdentity } from './roadFrameIdentity';

export interface IdentityMatch {
  defect: Defect;
  /** Closest observation of the defect — the evidence pair that was compared. */
  reference: Observation;
  decision: DuplicateDecision;
  record: IdentityRecord;
  /** Radius-V1 view of the same candidate (evidence and safeguard inputs). */
  radius: DuplicateAnalysis;
  distanceMeters: number;
}

const onNetwork = (o: Observation) => !!o.roadFrame && o.roadFrame.snap_confidence !== 'NONE';

const RANK: Record<DuplicateDecision, number> = { MERGE: 2, REVIEW: 1, DISTINCT: 0 };

const gps = (a: Observation, b: Observation) => haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);

function closest(observations: Observation[], to: Observation): Observation {
  return observations.reduce((best, o) => (gps(to, o) < gps(to, best) ? o : best));
}

/**
 * Evaluates one candidate defect for a new observation. A defect is corroborated by any of
 * its observations, so road-frame analysis is run against each one and the strongest result
 * is kept (MERGE > REVIEW > DISTINCT, then nearest).
 */
export function evaluateCandidate(draft: Observation, defect: Defect, now = Date.now()): IdentityMatch {
  const radius = analyzeDuplicate(draft, defect);
  const networked = defect.observations.filter(onNetwork);

  if (!onNetwork(draft) || !networked.length) {
    const reference = closest(defect.observations, draft);
    return {
      defect,
      reference,
      decision: radius.decision,
      record: { engine: 'radius-v1-fallback', automaticDecision: radius.decision, roadFrame: null, safeguards: [] },
      radius,
      distanceMeters: gps(draft, reference),
    };
  }

  let best: IdentityMatch | null = null;
  for (const reference of networked) {
    const roadFrame = resolveRoadFrameIdentity(draft, reference, now);
    const safeguards: IdentitySafeguard[] = [];
    let decision = roadFrame.verdict;
    if (decision === 'MERGE') {
      if (radius.evidence && !radius.evidence.typeAgrees) safeguards.push('TYPE_CONFLICT');
      if (radius.evidence && radius.evidence.combinedUncertaintyMeters > radius.evidence.maxUncertaintyForAutoMergeMeters) {
        safeguards.push('GPS_UNCERTAINTY');
      }
      if (draft.roadFrame?.snap_confidence === 'LOW' || reference.roadFrame?.snap_confidence === 'LOW') {
        safeguards.push('SNAP_UNCERTAIN');
      }
      if (safeguards.length) decision = 'REVIEW';
    }
    const m: IdentityMatch = {
      defect,
      reference,
      decision,
      record: { engine: 'roadframe-v1', automaticDecision: decision, roadFrame, safeguards },
      radius,
      distanceMeters: gps(draft, reference),
    };
    if (!best || RANK[m.decision] > RANK[best.decision] || (RANK[m.decision] === RANK[best.decision] && m.distanceMeters < best.distanceMeters)) {
      best = m;
    }
  }
  return best!;
}

/**
 * Best MERGE/REVIEW match among candidates (MERGE beats REVIEW; nearer beats farther), plus
 * the nearest evaluated candidate so a DISTINCT outcome can still be explained.
 *
 * Distance alone never excludes a road-frame candidate: GPS drift along a road can exceed the
 * radius gate, and the road frame (same way, side and chainage) decides instead. Projections
 * far from the road carry LOW snap confidence, which blocks an automatic merge.
 */
export function resolveLiveIdentity(
  draft: Observation,
  candidates: Defect[],
  now = Date.now(),
): { best: IdentityMatch | null; nearest: IdentityMatch | null } {
  let best: IdentityMatch | null = null;
  let nearest: IdentityMatch | null = null;
  for (const defect of candidates) {
    if (!defect.observations.length) continue;
    const m = evaluateCandidate(draft, defect, now);
    if (!nearest || m.distanceMeters < nearest.distanceMeters) nearest = m;
    if (m.decision === 'DISTINCT') continue;
    if (!best || RANK[m.decision] > RANK[best.decision] || (RANK[m.decision] === RANK[best.decision] && m.distanceMeters < best.distanceMeters)) {
      best = m;
    }
  }
  return { best, nearest };
}

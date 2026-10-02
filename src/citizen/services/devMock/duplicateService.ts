import type { Defect, DuplicateAnalysis, DuplicateDecision, DuplicateEvidence, Observation } from '../../../api/types';
import { haversineMeters } from '../../utils/distance';

/**
 * All duplicate-analysis thresholds live here.
 *
 * Pipeline: GPS candidate gate → defect-type agreement → visual evidence (future)
 * → road/segment evidence (future) → decision. GPS alone never produces MERGE.
 */
export const DUPLICATE_CONFIG = {
  /** Base search radius for candidate defects. */
  candidateRadiusMeters: 15,
  /** Max extra radius added from combined GPS uncertainty. */
  maxUncertaintyInflationMeters: 25,
  /** Assumed accuracy when a fix has none (e.g. manual entry). */
  unknownAccuracyMeters: 30,
  /** Above this combined uncertainty, auto-MERGE is downgraded to REVIEW. */
  maxUncertaintyForAutoMergeMeters: 20,
  mergeScore: 0.75,
  reviewScore: 0.45,
  /** Evidence weights; only evidence that is available contributes. */
  weights: { spatial: 0.55, defectType: 0.45, visual: 0.0, roadSegment: 0.0 },
} as const;

interface EvidenceScore {
  weight: number;
  score: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Best (smallest) reported accuracy among a defect's observations, or null when none reported one. */
function reportedDefectAccuracy(defect: Defect): number | null {
  const values = defect.observations
    .map((o) => o.accuracyMeters)
    .filter((a): a is number => a !== null);
  return values.length ? Math.min(...values) : null;
}

function defectAccuracy(defect: Defect): number {
  return reportedDefectAccuracy(defect) ?? DUPLICATE_CONFIG.unknownAccuracyMeters;
}

export function analyzeDuplicate(observation: Observation, defect: Defect): DuplicateAnalysis {
  const cfg = DUPLICATE_CONFIG;
  const reasons: string[] = [];
  const typeAgrees = observation.defectType === defect.defectType;

  // 1. GPS candidate gate — widened by combined positional uncertainty.
  const distanceMeters = haversineMeters(
    observation.latitude,
    observation.longitude,
    defect.latitude,
    defect.longitude,
  );
  const obsAccuracy = observation.accuracyMeters ?? cfg.unknownAccuracyMeters;
  const combinedUncertainty = Math.hypot(obsAccuracy, defectAccuracy(defect));
  const gateRadius =
    cfg.candidateRadiusMeters + Math.min(combinedUncertainty, cfg.maxUncertaintyInflationMeters);

  reasons.push(
    `Distance ${distanceMeters.toFixed(1)} m; gate ${gateRadius.toFixed(1)} m ` +
      `(base ${cfg.candidateRadiusMeters} m + GPS uncertainty ±${combinedUncertainty.toFixed(1)} m)`,
  );

  const evidence: DuplicateEvidence = {
    gateRadiusMeters: gateRadius,
    combinedUncertaintyMeters: combinedUncertainty,
    observationAccuracyMeters: observation.accuracyMeters,
    defectAccuracyMeters: reportedDefectAccuracy(defect),
    assumedAccuracyMeters: cfg.unknownAccuracyMeters,
    withinGate: distanceMeters <= gateRadius,
    typeAgrees,
    spatialScore: null,
    mergeThreshold: cfg.mergeScore,
    reviewThreshold: cfg.reviewScore,
    maxUncertaintyForAutoMergeMeters: cfg.maxUncertaintyForAutoMergeMeters,
    blockedBy: [],
  };

  if (distanceMeters > gateRadius) {
    reasons.push('Outside spatial candidate gate');
    return { decision: 'DISTINCT', score: 0, distanceMeters, reasons, evidence };
  }

  const scores: EvidenceScore[] = [];

  const spatialScore = clamp01(1 - distanceMeters / gateRadius);
  scores.push({ weight: cfg.weights.spatial, score: spatialScore });
  evidence.spatialScore = spatialScore;

  // 2. Defect-type agreement.
  const typeConflict = !typeAgrees;
  if (typeConflict) {
    reasons.push(`Defect type differs (${observation.defectType} vs ${defect.defectType})`);
  } else {
    reasons.push(`Defect type agrees (${observation.defectType})`);
  }
  scores.push({ weight: cfg.weights.defectType, score: typeConflict ? 0 : 1 });

  // 3. Visual evidence — not connected yet.
  reasons.push('Visual similarity: not available');
  // 4. Road/segment evidence — not connected yet.
  reasons.push('Road segment match: not available');

  const totalWeight = scores.reduce((s, e) => s + e.weight, 0);
  const score = scores.reduce((s, e) => s + e.weight * e.score, 0) / totalWeight;

  let decision: DuplicateDecision =
    score >= cfg.mergeScore ? 'MERGE' : score >= cfg.reviewScore ? 'REVIEW' : 'DISTINCT';

  if (decision === 'MERGE' && typeConflict) {
    decision = 'REVIEW';
    reasons.push('Type conflict blocks automatic merge');
    evidence.blockedBy.push('TYPE_CONFLICT');
  }
  if (decision === 'MERGE' && combinedUncertainty > cfg.maxUncertaintyForAutoMergeMeters) {
    decision = 'REVIEW';
    reasons.push('GPS uncertainty too high for automatic merge');
    evidence.blockedBy.push('GPS_UNCERTAINTY');
  }

  return { decision, score: Math.round(score * 100) / 100, distanceMeters, reasons, evidence };
}

export interface DuplicateMatch {
  defect: Defect;
  analysis: DuplicateAnalysis;
}

/**
 * Nearest defect by GPS distance with its analysis. Used only to explain a DISTINCT outcome;
 * the decision itself comes from findBestDuplicate.
 */
export function findNearestCandidate(observation: Observation, defects: Defect[]): DuplicateMatch | null {
  let nearest: Defect | null = null;
  let best = Infinity;
  for (const defect of defects) {
    const d = haversineMeters(observation.latitude, observation.longitude, defect.latitude, defect.longitude);
    if (d < best) {
      best = d;
      nearest = defect;
    }
  }
  return nearest ? { defect: nearest, analysis: analyzeDuplicate(observation, nearest) } : null;
}

/** Best non-DISTINCT match among existing defects, or null. */
export function findBestDuplicate(observation: Observation, defects: Defect[]): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  for (const defect of defects) {
    const analysis = analyzeDuplicate(observation, defect);
    if (analysis.decision === 'DISTINCT') continue;
    if (!best || analysis.score > best.analysis.score) best = { defect, analysis };
  }
  return best;
}

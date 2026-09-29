import type { Defect, DuplicateAnalysis, DuplicateDecision, Observation } from '../types/defect';
import { haversineMeters } from '../utils/distance';

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

/** Best (smallest) reported accuracy among a defect's observations. */
function defectAccuracy(defect: Defect): number {
  const values = defect.observations
    .map((o) => o.accuracyMeters)
    .filter((a): a is number => a !== null);
  return values.length ? Math.min(...values) : DUPLICATE_CONFIG.unknownAccuracyMeters;
}

export function analyzeDuplicate(observation: Observation, defect: Defect): DuplicateAnalysis {
  const cfg = DUPLICATE_CONFIG;
  const reasons: string[] = [];

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

  if (distanceMeters > gateRadius) {
    reasons.push('Outside spatial candidate gate');
    return { decision: 'DISTINCT', score: 0, distanceMeters, reasons };
  }

  const evidence: EvidenceScore[] = [];

  const spatialScore = clamp01(1 - distanceMeters / gateRadius);
  evidence.push({ weight: cfg.weights.spatial, score: spatialScore });

  // 2. Defect-type agreement.
  const typeConflict = observation.defectType !== defect.defectType;
  if (typeConflict) {
    reasons.push(`Defect type differs (${observation.defectType} vs ${defect.defectType})`);
  } else {
    reasons.push(`Defect type agrees (${observation.defectType})`);
  }
  evidence.push({ weight: cfg.weights.defectType, score: typeConflict ? 0 : 1 });

  // 3. Visual evidence — not connected yet.
  reasons.push('Visual similarity: not available');
  // 4. Road/segment evidence — not connected yet.
  reasons.push('Road segment match: not available');

  const totalWeight = evidence.reduce((s, e) => s + e.weight, 0);
  const score = evidence.reduce((s, e) => s + e.weight * e.score, 0) / totalWeight;

  let decision: DuplicateDecision =
    score >= cfg.mergeScore ? 'MERGE' : score >= cfg.reviewScore ? 'REVIEW' : 'DISTINCT';

  if (decision === 'MERGE' && typeConflict) {
    decision = 'REVIEW';
    reasons.push('Type conflict blocks automatic merge');
  }
  if (decision === 'MERGE' && combinedUncertainty > cfg.maxUncertaintyForAutoMergeMeters) {
    decision = 'REVIEW';
    reasons.push('GPS uncertainty too high for automatic merge');
  }

  return { decision, score: Math.round(score * 100) / 100, distanceMeters, reasons };
}

export interface DuplicateMatch {
  defect: Defect;
  analysis: DuplicateAnalysis;
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

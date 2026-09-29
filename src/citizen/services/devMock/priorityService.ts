import type {
  Observation,
  PriorityBreakdown,
  PriorityFactor,
  PriorityResult,
  PriorityTier,
  Severity,
} from '../../../api/types';

/**
 * Engineering parameters, not learned from repair data.
 * Tune here; nothing else in the app hardcodes these values.
 */
export const PRIORITY_WEIGHTS = {
  severity: 0.35,
  confidence: 0.15,
  observationSupport: 0.2,
  recency: 0.15,
  roadContext: 0.15,
} as const;

export const PRIORITY_CONFIG = {
  severityValue: { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, SEVERE: 1 } as Record<Severity, number>,
  /** Used when no observation has a detector confidence (reporter-classified only). */
  unknownConfidence: 0.5,
  /** Number of observations at which support saturates to 1. */
  supportSaturation: 5,
  recencyHalfLifeDays: 14,
  /** Neutral value until road class / traffic data is connected. */
  defaultRoadContext: 0.5,
  tiers: { critical: 75, high: 55, medium: 35 },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function factor(value: number, weight: number, note: string): PriorityFactor {
  const v = clamp01(value);
  return { value: round1(v * 100) / 100, weight, points: round1(v * weight * 100), note };
}

export interface PriorityInput {
  observations: Observation[];
  /** 0–1 road importance; null/undefined when unknown. */
  roadContext?: number | null;
  /** Evaluation time in ms. Passed explicitly so results are reproducible. */
  now: number;
}

/** Pure, deterministic priority. Same inputs always give the same output. */
export function calculatePriority({ observations, roadContext, now }: PriorityInput): PriorityResult {
  if (observations.length === 0) {
    throw new Error('calculatePriority requires at least one observation');
  }
  const cfg = PRIORITY_CONFIG;
  const w = PRIORITY_WEIGHTS;

  const worstSeverity = observations.reduce<Severity>(
    (worst, o) => (cfg.severityValue[o.severity] > cfg.severityValue[worst] ? o.severity : worst),
    observations[0].severity,
  );

  const confidences = observations
    .map((o) => o.confidence)
    .filter((c): c is number => c !== null);
  const confidenceValue = confidences.length ? Math.max(...confidences) : cfg.unknownConfidence;

  const n = observations.length;
  const latest = Math.max(...observations.map((o) => o.timestamp));
  const ageDays = Math.max(0, (now - latest) / DAY_MS);
  const recencyValue = Math.pow(0.5, ageDays / cfg.recencyHalfLifeDays);

  const hasRoadContext = roadContext !== null && roadContext !== undefined;

  const breakdown: PriorityBreakdown = {
    severity: factor(
      cfg.severityValue[worstSeverity],
      w.severity,
      `Worst observed severity: ${worstSeverity}`,
    ),
    confidence: factor(
      confidenceValue,
      w.confidence,
      confidences.length
        ? `Highest detector confidence of ${confidences.length} observation(s)`
        : 'No detector confidence yet — neutral default',
    ),
    observationSupport: factor(
      n / cfg.supportSaturation,
      w.observationSupport,
      `${n} observation(s); saturates at ${cfg.supportSaturation}`,
    ),
    recency: factor(
      recencyValue,
      w.recency,
      `Last seen ${ageDays.toFixed(1)} day(s) ago; half-life ${cfg.recencyHalfLifeDays} days`,
    ),
    roadContext: factor(
      hasRoadContext ? roadContext : cfg.defaultRoadContext,
      w.roadContext,
      hasRoadContext ? 'Road context provided' : 'No road-class data yet — neutral default',
    ),
  };

  const raw = Object.values(breakdown).reduce((sum, f) => sum + f.value * f.weight, 0);
  return { score: Math.round(clamp01(raw) * 100), breakdown };
}

export function priorityTier(score: number): PriorityTier {
  const t = PRIORITY_CONFIG.tiers;
  if (score >= t.critical) return 'Critical';
  if (score >= t.high) return 'High';
  if (score >= t.medium) return 'Medium';
  return 'Low';
}

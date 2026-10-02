/**
 * Orientation calibration and normalisation for phone motion data — pure functions.
 *
 * RAW SENSOR DATA → DEVICE ORIENTATION → ORIENTATION CALIBRATION → COORDINATE NORMALISATION
 * → GRAVITY / BASELINE HANDLING → NORMALISED MOTION SIGNAL → ROAD EVENT FEATURES
 *
 * The phone may be portrait, landscape, tilted or mounted at any angle, so raw axes mean
 * different things in each posture. Calibration measures the gravity direction while the
 * phone is still; motion is then expressed along that direction (vertical) and in the plane
 * perpendicular to it (horizontal magnitude), which is the same whichever way the phone is
 * held. Nothing assumes the phone faces forward: splitting horizontal motion into forward and
 * lateral needs a heading (e.g. GPS course) and is not implemented.
 *
 * These functions only transform measurements they are given. They do not detect potholes.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type CalibrationState = 'UNAVAILABLE' | 'UNCALIBRATED' | 'CALIBRATING' | 'CALIBRATED' | 'NEEDS_RECALIBRATION';

export type Posture = 'PORTRAIT' | 'LANDSCAPE' | 'FLAT' | 'TILTED';

export const SENSOR_CONFIG = {
  /** Update interval on the calibration screen (20 Hz). */
  sampleIntervalMs: 50,
  /** ~2 s of samples at 20 Hz. */
  calibrationSamples: 40,
  /** Largest per-axis standard deviation (m/s²) accepted as "held still". */
  maxStillStdDev: 0.35,
  /** Plausible measured gravity magnitude (m/s²). */
  minGravity: 8.8,
  maxGravity: 10.8,
  /** Gravity direction change that invalidates a calibration (the phone was re-mounted). */
  recalibrationAngleDeg: 20,
  /** Samples averaged (low-pass) to estimate the current gravity direction for drift checks. */
  driftWindow: 20,
  /** Samples used for road-event features (~2 s). */
  eventWindow: 40,
  /** Prototype thresholds for flagging a motion event candidate. Not validated on road data. */
  eventPeakThreshold: 2.5,
  eventCrestThreshold: 3,
  /** An axis "dominates" when gravity lies within 30° of it. */
  dominantAxisCos: Math.cos((30 * Math.PI) / 180),
} as const;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export function mean(samples: Vec3[]): Vec3 {
  const n = samples.length || 1;
  const s = samples.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
  return scale(s, 1 / n);
}

export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const c = dot(a, b) / (norm(a) * norm(b) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Which way the phone is held, from the gravity direction in device axes (sign-agnostic). */
export function posture(unit: Vec3): Posture {
  const c = SENSOR_CONFIG.dominantAxisCos;
  if (Math.abs(unit.z) >= c) return 'FLAT';
  if (Math.abs(unit.y) >= c) return 'PORTRAIT';
  if (Math.abs(unit.x) >= c) return 'LANDSCAPE';
  return 'TILTED';
}

/** Angle between the screen normal and the vertical: 0° flat, 90° upright. */
export function tiltFromFlatDeg(unit: Vec3): number {
  return (Math.acos(Math.min(1, Math.abs(unit.z))) * 180) / Math.PI;
}

export interface Calibration {
  gravity: Vec3;
  unit: Vec3;
  magnitude: number;
  posture: Posture;
  tiltDeg: number;
  stdDev: number;
  samples: number;
  calibratedAt: number;
}

export type CalibrationResult =
  | { ok: true; calibration: Calibration }
  | { ok: false; reason: 'TOO_FEW_SAMPLES' | 'DEVICE_MOVING' | 'IMPLAUSIBLE_GRAVITY'; detail: string };

/** Estimates the gravity baseline from samples taken while the phone is held still. */
export function calibrate(samples: Vec3[], now = Date.now()): CalibrationResult {
  const cfg = SENSOR_CONFIG;
  if (samples.length < cfg.calibrationSamples) {
    return { ok: false, reason: 'TOO_FEW_SAMPLES', detail: `Need ${cfg.calibrationSamples} samples, got ${samples.length}.` };
  }
  const m = mean(samples);
  const std = Math.max(
    ...(['x', 'y', 'z'] as const).map((k) => Math.sqrt(samples.reduce((s, v) => s + (v[k] - m[k]) ** 2, 0) / samples.length)),
  );
  if (std > cfg.maxStillStdDev) {
    return { ok: false, reason: 'DEVICE_MOVING', detail: `The phone moved during calibration (±${std.toFixed(2)} m/s²). Hold it still in its mount and retry.` };
  }
  const magnitude = norm(m);
  if (magnitude < cfg.minGravity || magnitude > cfg.maxGravity) {
    return { ok: false, reason: 'IMPLAUSIBLE_GRAVITY', detail: `Measured gravity ${magnitude.toFixed(2)} m/s² is outside the plausible range.` };
  }
  const unit = scale(m, 1 / magnitude);
  return {
    ok: true,
    calibration: { gravity: m, unit, magnitude, posture: posture(unit), tiltDeg: tiltFromFlatDeg(unit), stdDev: std, samples: samples.length, calibratedAt: now },
  };
}

export interface NormalisedSample {
  /** Acceleration along the calibrated gravity axis with the gravity baseline removed (m/s²). */
  vertical: number;
  /** Magnitude of acceleration perpendicular to gravity (m/s²). */
  horizontal: number;
}

/**
 * Expresses one accelerometer sample (including gravity, device axes) relative to the
 * calibrated gravity direction. The result does not depend on how the phone is held.
 * The sign of `vertical` follows the platform's accelerometer convention.
 */
export function normalise(sample: Vec3, cal: Calibration): NormalisedSample {
  const along = dot(sample, cal.unit);
  return { vertical: along - cal.magnitude, horizontal: norm(sub(sample, scale(cal.unit, along))) };
}

/** How far the current gravity direction has moved away from the calibrated one. */
export function driftDeg(recent: Vec3[], cal: Calibration): number | null {
  return recent.length ? angleBetweenDeg(mean(recent), cal.unit) : null;
}

export function calibrationState(input: {
  available: boolean | null;
  collecting: boolean;
  calibration: Calibration | null;
  driftDeg: number | null;
}): CalibrationState {
  if (input.available === false) return 'UNAVAILABLE';
  if (input.collecting) return 'CALIBRATING';
  if (!input.calibration) return 'UNCALIBRATED';
  if (input.driftDeg !== null && input.driftDeg > SENSOR_CONFIG.recalibrationAngleDeg) return 'NEEDS_RECALIBRATION';
  return 'CALIBRATED';
}

export interface RoadEventFeatures {
  samples: number;
  peakAbsVertical: number;
  rmsVertical: number;
  peakToPeak: number;
  crestFactor: number;
  /** A sharp vertical transient by prototype thresholds — a feature, not a defect classification. */
  candidate: boolean;
}

/** Window features of the normalised vertical signal. */
export function roadEventFeatures(vertical: number[]): RoadEventFeatures | null {
  if (vertical.length < 5) return null;
  const peakAbsVertical = Math.max(...vertical.map(Math.abs));
  const rmsVertical = Math.sqrt(vertical.reduce((s, v) => s + v * v, 0) / vertical.length);
  const peakToPeak = Math.max(...vertical) - Math.min(...vertical);
  const crestFactor = rmsVertical > 0 ? peakAbsVertical / rmsVertical : 0;
  return {
    samples: vertical.length,
    peakAbsVertical,
    rmsVertical,
    peakToPeak,
    crestFactor,
    candidate: peakAbsVertical >= SENSOR_CONFIG.eventPeakThreshold && crestFactor >= SENSOR_CONFIG.eventCrestThreshold,
  };
}

/**
 * Risk hotspots: road areas where OBSERVED defect evidence has accumulated.
 *
 * This is descriptive, not predictive. Areas are formed by grouping existing defect records
 * that lie close together, and scored only from recorded observations, the existing
 * priority scores, and maintenance state. Weights are engineering parameters, tuned here.
 */
import { useMemo } from 'react';
import { regionCode, useDefects } from '../api/mockBackend';
import {
  DEFECT_TYPE_LABELS,
  SEVERITY_LABELS,
  type AttentionFactor,
  type Defect,
  type DefectType,
  type RiskHotspot,
  type Severity,
} from '../api/types';
import { haversineMeters } from '../citizen/utils/distance';

export const HOTSPOT_CONFIG = {
  /** Defect records closer than this are grouped into one area (single-linkage). */
  linkDistanceMeters: 75,
  /** An area needs at least this many observations to count as accumulated evidence. */
  minObservations: 2,
  weights: { priority: 0.4, evidence: 0.2, multiplicity: 0.15, unresolved: 0.15, recurrence: 0.1 },
  evidenceSaturation: 8,
  multiplicitySaturation: 4,
  recurrenceSaturation: 2,
  minRadiusMeters: 30,
  recentDays: 7,
} as const;

/** A grouped area that does not meet the hotspot criteria, kept so the threshold is visible. */
export interface MonitoredArea {
  key: string;
  latitude: number;
  longitude: number;
  defectIds: string[];
  observationCount: number;
  reason: string;
}

export interface RiskAreas {
  hotspots: RiskHotspot[];
  monitored: MonitoredArea[];
}

const SEVERITY_RANK: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];
const DAY_MS = 24 * 60 * 60 * 1000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function factor(value: number, weight: number, note: string): AttentionFactor {
  const v = clamp01(value);
  return { value: Math.round(v * 100) / 100, weight, points: round1(v * weight * 100), note };
}

/** Single-linkage grouping of defect locations. */
function group(defects: Defect[]): Defect[][] {
  const parent = defects.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < defects.length; i++) {
    for (let j = i + 1; j < defects.length; j++) {
      const d = haversineMeters(defects[i].latitude, defects[i].longitude, defects[j].latitude, defects[j].longitude);
      if (d <= HOTSPOT_CONFIG.linkDistanceMeters) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Defect[]>();
  defects.forEach((d, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), d]);
  });
  return [...groups.values()];
}

const recurred = (d: Defect) => d.status === 'RECURRED' || (d.history ?? []).some((h) => h.to === 'RECURRED');

export function computeRiskAreas(defects: Defect[], now = Date.now()): RiskAreas {
  const cfg = HOTSPOT_CONFIG;
  const w = cfg.weights;
  const candidates: (Omit<RiskHotspot, 'id'> & { firstSeen: number })[] = [];
  const monitored: MonitoredArea[] = [];

  for (const members of group(defects)) {
    const observations = members.flatMap((d) => d.observations);
    const n = observations.length;
    const latitude = members.reduce((s, d) => s + d.latitude * d.observations.length, 0) / Math.max(n, 1);
    const longitude = members.reduce((s, d) => s + d.longitude * d.observations.length, 0) / Math.max(n, 1);
    const unresolved = members.filter((d) => d.status !== 'REPAIRED');
    const defectIds = members.map((d) => d.id);

    if (n < cfg.minObservations || unresolved.length === 0) {
      monitored.push({
        key: defectIds.join('|'),
        latitude,
        longitude,
        defectIds,
        observationCount: n,
        reason:
          unresolved.length === 0
            ? 'All defect records in this area are repaired.'
            : 'Single report — no accumulated evidence yet.',
      });
      continue;
    }

    const pending = members.filter((d) => d.pendingReviewOf).length;
    const confirmed = members.length - pending;
    const recurredCount = members.filter(recurred).length;
    const severitySource = unresolved.flatMap((d) => d.observations);
    const highestSeverity = severitySource.reduce<Severity>(
      (worst, o) => (SEVERITY_RANK.indexOf(o.severity) > SEVERITY_RANK.indexOf(worst) ? o.severity : worst),
      'LOW',
    );
    const byType = new Map<DefectType, number>();
    members.forEach((d) => byType.set(d.defectType, (byType.get(d.defectType) ?? 0) + d.observations.length));
    const dominantType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const top = [...unresolved].sort((a, b) => b.priority - a.priority)[0];
    const lastObservedAt = Math.max(...observations.map((o) => o.timestamp));
    const radiusMeters = Math.max(
      cfg.minRadiusMeters,
      ...observations.map((o) => haversineMeters(latitude, longitude, o.latitude, o.longitude) + 10),
    );

    const factors: RiskHotspot['factors'] = {
      priority: factor(top.priority / 100, w.priority, `Highest open-defect priority ${top.priority} (${top.id})`),
      evidence: factor(n / cfg.evidenceSaturation, w.evidence, `${n} reports in this area; saturates at ${cfg.evidenceSaturation}`),
      multiplicity: factor(
        confirmed / cfg.multiplicitySaturation,
        w.multiplicity,
        `${confirmed} confirmed defect record${confirmed === 1 ? '' : 's'}${pending ? ` (+${pending} pending duplicate review, not counted)` : ''}`,
      ),
      unresolved: factor(unresolved.length / members.length, w.unresolved, `${unresolved.length} of ${members.length} defect records unresolved`),
      recurrence: factor(
        recurredCount / cfg.recurrenceSaturation,
        w.recurrence,
        recurredCount ? `${recurredCount} defect record(s) recurred after repair` : 'No recurrence recorded',
      ),
    };
    const attentionScore = Math.round(
      clamp01(Object.values(factors).reduce((s, f) => s + f.value * f.weight, 0)) * 100,
    );

    const explanation: string[] = [`Multiple observations: ${n} reports recorded in this area`];
    if (highestSeverity === 'HIGH' || highestSeverity === 'SEVERE') {
      explanation.push(`High-severity defect evidence: ${SEVERITY_LABELS[highestSeverity].toLowerCase()} severity reported on an open defect`);
    }
    explanation.push(`Unresolved maintenance: ${unresolved.length} of ${members.length} defect records open`);
    if (members.length > 1) {
      explanation.push(`Repeated reports in the same road area: ${members.length} defect records within ${cfg.linkDistanceMeters} m of each other`);
    } else {
      explanation.push(`Repeated reports of one ${DEFECT_TYPE_LABELS[dominantType].toLowerCase()}: corroborated by ${n} observations`);
    }
    if (pending) explanation.push(`${pending} record(s) pending duplicate review — may describe the same physical defect`);
    if (recurredCount) explanation.push(`${recurredCount} defect(s) recurred after repair`);
    if (now - lastObservedAt <= cfg.recentDays * DAY_MS) {
      explanation.push(`Recent evidence: last report ${((now - lastObservedAt) / DAY_MS).toFixed(1)} days ago`);
    }

    candidates.push({
      latitude,
      longitude,
      radiusMeters,
      defectIds,
      defectCount: members.length,
      observationCount: n,
      unresolvedCount: unresolved.length,
      repairedCount: members.length - unresolved.length,
      pendingReviewCount: pending,
      recurredCount,
      dominantType,
      highestSeverity,
      attentionScore,
      factors,
      explanation,
      lastObservedAt,
      firstSeen: Math.min(...observations.map((o) => o.timestamp)),
    });
  }

  // IDs follow first-observed order so they stay put when scores change.
  const hotspots = candidates
    .sort((a, b) => a.firstSeen - b.firstSeen)
    .map(({ firstSeen: _f, ...h }, i) => ({
      ...h,
      id: `HS-${regionCode(h.latitude, h.longitude)}-${String(i + 1).padStart(3, '0')}`,
    }))
    .sort((a, b) => b.attentionScore - a.attentionScore);

  return { hotspots, monitored };
}

export function useRiskAreas(): RiskAreas {
  const defects = useDefects();
  return useMemo(() => computeRiskAreas(defects), [defects]);
}

/** Attention bands reuse the priority tier cut-offs (75 / 55 / 35) for consistency. */
export function attentionLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: 'Critical attention', color: '#9A3412', bg: '#FDEAD7' };
  if (score >= 55) return { label: 'High attention', color: '#C2410C', bg: '#FEF0E6' };
  if (score >= 35) return { label: 'Elevated attention', color: '#B45309', bg: '#FEF6D8' };
  return { label: 'Watch', color: '#8A6100', bg: '#FEF6D8' };
}

export const ATTENTION_FACTOR_LABELS: Record<keyof RiskHotspot['factors'], string> = {
  priority: 'Highest open priority',
  evidence: 'Observation volume',
  multiplicity: 'Defect records',
  unresolved: 'Unresolved share',
  recurrence: 'Recurrence',
};

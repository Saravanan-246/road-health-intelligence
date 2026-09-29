import type { Defect, DefectStatus, Observation } from '../../../api/types';
import { calculatePriority } from './priorityService';

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${rand}`;
}

/** Auto-derived status only covers evidence states; later states are workflow-driven. */
function deriveStatus(current: DefectStatus | null, observationCount: number): DefectStatus {
  if (current && current !== 'CANDIDATE' && current !== 'CORROBORATED') return current;
  return observationCount >= 2 ? 'CORROBORATED' : 'CANDIDATE';
}

function withPriority(defect: Omit<Defect, 'priority' | 'priorityBreakdown' | 'priorityComputedAt'>, now: number): Defect {
  const { score, breakdown } = calculatePriority({ observations: defect.observations, now });
  return { ...defect, priority: score, priorityBreakdown: breakdown, priorityComputedAt: now };
}

export function createDefect(observation: Observation, now: number): Defect {
  return withPriority(
    {
      id: makeId('RD'),
      defectType: observation.defectType,
      latitude: observation.latitude,
      longitude: observation.longitude,
      observations: [observation],
      status: deriveStatus(null, 1),
    },
    now,
  );
}

/** Adds evidence to an existing defect; location becomes the mean of observations. */
export function addObservation(defect: Defect, observation: Observation, now: number): Defect {
  const observations = [...defect.observations, observation];
  const n = observations.length;
  return withPriority(
    {
      id: defect.id,
      defectType: defect.defectType,
      latitude: observations.reduce((s, o) => s + o.latitude, 0) / n,
      longitude: observations.reduce((s, o) => s + o.longitude, 0) / n,
      observations,
      status: deriveStatus(defect.status, n),
    },
    now,
  );
}

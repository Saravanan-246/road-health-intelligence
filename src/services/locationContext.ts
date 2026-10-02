/**
 * Location importance, kept separate from physical defect priority.
 *
 * Physical priority (severity, evidence, recency) is computed by priorityService and is never
 * changed here. Location context says whether a defect lies near a critical facility; the
 * attention tier combines the two with a bounded rule so "hospital nearby" can never on its
 * own make a minor defect the most urgent one.
 */
import type { Defect, PriorityTier } from '../api/types';
import { haversineMeters } from '../citizen/utils/distance';
import { priorityTier } from '../citizen/services/devMock/priorityService';
import { DEMO_FACILITIES, type DemoFacility, type FacilityCategory } from '../data/demoFacilities';

/**
 * Straight-line distance bands per facility type. HIGH is reserved for emergency access and
 * child-safety facilities; other facilities can at most raise the context to ELEVATED.
 */
export const FACILITY_RULES: Record<FacilityCategory, { label: string; code: string; highWithinM: number | null; elevatedWithinM: number }> = {
  EMERGENCY_HOSPITAL: { label: 'Emergency hospital', code: 'ER', highWithinM: 300, elevatedWithinM: 600 },
  HOSPITAL: { label: 'Hospital', code: 'H', highWithinM: 200, elevatedWithinM: 500 },
  FIRE_STATION: { label: 'Fire station', code: 'F', highWithinM: 200, elevatedWithinM: 500 },
  SCHOOL: { label: 'School', code: 'S', highWithinM: 150, elevatedWithinM: 400 },
  CLINIC_24H: { label: '24/7 clinic', code: 'C', highWithinM: 100, elevatedWithinM: 300 },
  COLLEGE: { label: 'College', code: 'Co', highWithinM: null, elevatedWithinM: 300 },
  POLICE_STATION: { label: 'Police station', code: 'P', highWithinM: null, elevatedWithinM: 300 },
  PHARMACY: { label: 'Pharmacy', code: 'Rx', highWithinM: null, elevatedWithinM: 150 },
  BUS_STOP: { label: 'Bus stop', code: 'B', highWithinM: null, elevatedWithinM: 100 },
  RAILWAY_STATION: { label: 'Railway station', code: 'R', highWithinM: null, elevatedWithinM: 300 },
  PUBLIC_FACILITY: { label: 'Public facility', code: 'PF', highWithinM: null, elevatedWithinM: 150 },
};

export type ContextLevel = 'HIGH' | 'ELEVATED' | 'NORMAL';

export const CONTEXT_LABELS: Record<ContextLevel, string> = {
  HIGH: 'HIGH ATTENTION CONTEXT',
  ELEVATED: 'ELEVATED CONTEXT',
  NORMAL: 'NORMAL CONTEXT',
};

export interface NearbyFacility {
  facility: DemoFacility;
  distanceM: number;
  level: Exclude<ContextLevel, 'NORMAL'>;
  /** The band that matched, e.g. "Emergency hospital within 300 m". */
  rule: string;
}

export interface LocationContext {
  level: ContextLevel;
  nearby: NearbyFacility[];
  /** True while facilities come from the staged demo dataset. */
  demoData: boolean;
}

export function locationContextFor(latitude: number, longitude: number, facilities: DemoFacility[] = DEMO_FACILITIES): LocationContext {
  const nearby: NearbyFacility[] = [];
  for (const facility of facilities) {
    const r = FACILITY_RULES[facility.category];
    const distanceM = haversineMeters(latitude, longitude, facility.latitude, facility.longitude);
    if (r.highWithinM !== null && distanceM <= r.highWithinM) {
      nearby.push({ facility, distanceM, level: 'HIGH', rule: `${r.label} within ${r.highWithinM} m` });
    } else if (distanceM <= r.elevatedWithinM) {
      nearby.push({ facility, distanceM, level: 'ELEVATED', rule: `${r.label} within ${r.elevatedWithinM} m` });
    }
  }
  nearby.sort((a, b) => Number(b.level === 'HIGH') - Number(a.level === 'HIGH') || a.distanceM - b.distanceM);
  const level: ContextLevel = nearby.some((n) => n.level === 'HIGH') ? 'HIGH' : nearby.length ? 'ELEVATED' : 'NORMAL';
  return { level, nearby, demoData: facilities === DEMO_FACILITIES };
}

const TIERS: PriorityTier[] = ['Low', 'Medium', 'High', 'Critical'];

export interface AttentionContext {
  physicalScore: number;
  physicalTier: PriorityTier;
  context: LocationContext;
  attentionTier: PriorityTier;
  raised: boolean;
  explanation: string;
}

/**
 * Attention = physical priority, raised by at most ONE tier when the defect is unresolved and
 * lies in a HIGH attention context. ELEVATED context is reported but does not change the tier.
 */
export function attentionContext(defect: Defect, context = locationContextFor(defect.latitude, defect.longitude)): AttentionContext {
  const physicalTier = priorityTier(defect.priority);
  const open = defect.status !== 'REPAIRED';
  const raise = open && context.level === 'HIGH' && physicalTier !== 'Critical';
  const attentionTier = raise ? TIERS[TIERS.indexOf(physicalTier) + 1] : physicalTier;
  const lead = context.nearby[0];
  const near = lead ? `${lead.facility.name} is ~${Math.round(lead.distanceM)} m away (${lead.rule})` : 'No critical facility in range';

  let explanation: string;
  if (context.level === 'NORMAL') {
    explanation = `${near}. Attention follows the physical priority (${physicalTier}).`;
  } else if (!open) {
    explanation = `${near}. The defect is repaired, so location context does not raise attention.`;
  } else if (raise) {
    explanation = `${near}. HIGH attention context raises attention one tier, from ${physicalTier} to ${attentionTier}.`;
  } else if (context.level === 'HIGH') {
    explanation = `${near}. Physical priority is already Critical; location context is noted.`;
  } else {
    explanation = `${near}. ELEVATED context is noted for scheduling but does not change the tier.`;
  }
  return { physicalScore: defect.priority, physicalTier, context, attentionTier, raised: raise, explanation };
}

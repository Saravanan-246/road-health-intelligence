/**
 * Turns recorded identity-engine output into plain-language explanations.
 *
 * Nothing here decides identity. Every sentence is built from values the engines produced
 * (DuplicateAnalysis.evidence for the live pipeline, IdentityDecision channels for
 * road-frame analysis) so the UI never shows a reason the engine did not use.
 */
import type {
  Defect,
  DuplicateAnalysis,
  DuplicateDecision,
  IdentityChannel,
  IdentityDecision,
  IdentitySafeguard,
  Observation,
  RoadFrame,
} from '../api/types';
import { DEFECT_TYPE_LABELS } from '../api/types';
import { haversineMeters } from '../citizen/utils/distance';
import { projectToRoadFrame } from './roadFrame';
import { resolveRoadFrameIdentity } from './roadFrameIdentity';

export type FactorTone = 'support' | 'against' | 'caution' | 'neutral';

export interface ExplanationFactor {
  label: string;
  text: string;
  tone: FactorTone;
}

export interface DecisionExplanation {
  decision: DuplicateDecision;
  heading: string;
  summary: string;
  factors: ExplanationFactor[];
  /** Evidence channels the deciding engine did not use, stated so they are not assumed. */
  notUsed: string[];
  /** Set when reports are close together yet not merged: SAME AREA ≠ SAME DEFECT. */
  sameArea?: { distanceM: number; text: string } | null;
}

export const DECISION_META: Record<
  DuplicateDecision,
  { meaning: string; heading: string; color: string; bg: string }
> = {
  MERGE: { meaning: 'Same physical defect', heading: 'Why merged', color: '#067647', bg: '#E3F4EA' },
  REVIEW: { meaning: 'Insufficient evidence', heading: 'Why pending review', color: '#8A6100', bg: '#FEF6D8' },
  DISTINCT: { meaning: 'Different physical defects', heading: 'Why kept separate', color: '#1D4ED8', bg: '#E8EEFD' },
};

const m = (n: number) => `${n.toFixed(1)} m`;

const IMAGE_NOT_COMPARED =
  'Image evidence: attached for human verification. No image-comparison model is connected, so images are not compared automatically.';

/* ------------------------------------------------------------------ */
/* Live pipeline (Radius-V1) — the engine that decides submitted reports */
/* ------------------------------------------------------------------ */

/**
 * @param recorded the decision stored on the observation; differs from analysis.decision
 *   when an authority resolved a REVIEW.
 */
export function explainDuplicateAnalysis(
  recorded: DuplicateDecision,
  analysis: DuplicateAnalysis | undefined,
  comparedDefectId: string | null | undefined,
): DecisionExplanation {
  const heading = DECISION_META[recorded].heading;
  const notUsed = [
    IMAGE_NOT_COMPARED,
    'Road-frame position: recorded for every report and shown as context; this decision used location and defect type.',
  ];

  if (!analysis || !comparedDefectId) {
    return {
      decision: recorded,
      heading: 'Why a new defect record',
      summary: 'No open defect record was available to compare against, so a new Digital Defect ID was created.',
      factors: [
        {
          label: 'Candidates',
          text: 'No open defect records existed when this report was submitted. Repaired defects and records awaiting review are not merge targets.',
          tone: 'neutral',
        },
      ],
      notUsed: [IMAGE_NOT_COMPARED],
    };
  }

  const ev = analysis.evidence;
  const factors: ExplanationFactor[] = [];

  if (recorded !== analysis.decision) {
    factors.push({
      label: 'Authority review',
      text: `Automatic analysis returned ${analysis.decision}. An authority reviewed the evidence and ${
        recorded === 'MERGE' ? `merged it into ${comparedDefectId}` : 'kept it as a separate defect'
      }.`,
      tone: recorded === 'MERGE' ? 'support' : 'against',
    });
  }

  factors.push({
    label: 'GPS distance',
    text: `Reported location is ${m(analysis.distanceMeters)} from ${comparedDefectId}.`,
    tone: ev ? (ev.withinGate ? 'support' : 'against') : 'neutral',
  });

  if (!ev) {
    // Older records without structured evidence: show the engine's own reason trace.
    analysis.reasons.forEach((r) => factors.push({ label: 'Engine', text: r, tone: 'neutral' }));
    return { decision: recorded, heading, summary: `Recorded decision: ${analysis.decision}.`, factors, notUsed };
  }

  const acc = (v: number | null, who: string) =>
    v !== null ? `${who} ±${v.toFixed(0)} m` : `${who} unknown (±${ev.assumedAccuracyMeters} m assumed)`;
  factors.push({
    label: 'GPS accuracy',
    text: `Location uncertainty is ±${ev.combinedUncertaintyMeters.toFixed(1)} m combined (${acc(
      ev.observationAccuracyMeters,
      'this report',
    )}; ${acc(ev.defectAccuracyMeters, 'existing record')}).`,
    tone: ev.blockedBy.includes('GPS_UNCERTAINTY') ? 'caution' : 'neutral',
  });
  factors.push({
    label: 'Search gate',
    text: ev.withinGate
      ? `Inside the ${m(ev.gateRadiusMeters)} search gate, which widens with GPS uncertainty.`
      : `Outside the ${m(ev.gateRadiusMeters)} search gate, which already allows for GPS uncertainty.`,
    tone: ev.withinGate ? 'support' : 'against',
  });

  if (ev.withinGate) {
    factors.push({
      label: 'Defect type',
      text: ev.typeAgrees ? 'Both reports describe the same defect type.' : 'The reports describe different defect types.',
      tone: ev.typeAgrees ? 'support' : 'against',
    });
    factors.push({
      label: 'Evidence score',
      text: `Combined score ${analysis.score.toFixed(2)} (merge at ${ev.mergeThreshold}, review at ${ev.reviewThreshold}).`,
      tone: analysis.score >= ev.mergeThreshold ? 'support' : analysis.score >= ev.reviewThreshold ? 'caution' : 'against',
    });
  }
  if (ev.blockedBy.includes('TYPE_CONFLICT')) {
    factors.push({ label: 'Safeguard', text: 'Different defect types block an automatic merge.', tone: 'caution' });
  }
  const tooUncertain = ev.combinedUncertaintyMeters > ev.maxUncertaintyForAutoMergeMeters;
  if (ev.blockedBy.includes('GPS_UNCERTAINTY')) {
    factors.push({
      label: 'Safeguard',
      text: `Combined uncertainty ±${ev.combinedUncertaintyMeters.toFixed(1)} m exceeds the ${ev.maxUncertaintyForAutoMergeMeters} m limit for an automatic merge.`,
      tone: 'caution',
    });
  } else if (analysis.decision === 'REVIEW' && tooUncertain) {
    // The score already stopped the merge; the uncertainty limit would have stopped it too.
    factors.push({
      label: 'Safeguard',
      text: `Combined uncertainty ±${ev.combinedUncertaintyMeters.toFixed(1)} m is also above the ${ev.maxUncertaintyForAutoMergeMeters} m limit, so this report could not be merged automatically at any score.`,
      tone: 'caution',
    });
  }

  let summary: string;
  if (analysis.decision === 'MERGE') {
    summary = 'Location and defect type are consistent with the same physical defect.';
  } else if (analysis.decision === 'REVIEW') {
    if (ev.blockedBy.includes('GPS_UNCERTAINTY')) {
      summary = 'Location uncertainty is too high to safely determine whether these reports show the same physical defect.';
    } else if (ev.blockedBy.includes('TYPE_CONFLICT')) {
      summary = 'The reports are close together but describe different defect types, so they are not merged automatically.';
    } else {
      summary =
        `Evidence is not strong enough for an automatic decision: score ${analysis.score.toFixed(2)} is below the ${ev.mergeThreshold} merge threshold` +
        (tooUncertain
          ? `, and location uncertainty (±${ev.combinedUncertaintyMeters.toFixed(1)} m) is too high to safely determine whether these reports show the same physical defect.`
          : '.');
    }
  } else {
    summary = ev.withinGate
      ? `A nearby record exists, but the evidence score ${analysis.score.toFixed(2)} is below the review threshold.`
      : `The nearest open defect record is ${m(analysis.distanceMeters)} away — beyond the search gate — so this is treated as a different physical defect.`;
  }
  if (recorded !== analysis.decision) {
    summary = `${summary} Final outcome set by authority review: ${recorded}.`;
  }

  return { decision: recorded, heading, summary, factors, notUsed };
}

/* ------------------------------------------------------------------ */
/* Road-frame analysis (RoadFrame-V1)                                 */
/* ------------------------------------------------------------------ */

function structuralText(ch: IdentityChannel, a: RoadFrame | undefined, b: RoadFrame | undefined): string {
  if (ch.verdict === 'SUPPORT') return `Both observations project to the same road (${a?.way_name ?? a?.way_id}).`;
  if (ch.verdict === 'AGAINST') return `Observations project to different roads: ${a?.way_name} and ${b?.way_name}.`;
  return 'Road-frame projection unavailable — at least one observation is off the mapped road network.';
}

function lateralText(ch: IdentityChannel, a: RoadFrame | undefined, b: RoadFrame | undefined): string {
  if (ch.verdict === 'SUPPORT') return `Both observations are on the same side of the road (side ${a?.side}).`;
  if (ch.verdict === 'AGAINST') return `Observations are on opposite sides of the centerline (side ${a?.side} and side ${b?.side}).`;
  if (ch.detail.includes('centerline')) {
    return 'Road side cannot be resolved: at least one observation lies within 2 m of the centerline, inside GPS noise.';
  }
  return 'Road side unavailable for at least one observation.';
}

function longitudinalText(ch: IdentityChannel, fallback: boolean): string {
  const what = fallback ? 'Straight-line GPS separation' : 'Along-road (chainage) separation';
  const d = ch.delta_m !== undefined ? m(ch.delta_m) : 'unknown';
  const tol = ch.tol_m !== undefined ? m(ch.tol_m) : 'the tolerance';
  if (ch.verdict === 'SUPPORT') return `${what} ${d} is within the ${tol} tolerance.`;
  if (ch.verdict === 'AGAINST') return `${what} ${d} exceeds the ${tol} tolerance by more than the GPS uncertainty.`;
  return `${what} ${d} overlaps the GPS uncertainty band — it neither confirms nor rules out a match.`;
}

const TONE: Record<IdentityChannel['verdict'], FactorTone> = { SUPPORT: 'support', AGAINST: 'against', ABSTAIN: 'caution' };

/** Reports this close together are "the same area" for the SAME AREA ≠ SAME DEFECT callout. */
export const SAME_AREA_METERS = 25;

const accText = (o: Observation) =>
  o.accuracyMeters !== null ? `±${o.accuracyMeters.toFixed(0)} m` : 'unknown (±15 m assumed by road-frame)';

export function explainRoadFrameDecision(d: IdentityDecision, a: Observation, b: Observation): DecisionExplanation {
  const fallback = !!d.off_network_fallback;
  const distance = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  const factors: ExplanationFactor[] = [
    { label: 'GPS distance', text: `Reported locations differ by ${m(distance)}.`, tone: 'neutral' },
    {
      label: 'GPS accuracy',
      text: `Location uncertainty is ${accText(a)} and ${accText(b)}; tolerance ${m(d.tol_m)} (combined accuracy, clamped to 5–25 m).`,
      tone: d.tol_m > 20 ? 'caution' : 'neutral',
    },
    { label: 'Road frame', text: structuralText(d.channels.structural, a.roadFrame, b.roadFrame), tone: TONE[d.channels.structural.verdict] },
    { label: 'Road side', text: lateralText(d.channels.lateral, a.roadFrame, b.roadFrame), tone: TONE[d.channels.lateral.verdict] },
    { label: fallback ? 'GPS separation' : 'Along the road', text: longitudinalText(d.channels.longitudinal, fallback), tone: TONE[d.channels.longitudinal.verdict] },
    { label: 'Temporal', text: d.channels.temporal.detail + '.', tone: TONE[d.channels.temporal.verdict] },
  ];
  if (d.veto) factors.unshift({ label: 'Hard veto', text: d.veto + '.', tone: 'against' });
  if (d.merge_blocked_by === 'ALONG_ROAD_AMBIGUITY') {
    factors.push({
      label: 'Safeguard',
      text: `The ${m(d.channels.longitudinal.delta_m ?? 0)} along-road gap is beyond the ${m(d.tol_m)} tolerance but inside GPS uncertainty, so two nearby defects cannot be ruled out. Automatic merge blocked.`,
      tone: 'caution',
    });
  }

  let summary: string;
  if (d.verdict === 'MERGE') summary = 'Evidence supports the same physical defect.';
  else if (d.verdict === 'DISTINCT') {
    summary = d.veto
      ? `${d.veto}. The system therefore avoids merging them, even if the coordinates are close.`
      : 'The observations are too far apart along the road to be the same defect.';
  } else if (d.merge_blocked_by === 'ALONG_ROAD_AMBIGUITY') {
    summary =
      'The reports are on the same road and side, but too far apart along it to be sure they show one defect, and too close to prove they are two. Held for review instead of being merged.';
  } else {
    summary = d.tol_m > 20
      ? 'Location uncertainty is too high to safely determine whether these observations represent the same physical defect.'
      : 'Identity channels do not provide enough support for an automatic decision.';
  }
  // A veto is already stated in full above; other rules add the channel count or limit.
  if (d.decision_rule && !d.veto) summary = `${summary} Rule applied: ${d.decision_rule}.`;

  const why =
    d.channels.structural.verdict === 'AGAINST'
      ? `they project onto different roads (${a.roadFrame?.way_name} and ${b.roadFrame?.way_name})`
      : d.channels.lateral.verdict === 'AGAINST'
        ? 'they are on opposite sides of the centreline'
        : 'their positions along the road are too far apart';
  const sameArea =
    distance <= SAME_AREA_METERS && (d.verdict === 'DISTINCT' || d.merge_blocked_by === 'ALONG_ROAD_AMBIGUITY')
      ? {
          distanceM: distance,
          text:
            d.verdict === 'DISTINCT'
              ? `These reports are only ${m(distance)} apart, but ${why}. Nearby coordinates alone do not make them one defect, so they are kept separate.`
              : `These reports are only ${m(distance)} apart, yet the road frame cannot confirm they show one defect. They are not merged automatically.`,
        }
      : null;

  return {
    decision: d.verdict,
    heading: DECISION_META[d.verdict].heading,
    summary,
    factors,
    notUsed: [IMAGE_NOT_COMPARED, 'Defect type: not an input to road-frame identity.'],
    sameArea,
  };
}

/* ------------------------------------------------------------------ */
/* Live decisions: explain with the engine that actually decided      */
/* ------------------------------------------------------------------ */

const SAFEGUARD_TEXT: Record<IdentitySafeguard, (o: Observation) => string> = {
  TYPE_CONFLICT: () => 'Road-frame evidence matches, but the reports describe different defect types. Different types block an automatic merge.',
  GPS_UNCERTAINTY: (o) =>
    `Combined location uncertainty is ±${(o.duplicateAnalysis?.evidence?.combinedUncertaintyMeters ?? 0).toFixed(1)} m, above the ${o.duplicateAnalysis?.evidence?.maxUncertaintyForAutoMergeMeters ?? 20} m limit for an automatic merge.`,
  SNAP_UNCERTAIN: () => 'At least one report lies more than 5 m from the road centreline, so its road position is uncertain.',
};

/** Label for the engine that decided a live observation. */
export function engineLabel(o: Observation, audience: 'citizen' | 'admin'): string {
  if (o.identity?.engine === 'roadframe-v1') {
    return audience === 'admin'
      ? 'Decided by Road-Frame Identity Resolution (RoadFrame-V1) with Radius-V1 safeguards.'
      : 'Decided using the road position of both reports.';
  }
  return audience === 'admin'
    ? 'Off-network fallback: decided by the legacy radius engine (Radius-V1: GPS gate + defect type).'
    : 'This location is outside the mapped demo roads, so a distance-based check was used.';
}

/**
 * Explains a live observation's recorded identity decision. Road-frame decisions are
 * explained from their channels plus any safeguards; off-network decisions from Radius-V1.
 */
export function explainObservationIdentity(o: Observation, compared: Observation | null): DecisionExplanation {
  const recorded = o.duplicateDecision ?? 'DISTINCT';
  const id = o.identity;

  if (!id || id.engine === 'radius-v1-fallback' || !id.roadFrame || !compared) {
    const base = explainDuplicateAnalysis(recorded, o.duplicateAnalysis, o.comparedDefectId);
    if (id?.engine === 'radius-v1-fallback') {
      base.factors.push({
        label: 'Road frame',
        text: 'Unavailable: at least one report is off the mapped demo road network, so the legacy radius logic decided (off-network fallback).',
        tone: 'neutral',
      });
      base.notUsed = base.notUsed.filter((n) => !n.startsWith('Road-frame position'));
    }
    return base;
  }

  const rf = explainRoadFrameDecision(id.roadFrame, o, compared);
  const factors = [...rf.factors];
  let summary = rf.summary;
  let decision = id.roadFrame.verdict;
  if (id.safeguards.length) {
    decision = 'REVIEW';
    id.safeguards.forEach((s) => factors.push({ label: 'Safeguard', text: SAFEGUARD_TEXT[s](o), tone: 'caution' }));
    summary = 'Road-frame evidence alone would merge these reports, but a safeguard blocks automatic merging, so an authority decides.';
  }
  if (recorded !== id.automaticDecision) {
    factors.unshift({
      label: 'Authority review',
      text: `Automatic analysis returned ${id.automaticDecision}. An authority reviewed the evidence and ${
        recorded === 'MERGE' ? `merged it into ${o.comparedDefectId}` : 'kept it as a separate defect'
      }.`,
      tone: recorded === 'MERGE' ? 'support' : 'against',
    });
    summary = `${summary} Final outcome set by authority review: ${recorded}.`;
  }
  return {
    decision: recorded,
    heading: DECISION_META[recorded].heading,
    summary,
    factors,
    notUsed: [IMAGE_NOT_COMPARED, 'Defect type: checked as a safeguard — a type conflict blocks an automatic merge.'],
    sameArea: decision === recorded ? rf.sameArea : null,
  };
}

/* ------------------------------------------------------------------ */
/* Pairwise evidence                                                  */
/* ------------------------------------------------------------------ */

export interface PairEvidence {
  a: Observation;
  b: Observation;
  rfA: RoadFrame;
  rfB: RoadFrame;
  distanceM: number;
  chainageDeltaM: number | null;
  lateralDeltaM: number | null;
  timeDeltaMs: number;
  roadFrame: IdentityDecision;
  compatibility: { label: 'Compatible' | 'Incompatible' | 'Uncertain' | 'Unavailable'; text: string };
}

/** Compares two observations across location, road-frame, temporal and image evidence. */
export function compareObservations(a: Observation, b: Observation, now = Date.now()): PairEvidence {
  const rfA = a.roadFrame ?? projectToRoadFrame(a);
  const rfB = b.roadFrame ?? projectToRoadFrame(b);
  const withA = { ...a, roadFrame: rfA };
  const withB = { ...b, roadFrame: rfB };
  const roadFrame = resolveRoadFrameIdentity(withA, withB, now);
  const onNet = rfA.snap_confidence !== 'NONE' && rfB.snap_confidence !== 'NONE';
  const sameWay = onNet && rfA.way_id === rfB.way_id;

  const { structural, lateral } = roadFrame.channels;
  const compatibility: PairEvidence['compatibility'] =
    structural.verdict === 'ABSTAIN'
      ? { label: 'Unavailable', text: 'At least one observation is off the mapped road network.' }
      : structural.verdict === 'AGAINST'
        ? { label: 'Incompatible', text: 'The observations are on different roads.' }
        : lateral.verdict === 'AGAINST'
          ? { label: 'Incompatible', text: 'Same road, opposite sides of the centerline.' }
          : lateral.verdict === 'ABSTAIN'
            ? { label: 'Uncertain', text: 'Same road; side of road cannot be resolved.' }
            : { label: 'Compatible', text: 'Same road, same side.' };

  return {
    a: withA,
    b: withB,
    rfA,
    rfB,
    distanceM: haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude),
    chainageDeltaM: sameWay && rfA.chainage_m !== null && rfB.chainage_m !== null ? Math.abs(rfA.chainage_m - rfB.chainage_m) : null,
    lateralDeltaM:
      sameWay && rfA.lateral_offset_m !== null && rfB.lateral_offset_m !== null
        ? Math.abs(rfA.lateral_offset_m - rfB.lateral_offset_m)
        : null,
    timeDeltaMs: Math.abs(a.timestamp - b.timestamp),
    roadFrame,
    compatibility,
  };
}

export function formatDuration(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return 'under a minute';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

/** Short description of what the compared record already holds (identity evidence, factor 10). */
export function describeExistingEvidence(defect: Defect | undefined, fallbackId: string | null | undefined): string {
  if (!defect) return fallbackId ? `${fallbackId} is no longer a separate record (merged or deleted).` : 'No existing record.';
  const n = defect.observations.length;
  return `${defect.id}: ${n} observation${n === 1 ? '' : 's'} of ${DEFECT_TYPE_LABELS[defect.defectType].toLowerCase()}, status ${defect.status}.`;
}

import type { Observation, IdentityDecision, IdentityChannel, DuplicateDecision } from '../api/types';
import { haversineMeters } from '../citizen/utils/distance';

interface RoadFrameIdentityInput {
  obsA: Observation;
  obsB: Observation;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function onNetwork(obs: Observation): boolean {
  return !!obs.roadFrame && obs.roadFrame.snap_confidence !== 'NONE';
}

function structuralChannel(obsA: Observation, obsB: Observation): IdentityChannel {
  const rfA = obsA.roadFrame;
  const rfB = obsB.roadFrame;

  if (!rfA || !rfB || rfA.snap_confidence === 'NONE' || rfB.snap_confidence === 'NONE') {
    return {
      verdict: 'ABSTAIN',
      detail: 'One or both observations off-network or snap unavailable',
    };
  }

  if (rfA.way_id !== rfB.way_id) {
    return {
      verdict: 'AGAINST',
      detail: `Different ways: ${rfA.way_name} vs ${rfB.way_name}`,
    };
  }

  return {
    verdict: 'SUPPORT',
    detail: `Same way (${rfA.way_name})`,
  };
}

function lateralChannel(obsA: Observation, obsB: Observation): IdentityChannel {
  const rfA = obsA.roadFrame;
  const rfB = obsB.roadFrame;

  if (!rfA || !rfB || rfA.snap_confidence === 'NONE' || rfB.snap_confidence === 'NONE') {
    return {
      verdict: 'ABSTAIN',
      detail: 'Off-network or snap unavailable',
    };
  }

  if (rfA.side === null || rfB.side === null) {
    return {
      verdict: 'ABSTAIN',
      detail: 'Side determination uncertain',
    };
  }

  const lateralA = rfA.lateral_offset_m ?? 0;
  const lateralB = rfB.lateral_offset_m ?? 0;

  if (rfA.side === rfB.side) {
    return {
      verdict: 'SUPPORT',
      detail: `Same side of road (${rfA.side})`,
    };
  } else {
    const nearCenterlineA = lateralA <= 2;
    const nearCenterlineB = lateralB <= 2;

    if (nearCenterlineA || nearCenterlineB) {
      return {
        verdict: 'ABSTAIN',
        detail: 'Opposite sides but at least one near centerline (GPS noise)',
      };
    }

    return {
      verdict: 'AGAINST',
      detail: `Opposite sides: ${rfA.side} vs ${rfB.side}`,
    };
  }
}

function longitudinalChannel(obsA: Observation, obsB: Observation, tol_m: number): IdentityChannel {
  const rfA = obsA.roadFrame;
  const rfB = obsB.roadFrame;

  const accA = obsA.accuracyMeters ?? 15;
  const accB = obsB.accuracyMeters ?? 15;
  const sigmaPair = Math.sqrt(accA * accA + accB * accB);

  // Off-network fallback: without a road frame there is no chainage, so the same
  // tolerance test is applied to straight-line GPS separation instead.
  if (!rfA || !rfB || !onNetwork(obsA) || !onNetwork(obsB)) {
    const delta = haversineMeters(obsA.latitude, obsA.longitude, obsB.latitude, obsB.longitude);
    const margin = (tol_m - delta) / sigmaPair;
    const base = { delta_m: delta, tol_m, margin_sigma: margin };
    if (margin > 1) {
      return { verdict: 'SUPPORT', detail: `Off-network fallback: GPS separation ${delta.toFixed(1)} m < ${tol_m.toFixed(1)} m tolerance`, ...base };
    }
    if (margin < -1) {
      return { verdict: 'AGAINST', detail: `Off-network fallback: GPS separation ${delta.toFixed(1)} m >> ${tol_m.toFixed(1)} m tolerance`, ...base };
    }
    return { verdict: 'ABSTAIN', detail: `Off-network fallback: GPS separation ${delta.toFixed(1)} m overlaps GPS uncertainty band`, ...base };
  }

  const chainageA = rfA.chainage_m ?? 0;
  const chainageB = rfB.chainage_m ?? 0;
  const delta = Math.abs(chainageA - chainageB);
  const margin = (tol_m - delta) / sigmaPair;

  if (margin > 1) {
    return {
      verdict: 'SUPPORT',
      detail: `Same chainage (Δ ${delta.toFixed(1)} m < ${tol_m.toFixed(1)} m tolerance)`,
      delta_m: delta,
      tol_m,
      margin_sigma: margin,
    };
  } else if (margin < -1) {
    return {
      verdict: 'AGAINST',
      detail: `Too far apart (Δ ${delta.toFixed(1)} m >> ${tol_m.toFixed(1)} m)`,
      delta_m: delta,
      tol_m,
      margin_sigma: margin,
    };
  } else {
    return {
      verdict: 'ABSTAIN',
      detail: `Chainage difference (${delta.toFixed(1)} m) overlaps GPS uncertainty band`,
      delta_m: delta,
      tol_m,
      margin_sigma: margin,
    };
  }
}

function temporalChannel(obsA: Observation, obsB: Observation): IdentityChannel {
  const timeA = obsA.timestamp;
  const timeB = obsB.timestamp;
  const dayMs = 24 * 60 * 60 * 1000;
  const timeDiff = Math.abs(timeA - timeB);

  if (timeDiff < 3 * dayMs) {
    return {
      verdict: 'SUPPORT',
      detail: `Recent observations (${(timeDiff / dayMs).toFixed(1)} days apart)`,
    };
  } else if (timeDiff > 30 * dayMs) {
    return {
      verdict: 'ABSTAIN',
      detail: 'Large time gap — road may have changed',
    };
  } else {
    return {
      verdict: 'ABSTAIN',
      detail: `Moderate time gap (${(timeDiff / dayMs).toFixed(1)} days)`,
    };
  }
}

export function resolveRoadFrameIdentity(
  obsA: Observation,
  obsB: Observation,
  now = Date.now(),
): IdentityDecision {
  const reasonTrace: string[] = [];
  const rfA = obsA.roadFrame;
  const rfB = obsB.roadFrame;

  const accA = obsA.accuracyMeters ?? 15;
  const accB = obsB.accuracyMeters ?? 15;
  const sigmaPair = Math.sqrt(accA * accA + accB * accB);
  const tol_m = clamp(sigmaPair, 5, 25);

  const structural = structuralChannel(obsA, obsB);
  const lateral = lateralChannel(obsA, obsB);
  const longitudinal = longitudinalChannel(obsA, obsB, tol_m);
  const temporal = temporalChannel(obsA, obsB);

  const offNetworkFallback = !onNetwork(obsA) || !onNetwork(obsB);

  reasonTrace.push(`Structural: ${structural.detail}`);
  reasonTrace.push(`Lateral: ${lateral.detail}`);
  reasonTrace.push(`Longitudinal: ${longitudinal.detail}`);
  reasonTrace.push(`Temporal: ${temporal.detail}`);
  if (offNetworkFallback) {
    reasonTrace.push('Fallback: road frame unavailable, longitudinal test used straight-line GPS separation');
  }

  let veto: string | null = null;
  let rule = '';
  let mergeBlockedBy: IdentityDecision['merge_blocked_by'] = null;
  // Longitudinal ABSTAIN covers separations up to tol + 1σ. Beyond the tolerance itself the
  // gap may be real (two nearby defects), so other channels alone must not auto-merge.
  const alongRoadAmbiguous = longitudinal.verdict === 'ABSTAIN' && (longitudinal.delta_m ?? 0) > tol_m;
  const guardedMerge = (supportRule: string): DuplicateDecision => {
    if (!alongRoadAmbiguous) {
      rule = supportRule;
      return 'MERGE';
    }
    mergeBlockedBy = 'ALONG_ROAD_AMBIGUITY';
    reasonTrace.push('Guard: along-road separation beyond tolerance blocks auto-merge');
    rule = `${supportRule}, but the ${(longitudinal.delta_m ?? 0).toFixed(1)} m separation exceeds the ${tol_m.toFixed(1)} m tolerance — two nearby defects cannot be ruled out`;
    return 'REVIEW';
  };

  if (structural.verdict === 'AGAINST') {
    veto = structural.detail;
    reasonTrace.push(`VETO: Different ways`);
  } else if (lateral.verdict === 'AGAINST' && lateral.detail.includes('Opposite sides')) {
    const lateralA = rfA?.lateral_offset_m ?? 0;
    const lateralB = rfB?.lateral_offset_m ?? 0;
    const nearCenterlineA = lateralA <= 2;
    const nearCenterlineB = lateralB <= 2;

    if (!nearCenterlineA && !nearCenterlineB) {
      veto = `Same road, opposite side of centerline`;
      reasonTrace.push(`VETO: ${veto}`);
    }
  }

  let verdict: DuplicateDecision;

  if (veto) {
    verdict = 'DISTINCT';
    rule = `Hard veto: ${veto}`;
  } else {
    const supports = [
      structural.verdict === 'SUPPORT',
      lateral.verdict === 'SUPPORT',
      longitudinal.verdict === 'SUPPORT',
      temporal.verdict === 'SUPPORT',
    ];
    const abstains = [
      structural.verdict === 'ABSTAIN',
      lateral.verdict === 'ABSTAIN',
      longitudinal.verdict === 'ABSTAIN',
      temporal.verdict === 'ABSTAIN',
    ];
    const againsts = [
      structural.verdict === 'AGAINST',
      lateral.verdict === 'AGAINST',
      longitudinal.verdict === 'AGAINST',
      temporal.verdict === 'AGAINST',
    ];

    const supportCount = supports.filter(Boolean).length;
    const abstainCount = abstains.filter(Boolean).length;
    const againstCount = againsts.filter(Boolean).length;

    if (againstCount >= 1) {
      verdict = 'DISTINCT';
      rule = `${againstCount} channel(s) against the same-defect hypothesis`;
    } else if (longitudinal.verdict === 'ABSTAIN' && tol_m > 20) {
      verdict = 'REVIEW';
      reasonTrace.push('High GPS uncertainty band (>20m) prevents auto-merge');
      rule = `GPS uncertainty band ${tol_m.toFixed(1)} m exceeds the 20 m auto-merge limit`;
    } else if (supportCount >= 3) {
      verdict = guardedMerge(`${supportCount} of 4 channels support, none against`);
    } else if (supportCount === 2) {
      if (abstainCount === 0) {
        verdict = guardedMerge('2 channels support, none against or abstaining');
      } else {
        verdict = 'REVIEW';
        rule = `Only 2 of 4 channels support; ${abstainCount} cannot decide`;
      }
    } else if (supportCount === 1) {
      verdict = 'REVIEW';
      rule = `Only 1 of 4 channels supports; ${abstainCount} cannot decide`;
    } else {
      verdict = abstainCount >= 1 ? 'REVIEW' : 'DISTINCT';
      rule = abstainCount >= 1 ? 'No channel supports and none rules the match out' : 'No channel supports';
    }
  }
  reasonTrace.push(`Decision: ${verdict} (${rule})`);

  return {
    verdict,
    channels: {
      structural,
      lateral,
      longitudinal,
      temporal,
    },
    veto,
    tol_m,
    margin_sigma: longitudinal.margin_sigma ?? null,
    reason_trace: reasonTrace,
    engine_version: 'roadframe-v1',
    decided_at: now,
    off_network_fallback: offNetworkFallback,
    decision_rule: rule,
    merge_blocked_by: mergeBlockedBy,
  };
}

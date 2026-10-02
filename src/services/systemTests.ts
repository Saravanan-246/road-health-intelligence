/**
 * Scenario tests for identity, location context, sensor normalisation, citizen status and
 * security. Deterministic and side-effect free: they never modify the demo store (sensor
 * tests use synthetic vectors, status tests synthetic defects, security tests unknown IDs).
 */
import type { Defect, Observation, StatusChange } from '../api/types';
import { deleteDefect, login, updateStatus, validateObservationInput, type NewObservation } from '../api/mockBackend';
import { createDefect } from '../citizen/services/devMock/defectService';
import { DEMO_CASES, type DemoCase } from '../data/identityDemoFixtures';
import { DEMO_FACILITIES } from '../data/demoFacilities';
import { resolveRoadFrameIdentity } from './roadFrameIdentity';
import { evaluateCandidate } from './identityPipeline';
import { attentionContext, locationContextFor } from './locationContext';
import { calibrate, calibrationState, driftDeg, normalise, type Vec3 } from './sensors/motionMath';
import { citizenStage, deriveNotifications } from './citizenStatus';

export type TestGroup = 'IDENTITY' | 'LOCATION' | 'SENSOR' | 'STATUS' | 'SECURITY';

export interface SystemTest {
  id: string;
  group: TestGroup;
  name: string;
  passed: boolean;
  detail: string;
}

export const GROUP_LABELS: Record<TestGroup, string> = {
  IDENTITY: 'Identity resolution',
  LOCATION: 'Location context',
  SENSOR: 'Sensor normalisation (synthetic inputs)',
  STATUS: 'Citizen status & notifications',
  SECURITY: 'Security',
};

function run(id: string, group: TestGroup, name: string, fn: () => string): SystemTest {
  try {
    return { id, group, name, passed: true, detail: fn() };
  } catch (e) {
    return { id, group, name, passed: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function expect(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const demo = (id: string): DemoCase => {
  const c = DEMO_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`Missing fixture ${id}`);
  return c;
};
const rfVerdict = (id: string) => resolveRoadFrameIdentity(demo(id).obsA, demo(id).obsB);
const asDefect = (o: Observation, priority = 50): Defect => ({
  id: 'TEST-DEFECT',
  defectType: o.defectType,
  latitude: o.latitude,
  longitude: o.longitude,
  observations: [o],
  status: 'CANDIDATE',
  priority,
  priorityBreakdown: {} as Defect['priorityBreakdown'],
  priorityComputedAt: 0,
});

/* ---------- sensor helpers: synthetic device-frame vectors ---------- */
const G = 9.81;
const unit = (v: Vec3): Vec3 => {
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};
const combine = (up: Vec3, upMag: number, side: Vec3, sideMag: number): Vec3 => ({
  x: up.x * upMag + side.x * sideMag,
  y: up.y * upMag + side.y * sideMag,
  z: up.z * upMag + side.z * sideMag,
});
/** 40 still samples with a small deterministic jitter (±0.02 m/s²). */
const stillSamples = (up: Vec3): Vec3[] =>
  Array.from({ length: 40 }, (_, i) => {
    const j = ((i % 5) - 2) * 0.01;
    return { x: up.x * G + j, y: up.y * G - j, z: up.z * G + j / 2 };
  });
/** A 3 m/s² vertical jolt plus 1.5 m/s² sideways in whatever posture `up` describes. */
function normalisedJolt(up: Vec3, side: Vec3) {
  const cal = calibrate(stillSamples(up), 0);
  if (!cal.ok) throw new Error(`Calibration failed: ${cal.detail}`);
  return { cal: cal.calibration, n: normalise(combine(up, G + 3, side, 1.5), cal.calibration) };
}
const close = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

/* ---------- status helpers ---------- */
const USER = 'USR-TEST-CIT';
function statusDefect(steps: DefectStatusStep[]): Defect {
  const t0 = 1_700_000_000_000;
  const o: Observation = {
    id: 'OB-TEST-1', imageUri: 'file:///test.jpg', defectType: 'POTHOLE', severity: 'HIGH', confidence: null,
    classificationSource: 'REPORTER', latitude: 11.0, longitude: 76.9, accuracyMeters: 5, locationSource: 'DEVICE',
    timestamp: t0, reporterId: USER, duplicateDecision: 'DISTINCT',
  };
  const d = createDefect(o, t0);
  const history: StatusChange[] = [{ from: null, to: d.status, at: t0, by: USER }];
  let status = d.status;
  steps.forEach((to, i) => {
    history.push({ from: status, to, at: t0 + (i + 1) * 60_000, by: 'USR-ADM-001' });
    status = to;
  });
  return { ...d, id: 'PTH-TEST-000001', status, history };
}
type DefectStatusStep = Defect['status'];
const titles = (d: Defect) => deriveNotifications([d], [], [], USER).map((n) => n.title);

export function runSystemTests(): SystemTest[] {
  const hospital = DEMO_FACILITIES.find((f) => f.category === 'EMERGENCY_HOSPITAL')!;
  const school = DEMO_FACILITIES.find((f) => f.category === 'SCHOOL')!;
  const near = (f: { latitude: number; longitude: number }, metresNorth: number) => ({
    latitude: f.latitude - metresNorth / 111_320,
    longitude: f.longitude,
  });

  return [
    // IDENTITY — scenarios 1–6
    run('T01', 'IDENTITY', 'Same pothole + GPS drift → MERGE', () => {
      expect(rfVerdict('CASE-02').verdict === 'MERGE', 'CASE-02 did not merge');
      expect(rfVerdict('CASE-10').verdict === 'MERGE', 'CASE-10 did not merge');
      return 'CASE-02 (28 m GPS drift, same chainage) and CASE-10 (repeat report) merge.';
    }),
    run('T02', 'IDENTITY', 'Nearby different potholes → DISTINCT (never auto-merged)', () => {
      expect(rfVerdict('CASE-04').verdict === 'DISTINCT', 'CASE-04 not distinct');
      expect(rfVerdict('CASE-08').verdict === 'DISTINCT', 'CASE-08 not distinct');
      const c11 = rfVerdict('CASE-11');
      expect(c11.verdict === 'REVIEW' && c11.merge_blocked_by === 'ALONG_ROAD_AMBIGUITY', 'CASE-11 was auto-merged');
      return 'Separated at 8 m (±2 m GPS) and 18 m; at 9 m with ±5 m GPS held for REVIEW, not merged.';
    }),
    run('T03', 'IDENTITY', 'Near-identical coordinates, different physical position → DISTINCT', () => {
      expect(rfVerdict('CASE-07').verdict === 'DISTINCT', 'CASE-07 opposite lanes merged');
      expect(rfVerdict('CASE-09').verdict === 'DISTINCT', 'CASE-09 junction merged');
      return 'Opposite lanes (6 m) and junction roads (2.4 m) are kept separate.';
    }),
    run('T04', 'IDENTITY', 'Poor GPS accuracy → REVIEW', () => {
      expect(rfVerdict('CASE-03').verdict === 'REVIEW', 'CASE-03 not review');
      return 'CASE-03 (±30 m) is held for review.';
    }),
    run('T05', 'IDENTITY', 'Opposite carriageway → DISTINCT', () => {
      expect(rfVerdict('CASE-01').verdict === 'DISTINCT', 'CASE-01 merged');
      return 'CASE-01 (7.8 m apart, different carriageways) is kept separate.';
    }),
    run('T06', 'IDENTITY', 'Off-network observation → safe fallback', () => {
      const c = demo('CASE-06');
      const d = rfVerdict('CASE-06');
      expect(d.off_network_fallback === true && d.verdict === 'DISTINCT', 'Road-frame fallback not applied');
      const live = evaluateCandidate(c.obsA, asDefect(c.obsB));
      expect(live.record.engine === 'radius-v1-fallback', 'Live pipeline did not fall back to Radius-V1');
      return 'Road-frame uses GPS separation; the live pipeline hands off-network reports to Radius-V1.';
    }),
    run('T06b', 'IDENTITY', 'Live pipeline decides with the road frame on mapped roads', () => {
      const c = demo('CASE-07');
      const live = evaluateCandidate(c.obsA, asDefect(c.obsB));
      expect(live.record.engine === 'roadframe-v1' && live.decision === 'DISTINCT', `Got ${live.record.engine} ${live.decision}`);
      expect(live.radius.decision === 'MERGE', 'Radius baseline changed');
      return 'Opposite-lane pair: radius alone would MERGE; the live pipeline returns DISTINCT.';
    }),

    // LOCATION — scenarios 7–9
    run('T07', 'LOCATION', 'Defect near hospital → contextual importance', () => {
      const p = near(hospital, 150);
      const ctx = locationContextFor(p.latitude, p.longitude);
      expect(ctx.level === 'HIGH' && ctx.nearby[0].facility.category === 'EMERGENCY_HOSPITAL', `Got ${ctx.level}`);
      const a = attentionContext({ ...asDefect({ ...demo('CASE-10').obsA, ...p }, 60) }, ctx);
      expect(a.physicalScore === 60 && a.physicalTier === 'High' && a.attentionTier === 'Critical', `Got ${a.attentionTier}`);
      return 'HIGH ATTENTION CONTEXT; physical priority stays 60 (High); attention raised one tier to Critical.';
    }),
    run('T08', 'LOCATION', 'Defect near school → contextual importance', () => {
      const p = near(school, 100);
      const ctx = locationContextFor(p.latitude, p.longitude);
      expect(ctx.level === 'HIGH' && ctx.nearby[0].facility.category === 'SCHOOL', `Got ${ctx.level}`);
      return `School ~${Math.round(ctx.nearby[0].distanceM)} m away → HIGH ATTENTION CONTEXT.`;
    }),
    run('T09', 'LOCATION', 'No critical facility nearby → normal context', () => {
      const ctx = locationContextFor(11.025, 76.94);
      expect(ctx.level === 'NORMAL' && ctx.nearby.length === 0, `Got ${ctx.level}`);
      const a = attentionContext({ ...asDefect({ ...demo('CASE-10').obsA, latitude: 11.025, longitude: 76.94 }, 40) }, ctx);
      expect(a.attentionTier === a.physicalTier, 'Attention changed without context');
      return 'NORMAL CONTEXT; attention equals the physical tier.';
    }),
    run('T09b', 'LOCATION', 'Hospital nearby never jumps more than one tier', () => {
      const p = near(hospital, 150);
      const low = attentionContext(asDefect({ ...demo('CASE-10').obsA, ...p }, 20));
      expect(low.physicalTier === 'Low' && low.attentionTier === 'Medium', `Got ${low.attentionTier}`);
      const repaired = attentionContext({ ...asDefect({ ...demo('CASE-10').obsA, ...p }, 60), status: 'REPAIRED' });
      expect(!repaired.raised, 'Repaired defect was raised');
      return 'Low → Medium only; repaired defects are not raised.';
    }),

    // SENSOR — scenarios 10–13
    run('T10', 'SENSOR', 'Portrait orientation', () => {
      const { cal, n } = normalisedJolt({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 });
      expect(cal.posture === 'PORTRAIT', `Posture ${cal.posture}`);
      expect(close(n.vertical, 3) && close(n.horizontal, 1.5), `vertical ${n.vertical.toFixed(3)}, horizontal ${n.horizontal.toFixed(3)}`);
      return `Vertical ${n.vertical.toFixed(2)} m/s², horizontal ${n.horizontal.toFixed(2)} m/s².`;
    }),
    run('T11', 'SENSOR', 'Landscape orientation', () => {
      const { cal, n } = normalisedJolt({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      expect(cal.posture === 'LANDSCAPE', `Posture ${cal.posture}`);
      expect(close(n.vertical, 3) && close(n.horizontal, 1.5), `vertical ${n.vertical.toFixed(3)}, horizontal ${n.horizontal.toFixed(3)}`);
      return `Same jolt reads vertical ${n.vertical.toFixed(2)}, horizontal ${n.horizontal.toFixed(2)} — matches portrait.`;
    }),
    run('T12', 'SENSOR', 'Tilted device', () => {
      const up = unit({ x: 0, y: Math.sin((40 * Math.PI) / 180), z: Math.cos((40 * Math.PI) / 180) });
      const { cal, n } = normalisedJolt(up, { x: 1, y: 0, z: 0 });
      expect(cal.posture === 'TILTED', `Posture ${cal.posture}`);
      expect(close(n.vertical, 3) && close(n.horizontal, 1.5), `vertical ${n.vertical.toFixed(3)}, horizontal ${n.horizontal.toFixed(3)}`);
      return `Tilted ${cal.tiltDeg.toFixed(0)}° from flat: vertical ${n.vertical.toFixed(2)}, horizontal ${n.horizontal.toFixed(2)} — matches.`;
    }),
    run('T13', 'SENSOR', 'Calibration unavailable', () => {
      expect(calibrationState({ available: false, collecting: false, calibration: null, driftDeg: null }) === 'UNAVAILABLE', 'State not UNAVAILABLE');
      const r = calibrate([]);
      expect(!r.ok && r.reason === 'TOO_FEW_SAMPLES', 'Calibrated without samples');
      return 'No sensor → UNAVAILABLE; no samples → no calibration and no normalised output.';
    }),
    run('T13b', 'SENSOR', 'Movement and re-mounting are detected', () => {
      const moving = stillSamples({ x: 0, y: 1, z: 0 }).map((v, i) => ({ ...v, y: v.y + (i % 2 ? 1.5 : -1.5) }));
      const r = calibrate(moving);
      expect(!r.ok && r.reason === 'DEVICE_MOVING', 'Movement not rejected');
      const cal = calibrate(stillSamples({ x: 0, y: 1, z: 0 }));
      if (!cal.ok) throw new Error('Calibration failed');
      const drift = driftDeg(stillSamples({ x: 1, y: 0, z: 0 }), cal.calibration);
      expect(calibrationState({ available: true, collecting: false, calibration: cal.calibration, driftDeg: drift }) === 'NEEDS_RECALIBRATION', 'Re-mount not detected');
      return `Shaking rejected; portrait → landscape drift ${drift?.toFixed(0)}° → NEEDS RECALIBRATION.`;
    }),

    // STATUS — scenarios 14–17
    run('T14', 'STATUS', 'Submitted → Under review', () => {
      const d = statusDefect([]);
      const t = titles(d);
      expect(citizenStage(d) === 'UNDER_REVIEW' && t.includes('Report submitted') && t.includes('Under review'), t.join(', '));
      return 'Stage UNDER REVIEW; notifications: Report submitted, Under review.';
    }),
    run('T15', 'STATUS', 'Under review → Verified', () => {
      const d = statusDefect(['VERIFIED']);
      expect(citizenStage(d) === 'VERIFIED' && titles(d).includes('Defect verified'), titles(d).join(', '));
      return 'Stage VERIFIED; notification "Defect verified".';
    }),
    run('T16', 'STATUS', 'Verified → Scheduled', () => {
      const d = statusDefect(['VERIFIED', 'SCHEDULED']);
      expect(citizenStage(d) === 'SCHEDULED' && titles(d).includes('Maintenance scheduled'), titles(d).join(', '));
      return 'Stage SCHEDULED; notification "Maintenance scheduled".';
    }),
    run('T17', 'STATUS', 'Scheduled → Repaired', () => {
      const d = statusDefect(['VERIFIED', 'SCHEDULED', 'REPAIRED']);
      expect(citizenStage(d) === 'REPAIRED' && titles(d).includes('Marked repaired'), titles(d).join(', '));
      return 'Stage REPAIRED; notification "Marked repaired".';
    }),
    run('T17b', 'STATUS', 'Repaired → Reopened, and only the reporter is notified', () => {
      const d = statusDefect(['VERIFIED', 'SCHEDULED', 'REPAIRED', 'RECURRED']);
      expect(citizenStage(d) === 'REOPENED' && titles(d).includes('Defect reopened'), titles(d).join(', '));
      expect(deriveNotifications([d], [], [], 'USR-SOMEONE-ELSE').length === 0, 'Another user received notifications');
      return 'Stage REOPENED; other users receive nothing.';
    }),

    // SECURITY — scenarios 18–20
    run('T18', 'SECURITY', 'Citizen cannot access admin functionality', () => {
      expect(login('ADMIN', 'citizen', '123') === null, 'Citizen signed in as admin');
      let blocked = false;
      try {
        updateStatus('NO-SUCH-DEFECT', 'VERIFIED', 'USR-CIT-001');
      } catch (e) {
        blocked = e instanceof Error && e.message.startsWith('Not authorised');
      }
      expect(blocked, 'Citizen status change was not rejected');
      return 'Admin sign-in with citizen credentials fails; the store rejects a citizen status change.';
    }),
    run('T19', 'SECURITY', 'Admin-only destructive action protected', () => {
      let blocked = 0;
      for (const actor of ['USR-CIT-001', 'unknown-user', '']) {
        try {
          deleteDefect('NO-SUCH-DEFECT', actor);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Not authorised')) blocked++;
        }
      }
      expect(blocked === 3, `${blocked}/3 non-admin delete attempts rejected`);
      return 'Delete rejected for citizen, unknown and empty actors (UI also asks for confirmation).';
    }),
    run('T20', 'SECURITY', 'Invalid report input handled safely', () => {
      const valid: NewObservation = {
        imageUri: 'file:///ok.jpg', defectType: 'POTHOLE', severity: 'HIGH', confidence: null, classificationSource: 'REPORTER',
        latitude: 11.0, longitude: 76.9, accuracyMeters: 5, locationSource: 'DEVICE', timestamp: Date.now(), reporterId: 'USR-CIT-001',
      };
      expect(validateObservationInput(valid).length === 0, 'Valid input rejected');
      const bad = {
        ...valid, latitude: 123, longitude: Number.NaN, defectType: 'NOT_A_TYPE', imageUri: '', accuracyMeters: -4, timestamp: Date.now() + 86_400_000,
      } as unknown as NewObservation;
      const errors = validateObservationInput(bad);
      expect(errors.length >= 6, `Only ${errors.length} problems found`);
      return `Rejected with ${errors.length} messages, e.g. "${errors[0]}"`;
    }),
  ];
}

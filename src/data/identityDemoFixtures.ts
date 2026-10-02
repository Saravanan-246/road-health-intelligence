import type { Observation } from '../api/types';
import { projectToRoadFrame } from '../services/roadFrame';

export interface DemoCase {
  id: string;
  title: string;
  description: string;
  expectedRadiusDecision: 'MERGE' | 'REVIEW' | 'DISTINCT';
  expectedRoadframeDecision: 'MERGE' | 'REVIEW' | 'DISTINCT';
  reasoning: string;
  obsA: Observation;
  obsB: Observation;
  /** SAME_AREA cases: several defects in one road area that must not be merged by proximity. */
  group?: 'CORE' | 'SAME_AREA';
}

const base = {
  imageUri: '',
  confidence: null,
  classificationSource: 'REPORTER' as const,
  defectType: 'POTHOLE' as const,
  severity: 'HIGH' as const,
  locationSource: 'DEVICE' as const,
  reporterId: 'USR-DEMO-001',
};

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'CASE-01',
    title: 'Opposite Carriageways',
    description: 'Two potholes on opposite sides of a dual carriageway, ~8 m apart.',
    expectedRadiusDecision: 'MERGE',
    expectedRoadframeDecision: 'DISTINCT',
    reasoning: 'Radius engine sees 7.8 m distance (inside its 22 m uncertainty-widened gate), so MERGE. Road-frame engine sees the observations project to two different carriageways, so DISTINCT.',
    obsA: {
      id: 'OB-DEMO-001A',
      ...base,
      latitude: 11.01680,
      longitude: 76.95400,
      accuracyMeters: 5,
      timestamp: Date.now() - 1000 * 60,
      roadFrame: {
        way_id: 'OSM-004',
        way_name: 'Dual Carriageway A',
        chainage_m: 100,
        lateral_offset_m: 2.5,
        side: 'A',
        segment_index: 0,
        snap_confidence: 'HIGH',
        oneway: true,
      },
    },
    obsB: {
      id: 'OB-DEMO-001B',
      ...base,
      latitude: 11.01685,
      longitude: 76.95405,
      accuracyMeters: 5,
      timestamp: Date.now(),
      roadFrame: {
        way_id: 'OSM-005',
        way_name: 'Dual Carriageway B (opposite)',
        chainage_m: 100,
        lateral_offset_m: 2.5,
        side: 'B',
        segment_index: 0,
        snap_confidence: 'HIGH',
        oneway: true,
      },
    },
  },
  {
    id: 'CASE-02',
    title: 'Same Carriageway with GPS Drift',
    description: 'Same pothole reported twice; the GPS fixes drifted ~28 m apart, but both project to the same chainage on the road.',
    expectedRadiusDecision: 'DISTINCT',
    expectedRoadframeDecision: 'MERGE',
    reasoning: 'Radius engine sees 28.3 m distance, outside its 25.6 m gate (15 m base + GPS uncertainty), so DISTINCT. Road-frame engine sees same way, same side and a 4 m chainage difference, so MERGE.',
    obsA: {
      id: 'OB-DEMO-002A',
      ...base,
      latitude: 11.01700,
      longitude: 76.95350,
      accuracyMeters: 8,
      timestamp: Date.now() - 1000 * 60 * 60,
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 200,
        lateral_offset_m: 1.0,
        side: 'A',
        segment_index: 1,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
    obsB: {
      id: 'OB-DEMO-002B',
      ...base,
      latitude: 11.01720,
      longitude: 76.95366,
      accuracyMeters: 7,
      timestamp: Date.now(),
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 204,
        lateral_offset_m: 1.2,
        side: 'A',
        segment_index: 1,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
  },
  {
    id: 'CASE-03',
    title: 'Poor GPS Accuracy',
    description: 'Two observations with 30 m GPS accuracy overlap; chainage difference is within uncertainty.',
    expectedRadiusDecision: 'REVIEW',
    expectedRoadframeDecision: 'REVIEW',
    reasoning: 'Both engines return REVIEW because GPS uncertainty is too high to decide confidently.',
    obsA: {
      id: 'OB-DEMO-003A',
      ...base,
      latitude: 11.01690,
      longitude: 76.95370,
      accuracyMeters: 30,
      timestamp: Date.now() - 1000 * 60 * 30,
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 250,
        lateral_offset_m: 0.5,
        side: 'A',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
    obsB: {
      id: 'OB-DEMO-003B',
      ...base,
      latitude: 11.01710,
      longitude: 76.95380,
      accuracyMeters: 28,
      timestamp: Date.now(),
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 268,
        lateral_offset_m: 0.8,
        side: 'A',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
  },
  {
    id: 'CASE-04',
    title: 'Genuinely Adjacent Defects',
    // Deliberately close to both engines' thresholds: with ±2 m GPS, an 8 m gap is still a
    // radius MERGE (score 0.75) but exceeds the road-frame tolerance by just over 1σ.
    description: 'Two distinct potholes on the same side of the road, 8 m apart along the road, captured with high-accuracy (±2 m) GPS.',
    expectedRadiusDecision: 'MERGE',
    expectedRoadframeDecision: 'DISTINCT',
    reasoning: 'Radius MERGE because 8.0 m is well inside its 17.8 m gate. Road-frame DISTINCT because the 8 m chainage gap exceeds the 5 m tolerance by more than the ±2.8 m combined GPS uncertainty.',
    obsA: {
      id: 'OB-DEMO-004A',
      ...base,
      latitude: 11.01695,
      longitude: 76.95380,
      accuracyMeters: 2,
      timestamp: Date.now() - 1000 * 60,
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 300,
        lateral_offset_m: 1.5,
        side: 'A',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
    obsB: {
      id: 'OB-DEMO-004B',
      ...base,
      latitude: 11.01700,
      longitude: 76.9538532,
      accuracyMeters: 2,
      timestamp: Date.now(),
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 308,
        lateral_offset_m: 1.6,
        side: 'A',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
  },
  {
    id: 'CASE-05',
    title: 'Centerline Straddle',
    description: 'Two observations near the road centerline; ambiguous which side.',
    expectedRadiusDecision: 'MERGE',
    expectedRoadframeDecision: 'REVIEW',
    reasoning: 'Radius MERGE because close distance. Road-frame REVIEW because centerline proximity creates uncertainty about which side.',
    obsA: {
      id: 'OB-DEMO-005A',
      ...base,
      latitude: 11.01702,
      longitude: 76.95390,
      accuracyMeters: 5,
      timestamp: Date.now() - 1000 * 60,
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 350,
        lateral_offset_m: 1.0,
        side: 'A',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
    obsB: {
      id: 'OB-DEMO-005B',
      ...base,
      latitude: 11.01703,
      longitude: 76.95391,
      accuracyMeters: 5,
      timestamp: Date.now(),
      roadFrame: {
        way_id: 'OSM-001',
        way_name: 'Avenida Principal',
        chainage_m: 351,
        lateral_offset_m: 0.8,
        side: 'B',
        segment_index: 2,
        snap_confidence: 'HIGH',
        oneway: false,
      },
    },
  },
  {
    id: 'CASE-06',
    title: 'Off-Network Fallback',
    description: 'Observations too far from any mapped road; road-frame falls back to straight-line GPS separation.',
    expectedRadiusDecision: 'DISTINCT',
    expectedRoadframeDecision: 'DISTINCT',
    reasoning: 'Neither observation can snap to a road, so the road-frame engine applies its tolerance test to the ~3.4 km GPS separation instead of chainage. Both engines return DISTINCT.',
    obsA: {
      id: 'OB-DEMO-006A',
      ...base,
      latitude: 11.00000,
      longitude: 76.92000,
      accuracyMeters: 10,
      timestamp: Date.now() - 1000 * 60,
      roadFrame: {
        way_id: null,
        way_name: null,
        chainage_m: null,
        lateral_offset_m: null,
        side: null,
        segment_index: null,
        snap_confidence: 'NONE',
        oneway: false,
      },
    },
    obsB: {
      id: 'OB-DEMO-006B',
      ...base,
      latitude: 11.01000,
      longitude: 76.95000,
      accuracyMeters: 10,
      timestamp: Date.now(),
      roadFrame: {
        way_id: null,
        way_name: null,
        chainage_m: null,
        lateral_offset_m: null,
        side: null,
        segment_index: null,
        snap_confidence: 'NONE',
        oneway: false,
      },
    },
  },
  ...sameAreaCases(),
];

/**
 * Multiple defects in the same road area. Coordinates lie on demo road OSM-001 (or the
 * OSM-002 cross road) and the road frame is computed by the real projector, not hand-set.
 */
function sameAreaCases(): DemoCase[] {
  const minute = 60 * 1000;
  const point = (id: string, latitude: number, longitude: number, accuracyMeters: number, ageMin: number): Observation => {
    const o: Observation = { id, ...base, latitude, longitude, accuracyMeters, timestamp: Date.now() - ageMin * minute };
    return { ...o, roadFrame: projectToRoadFrame(o) };
  };
  return [
    {
      id: 'CASE-07',
      group: 'SAME_AREA',
      title: 'Same Spot, Opposite Lanes',
      description: 'Two potholes at the same chainage of a two-way road, one in each lane, 6 m apart.',
      expectedRadiusDecision: 'MERGE',
      expectedRoadframeDecision: 'DISTINCT',
      reasoning: 'Radius engine sees 6 m and merges. Road-frame projects them 3 m either side of the centreline — opposite lanes — and keeps them separate.',
      obsA: point('OB-DEMO-007A', 11.0164035, 76.9553651, 5, 30),
      obsB: point('OB-DEMO-007B', 11.0163658, 76.9554042, 5, 0),
    },
    {
      id: 'CASE-08',
      group: 'SAME_AREA',
      title: 'Same Lane, 18 m Apart',
      description: 'Two potholes in the same lane of the same road, 18 m apart along it (±4 m GPS).',
      expectedRadiusDecision: 'REVIEW',
      expectedRoadframeDecision: 'DISTINCT',
      reasoning: 'Radius engine cannot decide (18 m is inside its 20.7 m gate) and asks for review. Road-frame sees an 18 m chainage gap, far beyond the 5.7 m tolerance, and keeps them separate.',
      obsA: point('OB-DEMO-008A', 11.0165305, 76.9554946, 4, 30),
      obsB: point('OB-DEMO-008B', 11.0166459, 76.95561, 4, 0),
    },
    {
      id: 'CASE-09',
      group: 'SAME_AREA',
      title: 'Junction: Near-Identical Coordinates',
      description: 'One pothole on the main road and one on the cross road, 2.4 m apart at the junction.',
      expectedRadiusDecision: 'MERGE',
      expectedRoadframeDecision: 'DISTINCT',
      reasoning: 'Radius engine merges two points 2.4 m apart. Road-frame projects them onto different roads (OSM-001 and OSM-002) and keeps them separate. At junctions, projection depends on GPS placing each report on the correct road.',
      obsA: point('OB-DEMO-009A', 11.016041, 76.9550359, 5, 30),
      obsB: point('OB-DEMO-009B', 11.0160515, 76.9550166, 5, 0),
    },
    {
      id: 'CASE-10',
      group: 'SAME_AREA',
      title: 'Same Pothole, Repeat Reports',
      description: 'The same pothole reported twice from the same lane, 2 m apart (±5 m GPS).',
      expectedRadiusDecision: 'MERGE',
      expectedRoadframeDecision: 'MERGE',
      reasoning: 'Both engines merge: same road, same side, and a 2 m chainage difference well inside the 7.1 m tolerance. Separation rules do not block genuine duplicates.',
      obsA: point('OB-DEMO-010A', 11.01666, 76.9556215, 5, 30),
      obsB: point('OB-DEMO-010B', 11.0166753, 76.9556317, 5, 0),
    },
    {
      id: 'CASE-11',
      group: 'SAME_AREA',
      title: 'Nearby Potholes, Phone-Grade GPS',
      description: 'Two potholes in the same lane, 9 m apart, captured with typical ±5 m phone GPS.',
      expectedRadiusDecision: 'MERGE',
      expectedRoadframeDecision: 'REVIEW',
      reasoning: 'Radius engine merges at 9 m. Road-frame cannot prove they are different (9 m is inside the GPS uncertainty band) but the gap exceeds the 7.1 m tolerance, so it refuses to auto-merge and asks for review.',
      obsA: point('OB-DEMO-011A', 11.0162753, 76.9552368, 5, 30),
      obsB: point('OB-DEMO-011B', 11.016333, 76.9552945, 5, 0),
    },
  ];
}

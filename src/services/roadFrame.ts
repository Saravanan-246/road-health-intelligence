import type { Observation, RoadFrame } from '../api/types';

// Inline demo road network (avoiding GeoJSON import issues)
const demoRoadNetwork = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { way_id: 'OSM-001', way_name: 'Avenida Principal', oneway: false, lanes: 2 },
      geometry: { type: 'LineString', coordinates: [[76.954, 11.015], [76.955, 11.016], [76.956, 11.017]] },
    },
    {
      type: 'Feature',
      properties: { way_id: 'OSM-002', way_name: 'Perpendicular Cross', oneway: false, lanes: 2 },
      geometry: { type: 'LineString', coordinates: [[76.9545, 11.014], [76.9555, 11.018]] },
    },
    {
      type: 'Feature',
      properties: { way_id: 'OSM-003', way_name: 'Service Road North', oneway: false, lanes: 1 },
      geometry: { type: 'LineString', coordinates: [[76.953, 11.018], [76.958, 11.02]] },
    },
    {
      type: 'Feature',
      properties: { way_id: 'OSM-004', way_name: 'Dual Carriageway A', oneway: true, lanes: 3 },
      geometry: { type: 'LineString', coordinates: [[76.95, 11.013], [76.951, 11.014], [76.952, 11.015], [76.953, 11.016]] },
    },
    {
      type: 'Feature',
      properties: { way_id: 'OSM-005', way_name: 'Dual Carriageway B (opposite)', oneway: true, lanes: 3 },
      geometry: { type: 'LineString', coordinates: [[76.953, 11.016], [76.952, 11.015], [76.951, 11.014], [76.95, 11.013]] },
    },
  ],
};

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function distance2d(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversine(lat1, lon1, lat2, lon2);
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return ((brng * 180 / Math.PI) + 360) % 360;
}

interface SnapResult {
  way_id: string;
  way_name: string;
  chainage_m: number;
  lateral_offset_m: number;
  side: 'A' | 'B';
  segment_index: number;
  snap_confidence: 'HIGH' | 'LOW';
  oneway: boolean;
}

function projectPointToSegment(
  pointLat: number,
  pointLon: number,
  seg1Lat: number,
  seg1Lon: number,
  seg2Lat: number,
  seg2Lon: number,
): { chainage_m: number; lateral_m: number; onSegment: boolean; side: 'A' | 'B' } {
  const dist1 = distance2d(seg1Lat, seg1Lon, seg2Lat, seg2Lon);
  if (dist1 < 1) {
    const d = distance2d(pointLat, pointLon, seg1Lat, seg1Lon);
    return { chainage_m: 0, lateral_m: d, onSegment: false, side: 'A' };
  }

  const d1 = distance2d(seg1Lat, seg1Lon, pointLat, pointLon);
  const d2 = distance2d(pointLat, pointLon, seg2Lat, seg2Lon);
  const d12 = dist1;
  const t = Math.max(0, Math.min(1, (d1 * d1 - d2 * d2 + d12 * d12) / (2 * d12 * d12)));

  const brng = bearing(seg1Lat, seg1Lon, seg2Lat, seg2Lon);
  const lat = seg1Lat + t * (seg2Lat - seg1Lat);
  const lon = seg1Lon + t * (seg2Lon - seg1Lon);

  const chainageDist = t * d12;
  const lateralDist = distance2d(pointLat, pointLon, lat, lon);

  // Side of the centerline relative to the way's digitised direction: A = left, B = right.
  const perpBrng = bearing(lat, lon, pointLat, pointLon);
  const perpAngle = ((perpBrng - brng + 180 + 360) % 360) - 180;
  const side = perpAngle < 0 ? 'A' : 'B';

  return {
    chainage_m: chainageDist,
    lateral_m: lateralDist,
    onSegment: t >= 0 && t <= 1,
    side,
  };
}

function snapToRoad(lat: number, lon: number): SnapResult | null {
  let best: SnapResult | null = null;
  let bestLateral = Infinity;

  const features = demoRoadNetwork.features as any[];

  for (const feature of features) {
    const { way_id, way_name, oneway } = feature.properties;
    const coords = feature.geometry.coordinates;
    // Chainage is measured from the start of the way, so it accumulates across segments.
    let wayOffset = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];

      const result = projectPointToSegment(lat, lon, lat1, lon1, lat2, lon2);

      if (result.lateral_m < bestLateral) {
        bestLateral = result.lateral_m;
        best = {
          way_id,
          way_name,
          chainage_m: wayOffset + result.chainage_m,
          lateral_offset_m: result.lateral_m,
          side: result.side,
          segment_index: i,
          snap_confidence: result.lateral_m < 5 ? 'HIGH' : 'LOW',
          oneway,
        };
      }
      wayOffset += distance2d(lat1, lon1, lat2, lon2);
    }
  }

  return bestLateral < 50 ? best : null;
}

export function projectToRoadFrame(observation: Observation): RoadFrame {
  const snap = snapToRoad(observation.latitude, observation.longitude);

  if (!snap) {
    return {
      way_id: null,
      way_name: null,
      chainage_m: null,
      lateral_offset_m: null,
      side: null,
      segment_index: null,
      snap_confidence: 'NONE',
      oneway: false,
    };
  }

  return {
    way_id: snap.way_id,
    way_name: snap.way_name,
    chainage_m: snap.chainage_m,
    lateral_offset_m: snap.lateral_offset_m,
    side: snap.side,
    segment_index: snap.segment_index,
    snap_confidence: snap.snap_confidence,
    oneway: snap.oneway,
  };
}

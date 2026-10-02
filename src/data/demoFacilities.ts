/**
 * STAGED DEMO DATA — invented placeholder facilities for demonstrating location context.
 * These are NOT real hospitals, schools or other facilities, and their positions do not
 * describe any real place. A deployment would load facilities from a real POI source
 * (e.g. OpenStreetMap amenity data or a municipal register).
 */
export type FacilityCategory =
  | 'EMERGENCY_HOSPITAL'
  | 'HOSPITAL'
  | 'CLINIC_24H'
  | 'PHARMACY'
  | 'SCHOOL'
  | 'COLLEGE'
  | 'FIRE_STATION'
  | 'POLICE_STATION'
  | 'BUS_STOP'
  | 'RAILWAY_STATION'
  | 'PUBLIC_FACILITY';

export interface DemoFacility {
  id: string;
  name: string;
  category: FacilityCategory;
  latitude: number;
  longitude: number;
}

export const DEMO_FACILITIES_NOTICE =
  'Demo facilities are staged placeholders, not real locations. No live hospital, school or pharmacy data is connected.';

export const DEMO_FACILITIES: DemoFacility[] = [
  { id: 'DEMO-FAC-01', name: 'Demo Emergency Hospital (staged)', category: 'EMERGENCY_HOSPITAL', latitude: 11.01782, longitude: 76.95688 },
  { id: 'DEMO-FAC-02', name: 'Demo Bus Stop (staged)', category: 'BUS_STOP', latitude: 11.01722, longitude: 76.9556 },
  { id: 'DEMO-FAC-03', name: 'Demo 24/7 Pharmacy (staged)', category: 'PHARMACY', latitude: 11.0145, longitude: 76.957 },
  { id: 'DEMO-FAC-04', name: 'Demo School (staged)', category: 'SCHOOL', latitude: 11.0054, longitude: 76.9616 },
  { id: 'DEMO-FAC-05', name: 'Demo College (staged)', category: 'COLLEGE', latitude: 11.007, longitude: 76.964 },
  { id: 'DEMO-FAC-06', name: 'Demo Fire Station (staged)', category: 'FIRE_STATION', latitude: 11.01, longitude: 76.95 },
  { id: 'DEMO-FAC-07', name: 'Demo Police Station (staged)', category: 'POLICE_STATION', latitude: 11.02, longitude: 76.965 },
  { id: 'DEMO-FAC-08', name: 'Demo Railway Station (staged)', category: 'RAILWAY_STATION', latitude: 11.0, longitude: 76.955 },
  { id: 'DEMO-FAC-09', name: 'Demo 24/7 Clinic (staged)', category: 'CLINIC_24H', latitude: 11.012, longitude: 76.96 },
];

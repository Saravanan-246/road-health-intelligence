/**
 * citizenReportService.ts
 *
 * Fetches the citizen's own submitted reports from GET /observations/my.
 * Dev adapter active when EXPO_PUBLIC_API_URL is not set.
 */

import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import type { MyReportRow } from '../types';

// ---------------------------------------------------------------------------
// TEMPORARY DEV ADAPTER — remove when GET /observations/my is live
// ---------------------------------------------------------------------------
const DEV_MODE = !process.env.EXPO_PUBLIC_API_URL;

const DEV_REPORTS: MyReportRow[] = [
  {
    observation_id: 'OB-DEV001',
    defect_id: 'RD-DEV001',
    defect_type: 'POTHOLE',
    severity: 'HIGH',
    status: 'CORROBORATED',
    duplicate_decision: 'MERGE',
    priority_score: 72,
    priority_tier: 'High',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    location: { latitude: 12.9716, longitude: 77.5946 },
  },
  {
    observation_id: 'OB-DEV002',
    defect_id: 'RD-DEV002',
    defect_type: 'CRACK',
    severity: 'MEDIUM',
    status: 'CANDIDATE',
    duplicate_decision: 'DISTINCT',
    priority_score: 45,
    priority_tier: 'Medium',
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    location: { latitude: 12.9352, longitude: 77.6245 },
  },
];

async function devFetchMyReports(): Promise<MyReportRow[]> {
  await new Promise((r) => setTimeout(r, 900));
  return DEV_REPORTS;
}
// ---------------------------------------------------------------------------

/**
 * Fetch the current citizen's submitted observations.
 * Returns newest-first.
 */
export async function fetchMyReports(): Promise<MyReportRow[]> {
  if (DEV_MODE) {
    return devFetchMyReports();
  }
  return apiRequest<MyReportRow[]>(ENDPOINTS.myObservations);
}

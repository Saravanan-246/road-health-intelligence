export type DefectType = 'POTHOLE' | 'CRACK' | 'RUTTING' | 'SURFACE_WEAR' | 'OTHER';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export type LocationSource = 'EXIF' | 'DEVICE' | 'MANUAL' | 'UNLOCATED';

/** Who produced the defect type / severity for an observation. */
export type ClassificationSource = 'MODEL' | 'REPORTER';

export type DefectStatus =
  | 'CANDIDATE'
  | 'CORROBORATED'
  | 'VERIFIED'
  | 'SCHEDULED'
  | 'REPAIRED'
  | 'RECURRED';

export type PriorityTier = 'Critical' | 'High' | 'Medium' | 'Low';

export interface LocationFix {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  source: LocationSource;
  error?: string;
}

/** One evidence capture of a road problem by one reporter at one moment. */
export interface Observation {
  id: string;
  imageUri: string;
  defectType: DefectType;
  severity: Severity;
  /** 0–1 detector confidence; null when no detector produced the classification. */
  confidence: number | null;
  classificationSource: ClassificationSource;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  locationSource: Exclude<LocationSource, 'UNLOCATED'>;
  timestamp: number;
}

export interface PriorityFactor {
  /** Normalised input, 0–1. */
  value: number;
  weight: number;
  /** Contribution to the 0–100 score (value × weight × 100). */
  points: number;
  note: string;
}

export interface PriorityBreakdown {
  severity: PriorityFactor;
  confidence: PriorityFactor;
  observationSupport: PriorityFactor;
  recency: PriorityFactor;
  roadContext: PriorityFactor;
}

export interface PriorityResult {
  score: number;
  breakdown: PriorityBreakdown;
}

/** Persistent record of one physical defect; observations are its evidence. */
export interface Defect {
  id: string;
  defectType: DefectType;
  latitude: number;
  longitude: number;
  observations: Observation[];
  status: DefectStatus;
  priority: number;
  priorityBreakdown: PriorityBreakdown;
  priorityComputedAt: number;
}

export type DuplicateDecision = 'MERGE' | 'REVIEW' | 'DISTINCT';

export interface DuplicateAnalysis {
  decision: DuplicateDecision;
  score: number;
  distanceMeters: number;
  reasons: string[];
}

export const DEFECT_TYPE_LABELS: Record<DefectType, string> = {
  POTHOLE: 'Pothole',
  CRACK: 'Crack',
  RUTTING: 'Rutting',
  SURFACE_WEAR: 'Surface wear',
  OTHER: 'Other defect',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  SEVERE: 'Severe',
};

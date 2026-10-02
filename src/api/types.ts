export type DefectType = 'POTHOLE' | 'CRACK' | 'RUTTING' | 'SURFACE_WEAR' | 'OTHER';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export type LocationSource = 'EXIF' | 'DEVICE' | 'MANUAL' | 'UNLOCATED';

/** Who produced the defect type / severity for an observation. */
export type ClassificationSource = 'MODEL' | 'REPORTER';

export type ImageValidationStatus = 'VALID' | 'INVALID' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';

export interface ImageValidationEvidence {
  status: ImageValidationStatus;
  imageType: 'road_defect' | 'road_scene' | 'non_road' | 'unknown';
  defectType: DefectType | null;
  reason: string;
  referenceMatch: boolean;
  referenceSimilarity?: number | null;
  analyzedAt: number | string;
}

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

export interface RoadFrame {
  way_id: string | null;
  way_name: string | null;
  chainage_m: number | null;
  lateral_offset_m: number | null;
  side: 'A' | 'B' | null;
  segment_index: number | null;
  snap_confidence: 'HIGH' | 'LOW' | 'NONE';
  oneway: boolean;
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
  reporterId?: string;
  /** True when the location is the staged DEMO test point, not a real GPS/manual fix. */
  testLocation?: boolean;
  /** Result of duplicate analysis when this observation was linked to its defect. */
  duplicateDecision?: DuplicateDecision;
  /** Road frame projection (optional, added by road-frame engine). */
  roadFrame?: RoadFrame;
  /**
   * Analysis recorded by the live duplicate pipeline at submission: the matched defect for
   * MERGE/REVIEW, or the nearest open defect for DISTINCT. Absent when nothing was compared.
   */
  duplicateAnalysis?: DuplicateAnalysis;
  /** Defect the observation was compared against when the decision was made. */
  comparedDefectId?: string | null;
  /** Closest observation of that defect at decision time (the evidence pair shown in the UI). */
  comparedObservationId?: string | null;
  /** How the live pipeline decided identity (which engine, safeguards). */
  identity?: IdentityRecord;
  /** Where the photo came from. */
  imageSource?: 'CAMERA' | 'GALLERY';
  /** Photo capture time from the image's EXIF metadata; null when the image has none. */
  imageCapturedAt?: number | null;
  /** Independent image validation result, captured before RoadFrame identity resolution. */
  imageValidation?: ImageValidationEvidence;
}

export interface StatusChange {
  from: DefectStatus | null;
  to: DefectStatus;
  at: number;
  by: string;
  note?: string;
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
  /** Set when duplicate analysis returned REVIEW: the existing defect this may duplicate. */
  pendingReviewOf?: string | null;
  /** A repaired defect this new report matches — a possible recurrence for the authority to confirm. */
  possibleRecurrenceOf?: string | null;
  history?: StatusChange[];
}

export type DuplicateDecision = 'MERGE' | 'REVIEW' | 'DISTINCT';

/** Structured inputs behind a duplicate decision — the same values its reason strings are built from. */
export interface DuplicateEvidence {
  gateRadiusMeters: number;
  combinedUncertaintyMeters: number;
  /** Reported accuracy of the new observation; null when unknown (the assumed value was used). */
  observationAccuracyMeters: number | null;
  /** Best reported accuracy among the defect's observations; null when none reported one. */
  defectAccuracyMeters: number | null;
  assumedAccuracyMeters: number;
  withinGate: boolean;
  typeAgrees: boolean;
  /** Null when the spatial gate rejected the candidate before scoring. */
  spatialScore: number | null;
  mergeThreshold: number;
  reviewThreshold: number;
  maxUncertaintyForAutoMergeMeters: number;
  /** Rules that downgraded an automatic MERGE to REVIEW. */
  blockedBy: ('TYPE_CONFLICT' | 'GPS_UNCERTAINTY')[];
}

export interface DuplicateAnalysis {
  decision: DuplicateDecision;
  score: number;
  distanceMeters: number;
  reasons: string[];
  evidence?: DuplicateEvidence;
}

export type CitizenIssueType = 'WRONG_DEFECT_TYPE' | 'WRONG_LOCATION' | 'INCORRECT_SEVERITY' | 'INCORRECT_IMAGE' | 'DUPLICATE_REPORT' | 'OTHER';

export interface CitizenIssue {
  id: string;
  defectId: string;
  issueType: CitizenIssueType;
  details: string;
  reporterId: string;
  status: 'UNDER_REVIEW' | 'RESOLVED';
  createdAt: number;
  resolvedAt?: number;
}

export const CITIZEN_ISSUE_LABELS: Record<CitizenIssueType, string> = {
  WRONG_DEFECT_TYPE: 'Wrong defect type',
  WRONG_LOCATION: 'Wrong location',
  INCORRECT_SEVERITY: 'Incorrect severity',
  INCORRECT_IMAGE: 'Incorrect image',
  DUPLICATE_REPORT: 'Duplicate report',
  OTHER: 'Other',
};

export interface IdentityChannel {
  verdict: 'SUPPORT' | 'AGAINST' | 'ABSTAIN';
  detail: string;
  delta_m?: number;
  tol_m?: number;
  margin_sigma?: number;
}

export interface IdentityDecision {
  verdict: DuplicateDecision;
  channels: {
    structural: IdentityChannel;
    lateral: IdentityChannel;
    longitudinal: IdentityChannel;
    temporal: IdentityChannel;
  };
  veto: string | null;
  tol_m: number;
  margin_sigma: number | null;
  reason_trace: string[];
  engine_version: 'roadframe-v1';
  decided_at: number;
  /** True when a road frame was unavailable and straight-line GPS separation was used instead. */
  off_network_fallback?: boolean;
  /** The rule that produced the verdict, e.g. "3 of 4 channels support, none against". */
  decision_rule?: string;
  /**
   * Set when channels would support a merge but the along-road separation exceeds the
   * tolerance while still inside GPS uncertainty — two nearby defects cannot be ruled out.
   */
  merge_blocked_by?: 'ALONG_ROAD_AMBIGUITY' | null;
}

/** Safeguards the live pipeline applies after road-frame analysis, before an automatic MERGE. */
export type IdentitySafeguard = 'TYPE_CONFLICT' | 'GPS_UNCERTAINTY' | 'SNAP_UNCERTAIN';

/** How the live pipeline decided an observation's identity. */
export interface IdentityRecord {
  /** roadframe-v1 when both observations project onto the road network; otherwise the radius fallback. */
  engine: 'roadframe-v1' | 'radius-v1-fallback';
  /** Decision before any authority review. */
  automaticDecision: DuplicateDecision;
  /** Road-frame result against the compared observation (null for the radius fallback). */
  roadFrame: IdentityDecision | null;
  /** Safeguards that turned a road-frame MERGE into REVIEW. */
  safeguards: IdentitySafeguard[];
}

export interface AttentionFactor {
  /** Normalised input, 0–1. */
  value: number;
  weight: number;
  /** Contribution to the 0–100 score. */
  points: number;
  note: string;
}

/**
 * A road area where observed defect evidence has accumulated. Derived from recorded
 * observations and defect records only — it is not a prediction of future defects.
 */
export interface RiskHotspot {
  id: string;
  /** Observation-weighted centre of the grouped defects (approximate). */
  latitude: number;
  longitude: number;
  radiusMeters: number;
  defectIds: string[];
  defectCount: number;
  observationCount: number;
  unresolvedCount: number;
  repairedCount: number;
  pendingReviewCount: number;
  recurredCount: number;
  dominantType: DefectType;
  highestSeverity: Severity;
  attentionScore: number;
  factors: {
    priority: AttentionFactor;
    evidence: AttentionFactor;
    multiplicity: AttentionFactor;
    unresolved: AttentionFactor;
    recurrence: AttentionFactor;
  };
  explanation: string[];
  lastObservedAt: number;
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

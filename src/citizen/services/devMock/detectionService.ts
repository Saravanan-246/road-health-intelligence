import type { DefectType, Severity } from '../../../api/types';

export type DetectionSource = 'MODEL' | 'UNAVAILABLE';

export interface DetectionResult {
  source: DetectionSource;
  isDefect: boolean | null;
  defectType: DefectType | null;
  severity: Severity | null;
  /** 0–1, only meaningful when source is MODEL. */
  confidence: number | null;
  message: string;
}

/**
 * Plug a pre-trained detector in here (on-device TFLite/ONNX or a hosted endpoint).
 * Must return source 'MODEL' only when a real model produced the result.
 */
export async function detectRoadDefect(_imageUri: string): Promise<DetectionResult> {
  return {
    source: 'UNAVAILABLE',
    isDefect: null,
    defectType: null,
    severity: null,
    confidence: null,
    message: 'Detector not connected — defect type and severity are set by the reporter.',
  };
}

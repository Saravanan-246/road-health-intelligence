import { apiRequest } from './client';
import { ENDPOINTS } from './endpoints';
import type { DefectType } from './types';

export type ImageValidationStatus = 'VALID' | 'INVALID' | 'REVIEW_REQUIRED';
export type ImageValidationType = 'road_defect' | 'road_scene' | 'non_road' | 'unknown';

export interface ImageValidationResult {
  valid: boolean;
  status: ImageValidationStatus;
  image_type: ImageValidationType;
  defect_type: DefectType | null;
  reason: string;
  reference_match: boolean;
  /** Raw similarity from the reference comparison; this is not model confidence. */
  reference_similarity: number | null;
  analyzed_at: string;
}

export function imageAssessmentDiffers(result: ImageValidationResult, selectedType: DefectType): boolean {
  return result.valid && result.defect_type !== null && result.defect_type !== selectedType;
}

export async function validateRoadImage(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
): Promise<ImageValidationResult> {
  const form = new FormData();
  if (typeof document !== 'undefined') {
    const blob = await (await fetch(uri)).blob();
    form.append('image', blob, fileName || 'road-report-image');
  } else {
    form.append('image', {
      uri,
      name: fileName || 'road-report-image.jpg',
      type: mimeType || 'image/jpeg',
    } as unknown as Blob);
  }
  return apiRequest<ImageValidationResult>(ENDPOINTS.validateImage, { method: 'POST', body: form });
}

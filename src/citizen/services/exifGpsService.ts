import type { LocationFix } from '../../api/types';

/**
 * Safely extracts GPS coordinates and capture time from EXIF metadata.
 * Only GPS and timestamp are extracted; other EXIF fields are ignored for privacy.
 */

interface ExifGpsData {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
}

interface ExifData {
  '{Exif}'?: Record<string, unknown>;
  '{IFD0}'?: Record<string, unknown>;
  GPSLatitude?: unknown[];
  GPSLongitude?: unknown[];
  GPSAltitude?: number;
  GPSLatitudeRef?: string;
  GPSLongitudeRef?: string;
  DateTimeOriginal?: string;
  DateTime?: string;
  [key: string]: unknown;
}

/**
 * Convert EXIF GPS rational array to decimal degrees.
 * Format: [degrees, minutes, seconds] where each is [numerator, denominator]
 */
function exifRationalArrayToDegrees(
  arr: unknown[] | undefined,
  ref: string | undefined,
): number | null {
  if (!Array.isArray(arr) || arr.length < 3) return null;

  const toDecimal = (rational: unknown): number | null => {
    if (Array.isArray(rational) && rational.length === 2) {
      const [num, den] = rational;
      if (typeof num === 'number' && typeof den === 'number' && den !== 0) {
        return num / den;
      }
    }
    return null;
  };

  const degrees = toDecimal(arr[0]) ?? 0;
  const minutes = toDecimal(arr[1]) ?? 0;
  const seconds = toDecimal(arr[2]) ?? 0;

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }

  return Number.isFinite(decimal) ? decimal : null;
}

/**
 * Extract GPS data from EXIF metadata.
 * Returns null if GPS data is not available or invalid.
 */
export function extractExifGps(exif: Record<string, unknown> | null | undefined): ExifGpsData | null {
  if (!exif || typeof exif !== 'object') {
    return null;
  }

  const exifObj = exif as ExifData;

  const latitude = exifRationalArrayToDegrees(exifObj.GPSLatitude, exifObj.GPSLatitudeRef);
  const longitude = exifRationalArrayToDegrees(exifObj.GPSLongitude, exifObj.GPSLongitudeRef);

  if (latitude === null || longitude === null) {
    return null;
  }

  const altitude = typeof exifObj.GPSAltitude === 'number' ? exifObj.GPSAltitude : null;

  return {
    latitude,
    longitude,
    altitude,
    accuracy: null,
  };
}

/**
 * Convert extracted EXIF GPS to a LocationFix object.
 * Used for gallery images with EXIF GPS data.
 */
export function exifGpsToLocationFix(exifGps: ExifGpsData): LocationFix {
  if (exifGps.latitude === null || exifGps.longitude === null) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      source: 'UNLOCATED',
      error: 'No GPS data in image metadata',
    };
  }

  if (!Number.isFinite(exifGps.latitude) || !Number.isFinite(exifGps.longitude)) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      source: 'UNLOCATED',
      error: 'Invalid GPS coordinates in image',
    };
  }

  if (Math.abs(exifGps.latitude) > 90 || Math.abs(exifGps.longitude) > 180) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      source: 'UNLOCATED',
      error: 'GPS coordinates out of valid range',
    };
  }

  return {
    latitude: exifGps.latitude,
    longitude: exifGps.longitude,
    accuracyMeters: exifGps.accuracy,
    source: 'EXIF',
  };
}

/**
 * Checks if EXIF metadata contains valid GPS data.
 */
export function hasExifGps(exif: Record<string, unknown> | null | undefined): boolean {
  const gps = extractExifGps(exif);
  return gps !== null && gps.latitude !== null && gps.longitude !== null;
}

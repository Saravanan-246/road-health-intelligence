import * as Location from 'expo-location';
import type { LocationFix } from '../../api/types';

const UNLOCATED: LocationFix = {
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  source: 'UNLOCATED',
};

/** Indoors a GPS fix can take minutes; give up rather than spin forever. */
const GPS_TIMEOUT_MS = 20_000;

/** Foreground GPS fix. Never fabricates coordinates: failures return UNLOCATED. */
export async function getDeviceLocation(): Promise<LocationFix> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ...UNLOCATED, error: 'Location permission denied' };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out waiting for a GPS fix')), GPS_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
      source: 'DEVICE',
    };
  } catch (e) {
    return { ...UNLOCATED, error: e instanceof Error ? e.message : 'Location unavailable' };
  }
}

/** Validates user-entered coordinates. Accuracy is unknown for manual entry. */
export function manualLocation(latText: string, lonText: string): LocationFix {
  const latitude = Number(latText.trim());
  const longitude = Number(lonText.trim());
  const valid =
    latText.trim() !== '' &&
    lonText.trim() !== '' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  if (!valid) {
    return { ...UNLOCATED, error: 'Enter latitude (−90…90) and longitude (−180…180)' };
  }
  return { latitude, longitude, accuracyMeters: null, source: 'MANUAL' };
}

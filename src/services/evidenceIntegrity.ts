/**
 * Consistency checks on one observation's evidence record. These check what the app records
 * (IDs, links, image presence, location quality, timestamps); they do not verify image
 * content or detect tampering.
 */
import type { Defect, Observation } from '../api/types';

export type IntegrityStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface IntegrityCheck {
  label: string;
  status: IntegrityStatus;
  text: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A photo older than this relative to its report may no longer show the current road. */
export const STALE_PHOTO_DAYS = 7;
/** Clock skew tolerated between photo metadata and report time. */
const SKEW_MS = 5 * 60 * 1000;

export function evidenceIntegrity(o: Observation, defect: Defect, now = Date.now()): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  checks.push(
    o.id
      ? { label: 'Observation ID', status: 'PASS', text: o.id }
      : { label: 'Observation ID', status: 'FAIL', text: 'Missing observation ID.' },
  );
  const linked = defect.observations.some((x) => x.id === o.id);
  checks.push({
    label: 'Defect link',
    status: linked ? 'PASS' : 'FAIL',
    text: linked ? `Evidence record of ${defect.id}.` : `Not listed under ${defect.id}.`,
  });
  checks.push(
    o.imageUri
      ? { label: 'Image', status: 'PASS', text: `Attached to this observation${o.imageSource ? ` (${o.imageSource === 'CAMERA' ? 'taken with the camera' : 'chosen from the gallery'})` : ''}.` }
      : { label: 'Image', status: 'WARN', text: 'No image — staged demo record.' },
  );
  if (o.testLocation) {
    checks.push({ label: 'Location', status: 'WARN', text: 'Demo test location, not a GPS fix.' });
  } else if (o.accuracyMeters === null) {
    checks.push({ label: 'Location', status: 'WARN', text: `${o.locationSource === 'MANUAL' ? 'Entered manually' : 'Fix'} with unknown accuracy.` });
  } else {
    checks.push({
      label: 'Location',
      status: o.accuracyMeters > 20 ? 'WARN' : 'PASS',
      text: `${o.locationSource} fix, ±${o.accuracyMeters.toFixed(0)} m${o.accuracyMeters > 20 ? ' — low accuracy' : ''}.`,
    });
  }
  checks.push(
    o.timestamp <= now + SKEW_MS
      ? { label: 'Report time', status: 'PASS', text: new Date(o.timestamp).toLocaleString() }
      : { label: 'Report time', status: 'FAIL', text: 'Report time is in the future.' },
  );
  if (o.imageCapturedAt == null) {
    checks.push({ label: 'Photo time', status: 'INFO', text: o.imageUri ? 'Not present in the photo metadata.' : 'No image.' });
  } else if (o.imageCapturedAt > o.timestamp + SKEW_MS) {
    checks.push({ label: 'Photo time', status: 'FAIL', text: 'Photo metadata is later than the report time.' });
  } else {
    const days = (o.timestamp - o.imageCapturedAt) / DAY_MS;
    checks.push(
      days > STALE_PHOTO_DAYS
        ? { label: 'Photo time', status: 'WARN', text: `Photo taken ${days.toFixed(0)} days before it was reported; the road may have changed.` }
        : { label: 'Photo time', status: 'PASS', text: `${new Date(o.imageCapturedAt).toLocaleString()} (photo metadata).` },
    );
  }
  return checks;
}

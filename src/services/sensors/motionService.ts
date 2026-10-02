/**
 * Live device-motion adapter (expo-sensors DeviceMotion) for the calibration screen.
 * Readings are processed in memory while the screen is open; nothing is stored or sent,
 * and nothing is attached to reports.
 */
import { useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
import {
  SENSOR_CONFIG,
  calibrate,
  calibrationState,
  driftDeg,
  normalise,
  roadEventFeatures,
  type Calibration,
  type CalibrationState,
  type NormalisedSample,
  type RoadEventFeatures,
  type Vec3,
} from './motionMath';

export interface MotionSnapshot {
  state: CalibrationState;
  available: boolean | null;
  unavailableReason: string | null;
  raw: Vec3 | null;
  calibration: Calibration | null;
  normalised: NormalisedSample | null;
  driftDeg: number | null;
  features: RoadEventFeatures | null;
  lastError: string | null;
}

const UI_REFRESH_MS = 250;

export function useMotionCalibration(): MotionSnapshot & { startCalibration: () => void } {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const latest = useRef<Vec3 | null>(null);
  const recent = useRef<Vec3[]>([]);
  const calibBuffer = useRef<Vec3[]>([]);
  const vertical = useRef<number[]>([]);
  const collectingRef = useRef(false);
  const calibrationRef = useRef<Calibration | null>(null);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) {
          if (!cancelled) {
            setAvailable(false);
            setUnavailableReason('This device does not report motion sensor data.');
          }
          return;
        }
        const perm = await DeviceMotion.getPermissionsAsync();
        const granted = perm.granted || (await DeviceMotion.requestPermissionsAsync()).granted;
        if (!granted) {
          if (!cancelled) {
            setAvailable(false);
            setUnavailableReason('Motion permission was not granted.');
          }
          return;
        }
        if (cancelled) return;
        setAvailable(true);
        DeviceMotion.setUpdateInterval(SENSOR_CONFIG.sampleIntervalMs);
        sub = DeviceMotion.addListener((m) => {
          const a = m.accelerationIncludingGravity;
          if (!a) return;
          const v = { x: a.x, y: a.y, z: a.z };
          latest.current = v;
          recent.current = [...recent.current, v].slice(-SENSOR_CONFIG.driftWindow);
          if (collectingRef.current) {
            calibBuffer.current.push(v);
            if (calibBuffer.current.length >= SENSOR_CONFIG.calibrationSamples) {
              collectingRef.current = false;
              const result = calibrate(calibBuffer.current);
              setCollecting(false);
              if (result.ok) {
                calibrationRef.current = result.calibration;
                vertical.current = [];
                setCalibration(result.calibration);
                setLastError(null);
              } else {
                setLastError(result.detail);
              }
            }
          } else if (calibrationRef.current) {
            vertical.current = [...vertical.current, normalise(v, calibrationRef.current).vertical].slice(-SENSOR_CONFIG.eventWindow);
          }
        });
      } catch (e) {
        if (!cancelled) {
          setAvailable(false);
          setUnavailableReason(e instanceof Error ? e.message : 'Motion sensors could not be started.');
        }
      }
    })();
    const timer = setInterval(() => setTick((t) => t + 1), UI_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub?.remove();
    };
  }, []);

  const startCalibration = () => {
    if (!available) return;
    calibBuffer.current = [];
    collectingRef.current = true;
    setCollecting(true);
    setLastError(null);
  };

  const drift = calibration ? driftDeg(recent.current, calibration) : null;
  return {
    state: calibrationState({ available, collecting, calibration, driftDeg: drift }),
    available,
    unavailableReason,
    raw: latest.current,
    calibration,
    normalised: calibration && latest.current ? normalise(latest.current, calibration) : null,
    driftDeg: drift,
    features: calibration ? roadEventFeatures(vertical.current) : null,
    lastError,
    startCalibration,
  };
}

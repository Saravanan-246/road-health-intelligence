import type { Observation, DuplicateDecision } from '../api/types';
import { analyzeDuplicate } from '../citizen/services/devMock/duplicateService';
import { resolveRoadFrameIdentity } from './roadFrameIdentity';
import { DEMO_CASES } from '../data/identityDemoFixtures';

export interface TestResult {
  caseId: string;
  passed: boolean;
  radiusResult: DuplicateDecision;
  radiusExpected: DuplicateDecision;
  roadframeResult: DuplicateDecision;
  roadframeExpected: DuplicateDecision;
  issue?: string;
}

export function runIdentityTests(): TestResult[] {
  return DEMO_CASES.map((demoCase) => {
    const radiusAnalysis = analyzeDuplicate(demoCase.obsA, {
      id: 'DEMO',
      defectType: demoCase.obsB.defectType,
      latitude: demoCase.obsB.latitude,
      longitude: demoCase.obsB.longitude,
      observations: [demoCase.obsB],
      status: 'CANDIDATE',
      priority: 50,
      priorityBreakdown: {
        severity: { value: 0.5, weight: 0.25, points: 12.5, note: 'HIGH severity' },
        confidence: { value: 0.5, weight: 0.1, points: 5, note: 'n/a' },
        observationSupport: { value: 0.5, weight: 0.2, points: 10, note: '1 observation' },
        recency: { value: 0.9, weight: 0.2, points: 18, note: 'Recent' },
        roadContext: { value: 0.5, weight: 0.25, points: 12.5, note: 'Urban' },
      },
      priorityComputedAt: Date.now(),
    });

    const roadframeDecision = resolveRoadFrameIdentity(demoCase.obsA, demoCase.obsB);

    const radiusPassed = radiusAnalysis.decision === demoCase.expectedRadiusDecision;
    const roadframePassed = roadframeDecision.verdict === demoCase.expectedRoadframeDecision;
    const passed = radiusPassed && roadframePassed;

    return {
      caseId: demoCase.id,
      passed,
      radiusResult: radiusAnalysis.decision,
      radiusExpected: demoCase.expectedRadiusDecision,
      roadframeResult: roadframeDecision.verdict,
      roadframeExpected: demoCase.expectedRoadframeDecision,
      issue: !passed
        ? `Radius: expected ${demoCase.expectedRadiusDecision}, got ${radiusAnalysis.decision}; ` +
          `Road-frame: expected ${demoCase.expectedRoadframeDecision}, got ${roadframeDecision.verdict}`
        : undefined,
    };
  });
}

// Quick test of the identity resolution logic
const { resolveRoadFrameIdentity } = require('./src/services/roadFrameIdentity.ts');
const { DEMO_CASES } = require('./src/data/identityDemoFixtures.ts');

console.log('Testing Road-Frame Identity Resolution...');
console.log('==========================================\n');

DEMO_CASES.slice(0, 3).forEach((demoCase) => {
  console.log(`\n${demoCase.id}: ${demoCase.title}`);
  console.log(`Description: ${demoCase.description}`);
  
  const decision = resolveRoadFrameIdentity(demoCase.obsA, demoCase.obsB);
  
  console.log(`Expected: ${demoCase.expectedRoadframeDecision}`);
  console.log(`Got: ${decision.verdict}`);
  console.log(`Match: ${decision.verdict === demoCase.expectedRoadframeDecision ? '✓' : '✗'}`);
});

console.log('\n\nTest complete!');

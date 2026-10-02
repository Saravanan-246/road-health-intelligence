const { runIdentityTests } = require('./src/services/identityTests.ts');

console.log('Testing All Identity Resolution Cases...');
console.log('========================================\n');

const results = runIdentityTests();

results.forEach((result) => {
  const status = result.passed ? '✓' : '✗';
  console.log(`${status} ${result.caseId}: Radius ${result.radiusResult} (exp: ${result.radiusExpected}) / RoadFrame ${result.roadframeResult} (exp: ${result.roadframeExpected})`);
  if (result.issue) {
    console.log(`  Issue: ${result.issue}`);
  }
});

const passCount = results.filter(r => r.passed).length;
console.log(`\n\nTotal: ${passCount}/${results.length} passed`);

if (passCount === results.length) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`✗ ${results.length - passCount} test(s) failed`);
  process.exit(1);
}

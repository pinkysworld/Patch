import test from 'node:test';
import { runStudioMainThreadBenchmark } from '../scripts/benchmark-studio-large-project.js';

test('R0.1 measurement-only main-thread evidence', () => {
  const result = runStudioMainThreadBenchmark({ iterations: 20, warmup: 3 });
  console.log(`PATCH_STUDIO_MAIN_THREAD_MEASUREMENT=${JSON.stringify(result)}`);
});

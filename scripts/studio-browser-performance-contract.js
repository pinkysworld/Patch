export const PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT = 'patch-studio-browser-performance/0.1';

export const PATCH_STUDIO_BROWSER_PERFORMANCE_LIMITS_MS = Object.freeze({
  workshopRunFirstPaint: 3000,
  workshopEventToPaint: 2000,
  largeProjectRunFirstPaint: 3000,
  largeProjectDesignerSwitch: 2000
});

export function validateStudioBrowserPerformance(metrics, limits = PATCH_STUDIO_BROWSER_PERFORMANCE_LIMITS_MS) {
  const failures = [];
  for (const [name, limit] of Object.entries(limits)) {
    const value = Number(metrics?.[name]);
    if (!Number.isFinite(value) || value < 0) {
      failures.push(`${name} must be a finite non-negative measurement, got ${String(metrics?.[name])}`);
      continue;
    }
    if (value > limit) failures.push(`${name} ${value.toFixed(1)}ms exceeds ${limit}ms`);
  }
  return Object.freeze({
    contract: PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    metrics: Object.freeze({ ...metrics }),
    limits: Object.freeze({ ...limits })
  });
}

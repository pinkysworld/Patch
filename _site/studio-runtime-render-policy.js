export const PATCH_STUDIO_RUNTIME_RENDER_POLICY_VERSION = '0.1';
export const PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL = 'incremental';
export const PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL = 'full';
export const PATCH_STUDIO_RUNTIME_RENDER_QUERY_KEY = 'patch-runtime-render';

/**
 * Resolve the explicit browser runtime rendering policy.
 *
 * Incremental keyed reconciliation remains the default. The full renderer is
 * intentionally opt-in through a reproducible URL query switch so diagnostics
 * and recovery can bypass incremental reconciliation without creating hidden
 * persistent Studio state.
 */
export function resolveStudioRuntimeRenderMode(search = '') {
  const params = new URLSearchParams(String(search ?? ''));
  return params.get(PATCH_STUDIO_RUNTIME_RENDER_QUERY_KEY) === PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL
    ? PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL
    : PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL;
}

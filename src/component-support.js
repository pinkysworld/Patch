import { patchComponent } from './component-registry.js';

export const PATCH_COMPONENT_SUPPORT_VERSION = '0.1';

const BUILD_TARGET_TO_COMPONENT_TARGET = Object.freeze({
  web: 'web',
  'native-windows': 'windows',
  'native-macos': 'macos',
  'native-linux': 'linux',
  'native-freebsd': 'freebsd'
});

export function componentTargetForBuildTarget(buildTarget) {
  return BUILD_TARGET_TO_COMPONENT_TARGET[String(buildTarget ?? '')] ?? null;
}

export function patchComponentSupport(type, buildTarget) {
  const target = componentTargetForBuildTarget(buildTarget);
  const component = patchComponent(type);
  if (!target) return Object.freeze({ type: String(type ?? ''), target: null, status: 'not-applicable' });
  if (!component) return Object.freeze({ type: String(type ?? ''), target, status: 'unknown' });
  return Object.freeze({
    type: component.type,
    target,
    status: component.targetSupport?.[target] ?? 'unknown'
  });
}

export function assessPatchComponentSupport(types, buildTarget) {
  const target = componentTargetForBuildTarget(buildTarget);
  const uniqueTypes = [...new Set((types ?? []).map(value => String(value ?? '').trim()).filter(Boolean))];
  if (!target) {
    return Object.freeze({
      target: null,
      status: 'not-applicable',
      supported: Object.freeze([]),
      unsupported: Object.freeze([]),
      unknown: Object.freeze([]),
      total: uniqueTypes.length
    });
  }

  const supported = [];
  const unsupported = [];
  const unknown = [];
  for (const type of uniqueTypes) {
    const result = patchComponentSupport(type, buildTarget);
    if (result.status === 'supported') supported.push(type);
    else if (result.status === 'unsupported') unsupported.push(type);
    else unknown.push(type);
  }

  const status = unsupported.length ? 'unsupported' : (unknown.length ? 'unknown' : 'supported');
  return Object.freeze({
    target,
    status,
    supported: Object.freeze(supported),
    unsupported: Object.freeze(unsupported),
    unknown: Object.freeze(unknown),
    total: uniqueTypes.length
  });
}

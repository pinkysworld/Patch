import { listDesignerControls } from '../src/designer.js';
import { patchComponent } from '../src/component-registry.js';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const win = typeof window === 'undefined' ? null : window;
const code = doc?.querySelector('#code') ?? null;
const projectKind = doc?.querySelector('#projectKind') ?? null;

let sourceSignals = 0;
let kindSignals = 0;

if (doc) {
  code?.addEventListener('input', () => { sourceSignals += 1; });
  code?.addEventListener('change', () => { sourceSignals += 1; });
  projectKind?.addEventListener('change', () => { kindSignals += 1; });

  for (const type of ['click', 'change']) {
    doc.addEventListener(type, captureProgrammaticMutation, { capture: true });
  }

  queueMicrotask(installStudioBuildReadiness);
}

function captureProgrammaticMutation() {
  if (!code || !projectKind) return;
  const beforeSource = code.value;
  const beforeKind = projectKind.value;
  const beforeSourceSignals = sourceSignals;
  const beforeKindSignals = kindSignals;

  queueMicrotask(() => {
    if (code.value !== beforeSource && sourceSignals === beforeSourceSignals) {
      code.dispatchEvent(new Event('input', { bubbles: true }));
      code.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (projectKind.value !== beforeKind && kindSignals === beforeKindSignals) {
      projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

export function buildReadinessModel(source, kind, buildTarget) {
  const target = componentTargetForBuildTarget(buildTarget);
  if (!target) {
    return Object.freeze({
      state: 'neutral',
      label: 'Target checked at build',
      detail: 'This target does not use the Window component capability matrix.'
    });
  }
  if (String(kind ?? 'console') !== 'window') {
    return Object.freeze({
      state: 'ready',
      label: `Ready: ${targetLabel(target)}`,
      detail: 'Console project has no Window component compatibility requirements.'
    });
  }

  let controls;
  try {
    controls = listDesignerControls(String(source ?? ''));
  } catch (error) {
    return Object.freeze({
      state: 'source-error',
      label: 'Check source',
      detail: error?.message ?? String(error)
    });
  }

  const assessment = assessComponentSupport(controls.map(control => control.type), target);
  if (assessment.unsupported.length) {
    const names = assessment.unsupported.join(', ');
    return Object.freeze({
      state: 'blocked',
      label: `${assessment.unsupported.length} unsupported on ${targetLabel(target)}`,
      detail: `Current component contract does not advertise ${names} on ${targetLabel(target)}.`
    });
  }
  if (assessment.unknown.length) {
    const names = assessment.unknown.join(', ');
    return Object.freeze({
      state: 'warning',
      label: `Verify ${assessment.unknown.length} component${assessment.unknown.length === 1 ? '' : 's'}`,
      detail: `No canonical target-support entry exists for ${names}. Build remains fail-closed.`
    });
  }
  return Object.freeze({
    state: 'ready',
    label: `Ready: ${targetLabel(target)}`,
    detail: `${assessment.total} source-backed component type${assessment.total === 1 ? '' : 's'} covered by the canonical ${targetLabel(target)} support matrix.`
  });
}

function assessComponentSupport(types, target) {
  const supported = [];
  const unsupported = [];
  const unknown = [];
  const uniqueTypes = [...new Set((types ?? []).map(value => String(value ?? '').trim()).filter(Boolean))];
  for (const type of uniqueTypes) {
    const component = patchComponent(type);
    const status = component?.targetSupport?.[target] ?? 'unknown';
    if (status === 'supported') supported.push(type);
    else if (status === 'unsupported') unsupported.push(type);
    else unknown.push(type);
  }
  return { supported, unsupported, unknown, total: uniqueTypes.length };
}

function componentTargetForBuildTarget(buildTarget) {
  const value = String(buildTarget ?? '');
  if (value === 'web') return 'web';
  if (!value.startsWith('native-')) return null;
  const target = value.slice('native-'.length);
  return ['windows', 'macos', 'linux', 'freebsd'].includes(target) ? target : null;
}

function installStudioBuildReadiness() {
  const buildTarget = doc?.querySelector('#buildTarget');
  const buildButton = doc?.querySelector('#build');
  const toolbar = buildTarget?.closest?.('.toolbar') ?? doc?.querySelector('.toolbar');
  if (!code || !projectKind || !buildTarget || !toolbar || toolbar.querySelector('#buildReadiness')) return;

  installBuildReadinessStyles();
  const status = doc.createElement('span');
  status.id = 'buildReadiness';
  status.className = 'build-readiness';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  buildTarget.closest('label')?.insertAdjacentElement('afterend', status);
  buildButton?.setAttribute('aria-describedby', 'buildReadiness');

  let queued = false;
  const render = () => {
    const model = buildReadinessModel(code.value, projectKind.value, buildTarget.value);
    status.dataset.state = model.state;
    status.textContent = model.label;
    status.title = model.detail;
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
    });
  };

  code.addEventListener('input', schedule);
  code.addEventListener('change', schedule);
  projectKind.addEventListener('change', schedule);
  buildTarget.addEventListener('change', schedule);
  win?.addEventListener('patch:studio-active-file-changed', schedule);
  win?.addEventListener('patch:studio-project-loaded', schedule);
  render();
}

function targetLabel(target) {
  if (target === 'windows') return 'Windows';
  if (target === 'macos') return 'macOS';
  if (target === 'linux') return 'Linux';
  if (target === 'freebsd') return 'FreeBSD';
  if (target === 'web') return 'Web';
  return String(target ?? 'target');
}

function installBuildReadinessStyles() {
  if (!doc || doc.querySelector('style[data-patch-build-readiness]')) return;
  const style = doc.createElement('style');
  style.dataset.patchBuildReadiness = '1';
  style.textContent = `
    .build-readiness{display:inline-flex;align-items:center;min-height:26px;max-width:190px;padding:3px 8px;border:1px solid var(--border);border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);background:var(--soft)}
    .build-readiness[data-state="ready"]{color:#166534;border-color:#86efac;background:#f0fdf4}
    .build-readiness[data-state="warning"],.build-readiness[data-state="source-error"]{color:#92400e;border-color:#fcd34d;background:#fffbeb}
    .build-readiness[data-state="blocked"]{color:#991b1b;border-color:#fca5a5;background:#fef2f2}
    @media(prefers-color-scheme:dark){.build-readiness[data-state="ready"]{color:#bbf7d0;border-color:#166534;background:#052e16}.build-readiness[data-state="warning"],.build-readiness[data-state="source-error"]{color:#fde68a;border-color:#92400e;background:#451a03}.build-readiness[data-state="blocked"]{color:#fecaca;border-color:#991b1b;background:#450a0a}}
    @media(max-width:760px){.build-readiness{max-width:150px}}
    @media(forced-colors:active){.build-readiness{border:1px solid CanvasText}}
  `;
  doc.head.appendChild(style);
}

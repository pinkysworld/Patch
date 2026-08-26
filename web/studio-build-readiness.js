import { listDesignerControls } from '../src/designer.js';
import { assessPatchComponentSupport, componentTargetForBuildTarget } from '../src/component-support.js';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;

if (doc) queueMicrotask(installStudioBuildReadiness);

export function buildReadinessModel(source, projectKind, buildTarget) {
  const target = componentTargetForBuildTarget(buildTarget);
  if (!target) {
    return Object.freeze({ state: 'neutral', label: 'Target checked at build', detail: 'This target does not use the desktop component capability matrix.' });
  }
  if (String(projectKind ?? 'console') !== 'window') {
    return Object.freeze({ state: 'ready', label: `Ready: ${targetLabel(target)}`, detail: 'Console project has no Window component compatibility requirements.' });
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

  const assessment = assessPatchComponentSupport(controls.map(control => control.type), buildTarget);
  if (assessment.status === 'unsupported') {
    const names = assessment.unsupported.join(', ');
    return Object.freeze({
      state: 'blocked',
      label: `${assessment.unsupported.length} unsupported on ${targetLabel(target)}`,
      detail: `Current component contract does not advertise ${names} on ${targetLabel(target)}.`
    });
  }
  if (assessment.status === 'unknown') {
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

function installStudioBuildReadiness() {
  const code = doc.querySelector('#code');
  const projectKind = doc.querySelector('#projectKind');
  const buildTarget = doc.querySelector('#buildTarget');
  const buildButton = doc.querySelector('#build');
  const toolbar = buildTarget?.closest?.('.toolbar') ?? doc.querySelector('.toolbar');
  if (!code || !projectKind || !buildTarget || !toolbar || toolbar.querySelector('#buildReadiness')) return;

  installStyles();
  const status = doc.createElement('span');
  status.id = 'buildReadiness';
  status.className = 'build-readiness';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  buildTarget.closest('label')?.insertAdjacentElement('afterend', status);
  buildButton?.setAttribute('aria-describedby', 'buildReadiness');

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
    });
  };

  const render = () => {
    const model = buildReadinessModel(code.value, projectKind.value, buildTarget.value);
    status.dataset.state = model.state;
    status.textContent = model.label;
    status.title = model.detail;
  };

  code.addEventListener('input', schedule);
  code.addEventListener('change', schedule);
  projectKind.addEventListener('change', schedule);
  buildTarget.addEventListener('change', schedule);
  window.addEventListener('patch:studio-active-file-changed', schedule);
  window.addEventListener('patch:studio-project-loaded', schedule);
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

function installStyles() {
  if (doc.querySelector('style[data-patch-build-readiness]')) return;
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

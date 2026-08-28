import { listDesignerControls } from '../src/designer.js';
import { patchComponent } from '../src/component-registry.js';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';
export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.2';

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

  installWorkshopSampleUpgrade();
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

/**
 * Upgrade the older embedded Workshop Desk literal to the current canonical
 * repository example. Keeping the transform here avoids a second giant sample
 * copy while the beta35 compatibility module is still retained.
 */
export function upgradeWorkshopDeskSource(source) {
  let next = String(source ?? '');
  if (!next.includes('window "Workshop Desk" as main size 1080, 700:')) return next;
  if (next.includes('timer as workshop_clock interval 5000') && next.includes('panel as runtime_panel')) return next;

  next = next
    .replace('create list selected_part = []\ncreate list selected_job = []\n', '')
    .replace('create number labor_limit = 50\n', 'create number labor_limit = 50\ncreate number heartbeat = 0\n')
    .replace(
      '  text "Board and inventory selections stay transient until source commits them." at 24, 558 size 980, 26\n  # @layout anchor left right bottom\n  text "Persistent edits use explicit semantic changes. Try the Forms, nested settings, Table, TreeView and native build." at 24, 614 size 980, 26\n  statusbar "{status}" as desk_status at 0, 672 size 1080, 28',
      '  text "Board and inventory selections are transient; the handlers only update status." at 24, 558 size 980, 26\n  # @layout anchor left right bottom\n  text "Current Ready demo: Forms, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26\n  timer as workshop_clock interval 5000\n  statusbar "{status}" as desk_status at 0, 672 size 1080, 28'
    )
    .replace(
      '      text "It uses Forms, Tabs, Table, TreeView, Slider, StatusBar and source-backed event handlers."',
      '      text "It uses current native-ready Forms, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."'
    )
    .replace(
      'window "Job details" as details size 640, 470:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {ticket.customer}" at 24, 70 size 280, 24\n  text "Item: {ticket.item}" at 24, 104 size 280, 24\n  text "Quantity: {ticket.qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket.bench}" at 24, 172 size 280, 24\n  text "Priority: {ticket.priority}" at 24, 206 size 280, 24\n  text "Payment: {ticket.payment}" at 326, 70 size 280, 24\n  text "State: {ticket.state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket.total}" at 326, 138 size 280, 24\n  text "{status}" at 24, 278 size 560, 28\n  button "Add inspection" as details_quote at 24, 366 size 160, 38\n  button "Mark ready" as details_ready at 202, 366 size 150, 38\n  button "Close details" as close_details at 370, 366 size 160, 38',
      'window "Job details" as details size 640, 520:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {ticket.customer}" at 24, 70 size 280, 24\n  text "Item: {ticket.item}" at 24, 104 size 280, 24\n  text "Quantity: {ticket.qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket.bench}" at 24, 172 size 280, 24\n  text "Priority: {ticket.priority}" at 24, 206 size 280, 24\n  text "Payment: {ticket.payment}" at 326, 70 size 280, 24\n  text "State: {ticket.state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket.total}" at 326, 138 size 280, 24\n  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1\n  text "{status}" at 24, 360 size 560, 28\n  button "Add inspection" as details_quote at 24, 414 size 160, 38\n  button "Mark ready" as details_ready at 202, 414 size 150, 38\n  button "Close details" as close_details at 370, 414 size 160, 38'
    )
    .replace(
      'when board changed:\n  change selected_job:\n    set = value\n  change status:\n    set = "Workshop board row selected"\n\nwhen parts changed:\n  change selected_part:\n    set = value\n  change status:\n    set = "Inventory tree path selected"',
      'when board changed:\n  change status:\n    set = "Workshop board row selected"\n\nwhen parts changed:\n  change status:\n    set = "Inventory tree path selected"\n\nwhen workshop_clock ticked:\n  change heartbeat:\n    add 1'
    )
    .replace(
      '  change selected_part:\n    clear\n  change selected_job:\n    clear\n  change ticket:',
      '  change heartbeat:\n    set = 0\n  change ticket:'
    );

  return next;
}

function installWorkshopSampleUpgrade() {
  const sample = doc?.querySelector('#sample');
  const loadSample = doc?.querySelector('#loadSample');
  if (!sample || !code) return;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (sample.value !== 'workshopDesk') return;
      const upgraded = upgradeWorkshopDeskSource(code.value);
      if (upgraded === code.value) return;
      code.value = upgraded;
      code.dispatchEvent(new Event('input', { bubbles: true }));
      code.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  doc.addEventListener('change', event => {
    if (event.target === sample && sample.value === 'workshopDesk') schedule();
  }, { capture: true });
  doc.addEventListener('click', event => {
    if ((event.target === loadSample || event.target?.closest?.('#loadSample')) && sample.value === 'workshopDesk') schedule();
  }, { capture: true });
  schedule();
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

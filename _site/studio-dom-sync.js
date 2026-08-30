import { listDesignerControls } from './src/designer.js?v=868f0784ca7f3972';
import { patchComponent } from './src/component-registry.js?v=868f0784ca7f3972';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';
export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.5';

const WORKSHOP_PICTURE_SOURCE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVR42mP88evPf4YBBEwMAwxGHcCCT1I38z2cfXm6IFZxfABZDy7AiC0REmsBsQCfQ+gSBfg8xERr3xMyd3AnQnLjFZdvdTPfY+hjorblxKZ+sh1ArOHEqht6JSGxuYRYdUzUztf45LFFCwstCpdBWRnhSpRMA2k5RVFArazIQiuDR1tEow4YdQDZDqBmXT8kQoARX98QV7+Abg4YzQX0AAAIsD5sBwsk2AAAAABJRU5ErkJggg==';
const WORKSHOP_DRAW_IMAGE_LINE = `  draw image "${WORKSHOP_PICTURE_SOURCE}" at 208, 10 size 42, 42`;

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
 * Upgrade the retained beta35 Workshop Desk literal to the current canonical
 * repository example. The showcase stays inside the current native-ready
 * scalar/list action subset and exercises every integrated cross-platform visual
 * component whose current desktop contract is Ready. Resource-only ImageList
 * authoring remains outside this single-source native acceptance example because
 * the native ImageList/Button-image contract intentionally fails closed.
 */
export function upgradeWorkshopDeskSource(source) {
  let next = String(source ?? '');
  if (!next.includes('window "Workshop Desk" as main size 1080, 700:')) return next;
  if (
    next.includes('timer as workshop_clock interval 5000') &&
    next.includes('panel as runtime_panel') &&
    next.includes('picture as workshop_logo') &&
    next.includes('paintbox as ticket_canvas') &&
    next.includes('create number ticket_total = 40') &&
    next.includes(WORKSHOP_DRAW_IMAGE_LINE) &&
    next.includes('Six-Form Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar.') &&
    next.includes('window \"Inventory Center\" as inventory size 900, 620:') &&
    next.includes('window \"Customer Profile\" as customer_profile size 760, 600:') &&
    next.includes('window \"Workshop Diagnostics\" as diagnostics size 840, 620:') &&
    next.includes('It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls.') &&
    !next.includes('create thing ticket:')
  ) return next;

  next = next
    .replace(
      'create thing ticket:\n  customer = "Ada"\n  item = "Keyboard"\n  qty = 1\n  total = 40\n  bench = "Bench A"\n  priority = "Normal"\n  payment = "Card"\n  state = "Open"\n\n',
      ''
    )
    .replace('create list selected_part = []\ncreate list selected_job = []\n', '')
    .replace(
      'create number labor_limit = 50\n',
      'create number labor_limit = 50\ncreate number heartbeat = 0\ncreate number ticket_total = 40\ncreate text ticket_bench = "Bench A"\ncreate text ticket_state = "Open"\n'
    )
    .replace(
      '\nallow quote:\n  ticket.total may increase up to 500\n\nmake quote(ticket, extra number 0..50):\n  change ticket:\n    add extra to total\n',
      ''
    )
    .replace('  text "Quote {ticket.total} · {ticket.state}" at 840, 16 size 210, 30', '  text "Quote {ticket_total} · {ticket_state}" at 840, 16 size 210, 30')
    .replace(
      '  checkbox "Rush bench" as rush at 788, 82 size 150, 36',
      `  checkbox "Rush bench" as rush at 788, 82 size 150, 36\n  picture as workshop_logo from "${WORKSHOP_PICTURE_SOURCE}" description "Workshop mark" at 958, 58 size 70, 70`
    )
    .replace(
      '  text "Board and inventory selections stay transient until source commits them." at 24, 558 size 980, 26\n  # @layout anchor left right bottom\n  text "Persistent edits use explicit semantic changes. Try the Forms, nested settings, Table, TreeView and native build." at 24, 614 size 980, 26\n  statusbar "{status}" as desk_status at 0, 672 size 1080, 28',
      '  text "Board and inventory selections are transient; the handlers only update status." at 24, 558 size 980, 26\n  # @layout anchor left right bottom\n  text "Current Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26\n  timer as workshop_clock interval 5000\n  statusbar "{status}" as desk_status at 0, 672 size 1080, 28'
    )
    .replace(
      '  text "Current Ready demo: Forms, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26',
      '  text "Current Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26'
    )
    .replace(
      '  text "Current Ready demo: Forms, Picture, PaintBox, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26',
      '  text "Current Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar." at 24, 614 size 980, 26'
    )
    .replace(
      '      text "It uses Forms, Tabs, Table, TreeView, Slider, StatusBar and source-backed event handlers."',
      '      text "It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."'
    )
    .replace(
      '      text "It uses current native-ready Forms, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."',
      '      text "It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."'
    )
    .replace(
      '      text "It uses current native-ready Picture, PaintBox, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."',
      '      text "It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."'
    )
    .replace(
      'window "Job details" as details size 640, 470:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {ticket.customer}" at 24, 70 size 280, 24\n  text "Item: {ticket.item}" at 24, 104 size 280, 24\n  text "Quantity: {ticket.qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket.bench}" at 24, 172 size 280, 24\n  text "Priority: {ticket.priority}" at 24, 206 size 280, 24\n  text "Payment: {ticket.payment}" at 326, 70 size 280, 24\n  text "State: {ticket.state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket.total}" at 326, 138 size 280, 24\n  text "{status}" at 24, 278 size 560, 28\n  button "Add inspection" as details_quote at 24, 366 size 160, 38\n  button "Mark ready" as details_ready at 202, 366 size 150, 38\n  button "Close details" as close_details at 370, 366 size 160, 38',
      'window "Job details" as details size 640, 560:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {customer}" at 24, 70 size 280, 24\n  text "Item: {item}" at 24, 104 size 280, 24\n  text "Quantity: {qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket_bench}" at 24, 172 size 280, 24\n  text "Priority: {priority}" at 24, 206 size 280, 24\n  text "Payment: {pay}" at 326, 70 size 280, 24\n  text "State: {ticket_state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket_total}" at 326, 138 size 280, 24\n  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1\n  paintbox as ticket_canvas at 24, 244 size 280, 120\n  text "{status}" at 24, 386 size 560, 28\n  button "Add inspection" as details_quote at 24, 470 size 160, 38\n  button "Mark ready" as details_ready at 202, 470 size 150, 38\n  button "Close details" as close_details at 370, 470 size 160, 38'
    )
    .replace(
      'window "Job details" as details size 640, 520:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {customer}" at 24, 70 size 280, 24\n  text "Item: {item}" at 24, 104 size 280, 24\n  text "Quantity: {qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket_bench}" at 24, 172 size 280, 24\n  text "Priority: {priority}" at 24, 206 size 280, 24\n  text "Payment: {pay}" at 326, 70 size 280, 24\n  text "State: {ticket_state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket_total}" at 326, 138 size 280, 24\n  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1\n  text "{status}" at 24, 360 size 560, 28\n  button "Add inspection" as details_quote at 24, 414 size 160, 38\n  button "Mark ready" as details_ready at 202, 414 size 150, 38\n  button "Close details" as close_details at 370, 414 size 160, 38',
      'window "Job details" as details size 640, 560:\n  text "Current workshop ticket" at 24, 24 size 300, 28\n  text "Customer: {customer}" at 24, 70 size 280, 24\n  text "Item: {item}" at 24, 104 size 280, 24\n  text "Quantity: {qty}" at 24, 138 size 280, 24\n  text "Bench: {ticket_bench}" at 24, 172 size 280, 24\n  text "Priority: {priority}" at 24, 206 size 280, 24\n  text "Payment: {pay}" at 326, 70 size 280, 24\n  text "State: {ticket_state}" at 326, 104 size 280, 24\n  text "Current quote: {ticket_total}" at 326, 138 size 280, 24\n  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1\n  paintbox as ticket_canvas at 24, 244 size 280, 120\n  text "{status}" at 24, 386 size 560, 28\n  button "Add inspection" as details_quote at 24, 470 size 160, 38\n  button "Mark ready" as details_ready at 202, 470 size 150, 38\n  button "Close details" as close_details at 370, 470 size 160, 38'
    )
    .replace('  change ticket:\n    set customer = value\n', '')
    .replace('  change ticket:\n    set item = value\n', '')
    .replace('  change ticket:\n    set payment = value\n', '')
    .replace('  change ticket:\n    set priority = value\n', '')
    .replace('  change ticket:\n    set qty = value\n', '')
    .replace(
      'when board changed:\n  change selected_job:\n    set = value\n  change status:\n    set = "Workshop board row selected"\n\nwhen parts changed:\n  change selected_part:\n    set = value\n  change status:\n    set = "Inventory tree path selected"',
      'when board changed:\n  change status:\n    set = "Workshop board row selected"\n\nwhen parts changed:\n  change status:\n    set = "Inventory tree path selected"\n\nwhen workshop_clock ticked:\n  change heartbeat:\n    add 1'
    )
    .replace(
      'when parts changed:\n  change status:\n    set = "Inventory tree path selected"\n\nwhen workshop_clock ticked:',
      'when parts changed:\n  change status:\n    set = "Inventory tree path selected"\n\nwhen workshop_logo clicked:\n  change status:\n    set = "Workshop mark clicked"\n\nwhen workshop_clock ticked:'
    )
    .replace(
      'when workshop_clock ticked:\n  change heartbeat:\n    add 1\n\nwhen quote_button clicked:',
      `when workshop_clock ticked:\n  change heartbeat:\n    add 1\n\nwhen ticket_canvas paint:\n  draw clear #f8fafc\n  draw rectangle 12, 12 size 118, 34 fill #dbeafe stroke #2563eb width 2\n  draw ellipse 146, 12 size 34, 34 fill #dcfce7 stroke #16a34a width 2\n${WORKSHOP_DRAW_IMAGE_LINE}\n  if rush:\n    draw line 12, 58 to 258, 58 stroke #dc2626 width 3\n  draw text "Live quote" at 12, 78 color #111827 size 16\n  draw text ticket_state at 126, 78 color #334155 size 16\n\nwhen quote_button clicked:`
    )
    .replace(
      '  draw ellipse 146, 12 size 34, 34 fill #dcfce7 stroke #16a34a width 2\n  if rush:',
      `  draw ellipse 146, 12 size 34, 34 fill #dcfce7 stroke #16a34a width 2\n${WORKSHOP_DRAW_IMAGE_LINE}\n  if rush:`
    )
    .replace(
      'when quote_button clicked:\n  do quote(ticket, 25)\n  change ticket:\n    set state = "Quoted"',
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"'
    )
    .replace(
      'when details_quote clicked:\n  do quote(ticket, 10)\n  change ticket:\n    set state = "Quoted"',
      'when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"'
    )
    .replace(
      'when complete_button clicked:\n  change ticket:\n    set state = "Ready"',
      'when complete_button clicked:\n  change ticket_state:\n    set = "Ready"'
    )
    .replace(
      'when details_ready clicked:\n  change ticket:\n    set state = "Ready"',
      'when details_ready clicked:\n  change ticket_state:\n    set = "Ready"'
    )
    .replace(
      'when default_bench changed:\n  change default_bench:\n    set = value\n  change ticket:\n    set bench = value',
      'when default_bench changed:\n  change default_bench:\n    set = value\n  change ticket_bench:\n    set = value'
    )
    .replace(
      '  change selected_part:\n    clear\n  change selected_job:\n    clear\n  change ticket:\n    set customer = "Ada"\n    set item = "Keyboard"\n    set qty = 1\n    set total = 40\n    set bench = default_bench\n    set priority = "Normal"\n    set payment = "Card"\n    set state = "Open"',
      '  change heartbeat:\n    set = 0\n  change ticket_total:\n    set = 40\n  change ticket_bench:\n    set = "Bench A"\n  change ticket_state:\n    set = "Open"'
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
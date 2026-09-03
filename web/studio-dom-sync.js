import { listDesignerControls } from '../src/designer.js';
import { patchComponent } from '../src/component-registry.js';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';
export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.6';

const WORKSHOP_PICTURE_SOURCE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVR42mP88evPf4YBBEwMAwxGHcCCT1I38z2cfXm6IFZxfABZDy7AiC0REmsBsQCfQ+gSBfg8xERr3xMydvdTPfY+hjorblxKZ+sh1ArOHEqht6JSGxuYRYdUzUztf45LFFCwstCpdBWRnhSpRMA2k5RVFArazIQiuDR1tEow4YdQDZDqBmXT8kQoARX98QV7+Abg4YzQX0AAAIsD5sBwsk2AAAAABJRU5ErkJggg==';

const WORKSHOP_MAIN_V06 = `window "Workshop Desk" as main size 1080, 720:
  picture as workshop_logo from "${WORKSHOP_PICTURE_SOURCE}" description "Workshop mark" at 24, 16 size 54, 54
  text "Workshop Desk" at 94, 16 size 260, 30
  text "{status}" at 94, 48 size 610, 22
  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28
  text "Current Ready · IR 1.9 · runtime v1.10" at 790, 50 size 260, 20

  text "Ticket" at 24, 92 size 110, 24
  text "Customer" at 24, 122 size 100, 22
  combo "Ada", "Grace", "Linus", "Margaret" as customer at 24, 146 size 210, 36
  text "Item" at 250, 122 size 80, 22
  input item at 250, 146 size 252, 36
  text "Quantity {qty}" at 518, 122 size 130, 22
  slider 1..8 as qty step 1 at 518, 146 size 220, 38
  checkbox "Rush bench" as rush at 758, 146 size 160, 36

  text "Workflow" at 24, 202 size 120, 24
  text "Payment" at 24, 232 size 90, 22
  radio "Card", "Cash", "Account" as pay at 24, 256 size 250, 82
  text "Priority" at 292, 232 size 90, 22
  radio "Normal", "High", "Critical" as priority at 292, 256 size 250, 82
  text "Notes" at 560, 232 size 80, 22
  input notes at 560, 256 size 490, 36
  text "Services" at 560, 298 size 90, 22
  listbox "Diagnostics", "Warranty", "Install", "Pickup" as services at 560, 322 size 490, 58

  text "Queue" at 24, 394 size 100, 22
  table "Ticket", "Customer", "Bench", "State" as board at 24, 420 size 520, 190:
    row "WD-104", "Ada", "Bench A", "Open"
    row "WD-105", "Grace", "Bench B", "Quoted"
    row "WD-106", "Linus", "Bench A", "Ready"
    row "WD-107", "Margaret", "Overflow", "Waiting"

  text "Parts & tools" at 560, 394 size 160, 22
  tree as parts at 560, 420 size 240, 190:
    node "Parts"
      node "Input"
        node "Keyboard"
        node "Trackpad"
      node "Displays"
        node "Panel"
        node "Cable"
    node "Tools"
      node "Driver"
      node "Solder"
      node "Meter"

  text "Actions" at 816, 394 size 120, 22
  button "Quote" as quote_button at 816, 420 size 104, 36
  button "Details" as details_button at 936, 420 size 104, 36
  button "Ready" as complete_button at 816, 464 size 104, 36
  button "Reset" as reset_button at 936, 464 size 104, 36
  button "Inventory" as inventory_button at 816, 508 size 104, 36
  button "Customer" as customer_button at 936, 508 size 104, 36
  button "Diagnostics" as diagnostics_button at 816, 552 size 104, 36
  button "Settings" as settings_button at 936, 552 size 104, 36
  button "Components" as components_button at 816, 596 size 224, 36

  # @layout anchor left right bottom
  text "Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24
  timer as workshop_clock interval 5000
  statusbar "{status}" as desk_status at 0, 692 size 1080, 28`;

const WORKSHOP_GALLERY_STATE_V06 = `create text gallery_text = "Workshop sample"
create boolean gallery_enabled = true
create text gallery_mode = "Ready"
create text gallery_color = "Blue"
create list gallery_features = ["Designer"]
create number gallery_level = 60
create text gallery_status = "Component gallery ready"
create number gallery_ticks = 0`;

const WORKSHOP_GALLERY_FORM_V06 = `window "Component Gallery" as components size 900, 640:
  text "Component Gallery" at 24, 20 size 280, 30
  text "{gallery_status}" at 320, 20 size 550, 30
  text "Inputs & choices" at 24, 66 size 200, 24
  text "Text input" at 24, 96 size 100, 22
  input gallery_text at 24, 120 size 250, 36
  checkbox "Enabled" as gallery_enabled at 24, 170 size 180, 36
  text "Mode" at 24, 218 size 80, 22
  radio "Ready", "Review", "Blocked" as gallery_mode at 24, 242 size 250, 82

  text "Color" at 294, 96 size 80, 22
  combo "Blue", "Green", "Amber", "Red" as gallery_color at 294, 120 size 220, 36
  text "Level {gallery_level}" at 294, 170 size 130, 22
  slider 0..100 as gallery_level step 10 at 294, 194 size 220, 38
  text "Features" at 294, 246 size 100, 22
  listbox "Designer", "Compiler", "Runtime", "Offline" as gallery_features at 294, 270 size 220, 64

  text "Graphics & containers" at 540, 66 size 250, 24
  picture as gallery_picture from "${WORKSHOP_PICTURE_SOURCE}" description "Gallery picture" at 540, 100 size 64, 64
  shape rounded as gallery_shape fill #dbeafe stroke #2563eb stroke-width 2 radius 14 opacity 1 at 620, 100 size 96, 64
  paintbox as gallery_canvas at 732, 100 size 144, 100
  panel as gallery_panel at 540, 220 size 336, 108:
    text "Panel Stage 1"
    text "Source-backed visual grouping"

  imagelist as gallery_images size 20, 20:
    image mark from "patch-resource:workshop.mark"
  text "ImageList is nonvisual and appears in the Object Tree. Resource-backed button images use project v4 assets." at 540, 340 size 336, 46

  text "Data controls" at 24, 354 size 180, 24
  table "Component", "Event", "State" as gallery_table at 24, 384 size 480, 150:
    row "Button", "clicked", "Ready"
    row "Input", "changed", "Ready"
    row "Table", "changed", "Ready"
    row "TreeView", "changed", "Ready"
    row "PaintBox", "paint", "Ready"

  tree as gallery_tree at 524, 400 size 180, 134:
    node "Registry 0.9"
      node "Basic"
        node "Text"
        node "Button"
        node "Input"
      node "Data"
        node "Table"
        node "TreeView"
      node "Graphics"
        node "Picture"
        node "Shape"
        node "PaintBox"
      node "Nonvisual"
        node "Timer"
        node "ImageList"

  button "Refresh" as gallery_refresh at 724, 448 size 152, 38
  button "Close gallery" as close_components at 724, 496 size 152, 38
  timer as gallery_clock interval 2000
  statusbar "{gallery_status}" as gallery_statusbar at 0, 612 size 900, 28`;

const WORKSHOP_GALLERY_EVENTS_V06 = `when gallery_text changed:
  change gallery_text:
    set = value
  change gallery_status:
    set = "Input change handled"

when gallery_enabled changed:
  change gallery_enabled:
    set = value
  change gallery_status:
    set = "Checkbox change handled"

when gallery_mode changed:
  change gallery_mode:
    set = value
  change gallery_status:
    set = "Radio change handled"

when gallery_color changed:
  change gallery_color:
    set = value
  change gallery_status:
    set = "ComboBox change handled"

when gallery_features changed:
  change gallery_features:
    set = value
  change gallery_status:
    set = "ListBox change handled"

when gallery_level changed:
  change gallery_level:
    set = value
  change gallery_status:
    set = "Slider change handled"

when gallery_table changed:
  change gallery_status:
    set = "Table selection handled"

when gallery_tree changed:
  change gallery_status:
    set = "TreeView selection handled"

when gallery_picture clicked:
  change gallery_status:
    set = "Picture click handled"

when gallery_canvas paint:
  draw clear #f8fafc
  draw rectangle 10, 10 size 54, 28 fill #dbeafe stroke #2563eb width 2
  draw ellipse 76, 10 size 28, 28 fill #dcfce7 stroke #16a34a width 2
  draw text gallery_mode at 10, 62 color #111827 size 14

when gallery_clock ticked:
  change gallery_ticks:
    add 1

when gallery_refresh clicked:
  change gallery_ticks:
    add 1
  change gallery_status:
    set = "Gallery refreshed"

when close_components clicked:
  close components
  change status:
    set = "Component Gallery closed"`;

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
 * Upgrade the retained beta35 Workshop Desk compatibility literal to the
 * canonical polished v0.6 showcase. The compatibility literal remains embedded
 * in beta35-studio.js so old cached Studio shells still load, while this bridge
 * owns the current source. User-authored projects are not rewritten by this
 * helper unless they still match the known Workshop v0.5 signature.
 */
export function upgradeWorkshopDeskSource(source) {
  let next = String(source ?? '');
  if (
    next.includes('window "Component Gallery" as components size 900, 640:') &&
    next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented') &&
    next.includes('Current desktop Ready runtime contract: v1.10.')
  ) return next;

  const v05 = next.includes('window "Workshop Desk" as main size 1080, 700:')
    && next.includes('Six-Form Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar.')
    && next.includes('window "Workshop Diagnostics" as diagnostics size 840, 620:')
    && next.includes('Current desktop Ready runtime contract: v1.8.')
    && !next.includes('create thing ticket:');
  if (!v05) return next;

  if (!next.includes('create text gallery_text = "Workshop sample"')) {
    next = next.replace(
      'create text diagnostic_status = "All systems ready"',
      `create text diagnostic_status = "All systems ready"\n${WORKSHOP_GALLERY_STATE_V06}`
    );
  }

  const mainStart = next.indexOf('window "Workshop Desk" as main size 1080, 700:');
  const settingsStart = next.indexOf('\nwindow "Workshop settings" as settings size 720, 520:');
  if (mainStart < 0 || settingsStart < 0 || settingsStart <= mainStart) return next;
  next = `${next.slice(0, mainStart)}${WORKSHOP_MAIN_V06}${next.slice(settingsStart)}`;

  next = next
    .replace(
      '      text "Workshop Desk is the Patch Studio six-Form showcase project."\n      text "It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."',
      '      text "Workshop Desk is the Patch Studio seven-Form RAD showcase project."\n      text "It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring."\n      text "Current Ready desktop contract: Native GUI IR 1.9 / payload v19 / runtime v1.10."'
    )
    .replace('      text "Current desktop Ready runtime contract: v1.8."', '      text "Current desktop Ready runtime contract: v1.10."')
    .replace(
      '      text "Workshop Desk exercises six Forms and multiple adapter-backed controls."',
      '      text "Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface."'
    )
    .replace('    row "Runtime", "Desktop v1.8", "Ready"', '    row "Runtime", "Desktop v1.10", "Ready"')
    .replace('    set = "Workshop board row selected"', '    set = "Queue selection changed · open Details to continue"')
    .replace('    set = "Inventory tree path selected"', '    set = "Parts selection changed · open Inventory to continue"');

  if (!next.includes('window "Component Gallery" as components size 900, 640:')) {
    next = next.replace('\nwhen customer changed:', `\n${WORKSHOP_GALLERY_FORM_V06}\n\nwhen customer changed:`);
  }

  if (!next.includes('when components_button clicked:')) {
    next = next.replace(
      'when diagnostics_button clicked:\n  open diagnostics\n  change diagnostic_status:\n    set = "Diagnostics opened from Workshop Desk"',
      'when diagnostics_button clicked:\n  open diagnostics\n  change diagnostic_status:\n    set = "Diagnostics opened from Workshop Desk"\n\nwhen components_button clicked:\n  open components\n  change gallery_status:\n    set = "Complete Component Registry 0.9 gallery opened"'
    );
  }

  if (!next.includes('when gallery_text changed:')) {
    next = next.replace('\nwhen reset_button clicked:', `\n${WORKSHOP_GALLERY_EVENTS_V06}\n\nwhen reset_button clicked:`);
  }

  if (!next.includes('  change gallery_text:\n    set = "Workshop sample"')) {
    next = next.replace(
      '  change diagnostic_status:\n    set = "All systems ready"\n  change status:\n    set = "Ticket reset"',
      '  change diagnostic_status:\n    set = "All systems ready"\n  change gallery_text:\n    set = "Workshop sample"\n  change gallery_enabled:\n    set = true\n  change gallery_mode:\n    set = "Ready"\n  change gallery_color:\n    set = "Blue"\n  change gallery_features:\n    set = ["Designer"]\n  change gallery_level:\n    set = 60\n  change gallery_status:\n    set = "Component gallery ready"\n  change gallery_ticks:\n    set = 0\n  change status:\n    set = "Ticket reset"'
    );
  }

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

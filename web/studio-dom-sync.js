import { listDesignerControls } from '../src/designer.js';
import { patchComponent } from '../src/component-registry.js';

export const STUDIO_BUILD_READINESS_VERSION = '0.1';
export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.7';

const WORKSHOP_PICTURE_SOURCE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVR42mP88evPf4YBBEwMAwxGHcCCT1I38z2cfXm6IFZxfABZDy7AiC0REmsBsQCfQ+gSBfg8xERr3xMyd3AnQnLjFZdvdTPfY+hjorblxKZ+sh1ArOHEqht6JSGxuYRYdUzUztf45LFFCwstCpdBWRnhSpRMA2k5RVFArazIQiuDR1tEow4YdQDZDqBmXT8kQoARX98QV7+Abg4YzQX0AAAIsD5sBwsk2AAAAABJRU5ErkJggg==';

const WORKSHOP_MAIN_V07 = `window "Workshop Desk" as main size 1080, 720:
  shape rounded as desk_header fill #eef2ff stroke #c7d2fe stroke-width 1 radius 18 opacity 1 at 16, 12 size 1048, 76
  picture as workshop_logo from "${WORKSHOP_PICTURE_SOURCE}" description "Workshop mark" at 28, 24 size 52, 52
  text "Workshop Desk" at 96, 20 size 280, 28
  text "{status}" at 96, 50 size 500, 24
  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 620, 20 size 420, 28
  text "Current Ready · IR 1.9 · runtime v1.10" at 620, 50 size 420, 22

  shape rounded as ticket_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 100 size 1048, 248
  text "Ticket" at 32, 112 size 120, 24
  text "Customer" at 32, 144 size 100, 20
  combo "Ada", "Grace", "Linus", "Margaret" as customer at 32, 168 size 200, 36
  text "Item" at 248, 144 size 80, 20
  input item at 248, 168 size 240, 36
  text "Quantity {qty}" at 508, 144 size 140, 20
  slider 1..8 as qty step 1 at 508, 168 size 210, 36
  checkbox "Rush bench" as rush at 740, 168 size 160, 36

  text "Payment" at 32, 220 size 90, 20
  radio "Card", "Cash", "Account" as pay at 32, 244 size 220, 84
  text "Priority" at 272, 220 size 90, 20
  radio "Normal", "High", "Critical" as priority at 272, 244 size 220, 84
  text "Notes" at 512, 220 size 80, 20
  input notes at 512, 244 size 250, 36
  text "Services" at 780, 220 size 90, 20
  listbox "Diagnostics", "Warranty", "Install", "Pickup" as services at 780, 244 size 260, 84

  shape rounded as queue_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 360 size 640, 292
  text "Queue" at 32, 372 size 120, 22
  table "Ticket", "Customer", "Bench", "State" as board at 32, 402 size 608, 230:
    row "WD-104", "Ada", "Bench A", "Open"
    row "WD-105", "Grace", "Bench B", "Quoted"
    row "WD-106", "Linus", "Bench A", "Ready"
    row "WD-107", "Margaret", "Overflow", "Waiting"

  shape rounded as side_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 668, 360 size 396, 292
  text "Parts & tools" at 684, 372 size 180, 22
  tree as parts at 684, 400 size 168, 232:
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
  button "Quote" as quote_button at 864, 400 size 180, 32
  button "Details" as details_button at 864, 438 size 180, 32
  button "Ready" as complete_button at 864, 476 size 180, 32
  button "Reset" as reset_button at 864, 514 size 180, 32
  button "Inventory" as inventory_button at 864, 552 size 86, 30
  button "Customer" as customer_button at 958, 552 size 86, 30
  button "Diagnostics" as diagnostics_button at 864, 588 size 86, 30
  button "Settings" as settings_button at 958, 588 size 86, 30
  button "Components" as components_button at 864, 622 size 180, 28

  # @layout anchor left right bottom
  text "Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component." at 16, 660 size 1048, 22
  timer as workshop_clock interval 5000
  statusbar "{status}" as desk_status at 0, 692 size 1080, 28`;

const WORKSHOP_GALLERY_STATE_V07 = `create text gallery_text = "Workshop sample"
create boolean gallery_enabled = true
create text gallery_mode = "Ready"
create text gallery_color = "Blue"
create list gallery_features = ["Designer"]
create number gallery_level = 60
create text gallery_status = "Component gallery ready"
create number gallery_ticks = 0`;

const WORKSHOP_DETAILS_V07 = `window "Job details" as details size 640, 560:
  shape rounded as details_header fill #eef2ff stroke #c7d2fe stroke-width 1 radius 16 opacity 1 at 16, 12 size 608, 68
  text "Job details" at 32, 22 size 240, 26
  text "{status}" at 32, 48 size 560, 22

  shape rounded as details_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 92 size 608, 140
  text "Customer: {customer}" at 32, 108 size 270, 22
  text "Item: {item}" at 32, 134 size 270, 22
  text "Quantity: {qty}" at 32, 160 size 270, 22
  text "Bench: {ticket_bench}" at 32, 186 size 270, 22
  text "Priority: {priority}" at 330, 108 size 270, 22
  text "Payment: {pay}" at 330, 134 size 270, 22
  text "State: {ticket_state}" at 330, 160 size 270, 22
  text "Current quote: {ticket_total}" at 330, 186 size 270, 22

  shape rounded as canvas_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 244 size 296, 200
  text "Ticket canvas" at 32, 256 size 200, 20
  paintbox as ticket_canvas at 32, 282 size 264, 146

  shape rounded as rates_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 324, 244 size 300, 200
  panel as runtime_panel at 340, 260 size 268, 168:
    text "Native runtime pulse {heartbeat}"
    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"
    text "Quote revision {quote_revision}"
    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1

  button "Add inspection" as details_quote at 16, 460 size 180, 36
  button "Mark ready" as details_ready at 208, 460 size 180, 36
  button "Close details" as close_details at 400, 460 size 180, 36`;

const WORKSHOP_GALLERY_FORM_V07 = `window "Component Gallery" as components size 900, 640:
  shape rounded as gallery_header fill #ecfeff stroke #bae6fd stroke-width 1 radius 18 opacity 1 at 16, 12 size 868, 64
  text "Component Gallery" at 32, 22 size 280, 26
  text "{gallery_status}" at 330, 22 size 530, 26
  text "Current Ready native subset" at 32, 48 size 360, 20

  shape rounded as inputs_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 88 size 430, 292
  text "Inputs & choices" at 32, 100 size 220, 22
  text "Text input" at 32, 128 size 120, 18
  input gallery_text at 32, 148 size 190, 32
  checkbox "Enabled" as gallery_enabled at 236, 148 size 190, 32
  text "Mode" at 32, 190 size 80, 18
  radio "Ready", "Review", "Blocked" as gallery_mode at 32, 210 size 190, 148
  text "Color" at 236, 190 size 80, 18
  combo "Blue", "Green", "Amber", "Red" as gallery_color at 236, 210 size 190, 32
  text "Level {gallery_level}" at 236, 250 size 180, 18
  slider 0..100 as gallery_level step 10 at 236, 270 size 190, 28
  text "Features" at 236, 304 size 120, 16
  listbox "Designer", "Compiler", "Runtime", "Offline" as gallery_features at 236, 322 size 190, 44

  shape rounded as graphics_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 458, 88 size 426, 292
  text "Graphics & containers" at 474, 100 size 280, 22
  picture as gallery_picture from "${WORKSHOP_PICTURE_SOURCE}" description "Gallery picture" at 474, 132 size 64, 64
  shape rounded as gallery_shape fill #dbeafe stroke #2563eb stroke-width 2 radius 14 opacity 1 at 554, 132 size 88, 64
  paintbox as gallery_canvas at 658, 132 size 200, 110
  panel as gallery_panel at 474, 256 size 384, 108:
    text "Panel Stage 1"
    text "Source-backed visual grouping"

  imagelist as gallery_images size 20, 20:
    image mark from "patch-resource:workshop.mark"

  shape rounded as data_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 16 opacity 1 at 16, 392 size 868, 158
  text "Data controls" at 32, 404 size 180, 22
  text "ImageList is nonvisual and is shown in the Object Tree." at 230, 404 size 500, 22
  table "Component", "Event", "State" as gallery_table at 32, 436 size 500, 100:
    row "Button", "clicked", "Ready"
    row "Input", "changed", "Ready"
    row "Table", "changed", "Ready"
    row "TreeView", "changed", "Ready"
    row "PaintBox", "paint", "Ready"

  tree as gallery_tree at 548, 436 size 312, 100:
    node "Registry 0.10 native subset"
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

  button "Refresh" as gallery_refresh at 560, 564 size 148, 32
  button "Close gallery" as close_components at 720, 564 size 148, 32
  timer as gallery_clock interval 2000
  statusbar "{gallery_status}" as gallery_statusbar at 0, 612 size 900, 28`;

const WORKSHOP_GALLERY_EVENTS_V07 = `when gallery_text changed:
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
 * canonical polished v0.7 showcase. The compatibility literal remains embedded
 * in beta35-studio.js so old cached Studio shells still load, while this bridge
 * owns the current source. User-authored projects are not rewritten by this
 * helper unless they still match a known canonical Workshop v0.5 or v0.6 signature.
 */
function spliceWorkshopSection(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) return source;
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0 || end <= start) return source;
  return `${source.slice(0, start)}${replacement}\n${source.slice(end)}`;
}

function installCurrentWorkshopForms(source) {
  const withDetails = spliceWorkshopSection(
    source,
    'window "Job details" as details size 640, 560:',
    '\nwindow "Inventory Center"',
    WORKSHOP_DETAILS_V07
  );
  return spliceWorkshopSection(
    withDetails,
    'window "Component Gallery" as components size 900, 640:',
    '\nwhen customer changed:',
    WORKSHOP_GALLERY_FORM_V07
  );
}

export function upgradeWorkshopDeskSource(source) {
  let next = String(source ?? '');
  const v07 = next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented')
    && next.includes('create number quote_revision = 0')
    && next.includes('Base rate and inspection added')
    && next.includes('Current desktop Ready runtime contract: v1.10.');
  if (v07) return next;

  const v06 = next.includes('window "Workshop Desk" as main size 1080, 720:')
    && next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented')
    && next.includes('Current desktop Ready runtime contract: v1.10.')
    && next.includes('when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Quote increased by 25"')
    && next.includes('when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection added to quote"')
    && next.includes('set = "Complete Component Registry 0.9 gallery opened"')
    && !next.includes('create number quote_revision = 0');
  if (v06) {
    const mainStart = next.indexOf('window "Workshop Desk" as main size 1080, 720:');
    const settingsStart = next.indexOf('\nwindow "Workshop settings" as settings size 720, 520:');
    if (mainStart >= 0 && settingsStart > mainStart) {
      next = `${next.slice(0, mainStart)}${WORKSHOP_MAIN_V07}\n${next.slice(settingsStart)}`;
    }
    next = next
      .replace(
        'create number ticket_total = 40',
        'create number ticket_total = 40\ncreate number base_rate = 25\ncreate number inspection_fee = 15\ncreate number rush_fee = 20\ncreate number quote_revision = 0'
      )
      .replace(
        '  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28',
        '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 750, 18 size 300, 28'
      )
      .replace(
        '  text "Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24',
        '  text "Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24'
      )
      .replace(
        '      text "It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring."',
        '      text "It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring."'
      )
      .replace(
        '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
        '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\n    text "Quote revision {quote_revision}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
      )
      .replace(
        '      text "Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface."',
        '      text "Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10."'
      )
      .replace('    node "Registry 0.9"', '    node "Registry 0.10 native subset"')
      .replace(
        'when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Quote increased by 25"',
        'when quote_button clicked:\n  change ticket_total:\n    add 25\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Base rate and inspection added"'
      )
      .replace(
        'when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection added to quote"',
        'when details_quote clicked:\n  change ticket_total:\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection fee added to quote"'
      )
      .replace(
        '    set = "Complete Component Registry 0.9 gallery opened"',
        '    set = "Current Ready Component Registry 0.10 subset opened"'
      )
      .replace(
        '  change ticket_total:\n    set = 40\n',
        '  change ticket_total:\n    set = 40\n  change quote_revision:\n    set = 0\n'
      );
    return installCurrentWorkshopForms(next);
  }

  const v05 = next.includes('window "Workshop Desk" as main size 1080, 700:')
    && next.includes('Six-Form Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar.')
    && next.includes('window "Workshop Diagnostics" as diagnostics size 840, 620:')
    && next.includes('Current desktop Ready runtime contract: v1.8.')
    && !next.includes('create thing ticket:');
  if (!v05) return next;

  if (!next.includes('create number base_rate = 25')) {
    next = next.replace(
      'create number ticket_total = 40',
      'create number ticket_total = 40\ncreate number base_rate = 25\ncreate number inspection_fee = 15\ncreate number rush_fee = 20\ncreate number quote_revision = 0'
    );
  }

  if (!next.includes('create text gallery_text = "Workshop sample"')) {
    next = next.replace(
      'create text diagnostic_status = "All systems ready"',
      `create text diagnostic_status = "All systems ready"\n${WORKSHOP_GALLERY_STATE_V07}`
    );
  }

  const mainStart = next.indexOf('window "Workshop Desk" as main size 1080, 700:');
  const settingsStart = next.indexOf('\nwindow "Workshop settings" as settings size 720, 520:');
  if (mainStart < 0 || settingsStart < 0 || settingsStart <= mainStart) return next;
  next = `${next.slice(0, mainStart)}${WORKSHOP_MAIN_V07}${next.slice(settingsStart)}`;

  next = next
    .replace(
      '      text "Workshop Desk is the Patch Studio six-Form showcase project."\n      text "It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls."',
      '      text "Workshop Desk is the Patch Studio seven-Form RAD showcase project."\n      text "It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring."\n      text "Current Ready desktop contract: Native GUI IR 1.9 / payload v19 / runtime v1.10."'
    )
    .replace('      text "Current desktop Ready runtime contract: v1.8."', '      text "Current desktop Ready runtime contract: v1.10."')
    .replace(
      '      text "Workshop Desk exercises six Forms and multiple adapter-backed controls."',
      '      text "Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10."'
    )
    .replace('    row "Runtime", "Desktop v1.8", "Ready"', '    row "Runtime", "Desktop v1.10", "Ready"')
    .replace('    set = "Workshop board row selected"', '    set = "Queue selection changed · open Details to continue"')
    .replace('    set = "Inventory tree path selected"', '    set = "Parts selection changed · open Inventory to continue"');

  next = next.replace(
    '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
    '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\n    text "Quote revision {quote_revision}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
  );

  next = next
    .replace(
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Quote increased by 25"',
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Base rate and inspection added"'
    )
    .replace(
      'when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection added to quote"',
      'when details_quote clicked:\n  change ticket_total:\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection fee added to quote"'
    )
    .replace(
      '  change ticket_total:\n    set = 40\n',
      '  change ticket_total:\n    set = 40\n  change quote_revision:\n    set = 0\n'
    );

  if (!next.includes('window "Component Gallery" as components size 900, 640:')) {
    next = next.replace('\nwhen customer changed:', `\n${WORKSHOP_GALLERY_FORM_V07}\n\nwhen customer changed:`);
  }

  if (!next.includes('when components_button clicked:')) {
    next = next.replace(
      'when diagnostics_button clicked:\n  open diagnostics\n  change diagnostic_status:\n    set = "Diagnostics opened from Workshop Desk"',
      'when diagnostics_button clicked:\n  open diagnostics\n  change diagnostic_status:\n    set = "Diagnostics opened from Workshop Desk"\n\nwhen components_button clicked:\n  open components\n  change gallery_status:\n    set = "Current Ready Component Registry 0.10 subset opened"'
    );
  }

  if (!next.includes('when gallery_text changed:')) {
    next = next.replace('\nwhen reset_button clicked:', `\n${WORKSHOP_GALLERY_EVENTS_V07}\n\nwhen reset_button clicked:`);
  }

  if (!next.includes('  change gallery_text:\n    set = "Workshop sample"')) {
    next = next.replace(
      '  change diagnostic_status:\n    set = "All systems ready"\n  change status:\n    set = "Ticket reset"',
      '  change diagnostic_status:\n    set = "All systems ready"\n  change gallery_text:\n    set = "Workshop sample"\n  change gallery_enabled:\n    set = true\n  change gallery_mode:\n    set = "Ready"\n  change gallery_color:\n    set = "Blue"\n  change gallery_features:\n    set = ["Designer"]\n  change gallery_level:\n    set = 60\n  change gallery_status:\n    set = "Component gallery ready"\n  change gallery_ticks:\n    set = 0\n  change status:\n    set = "Ticket reset"'
    );
  }

  return installCurrentWorkshopForms(next);
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

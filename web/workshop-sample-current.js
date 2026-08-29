export const WORKSHOP_DESK_IMAGE_SAMPLE_VERSION = '0.1';

const WORKSHOP_ICON_SOURCE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';

export function upgradeWorkshopDeskImageSurface(source) {
  let next = String(source ?? '');
  if (!next.includes('window "Workshop Desk" as main size 1080, 700:')) return next;
  if (next.includes('imagelist as workshop_icons size 24, 24:') && next.includes('image workshop_icons.quote')) return next;

  next = next.replace(
    /(  picture as workshop_logo from "[^"]+" description "Workshop mark" at 958, 58 size 70, 70\n)/,
    `$1  imagelist as workshop_icons size 24, 24:\n    image quote from "${WORKSHOP_ICON_SOURCE}"\n`
  );
  next = next.replace(
    '  button "Create quote" as quote_button at 878, 320 size 150, 38',
    '  button "Create quote" as quote_button image workshop_icons.quote at 878, 320 size 150, 38'
  );
  next = next.replace(
    'Current Ready demo: Forms, Picture, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar.',
    'Current Ready demo: Forms, Picture, ImageList/Button image, PaintBox draw image, Tabs, Table, TreeView, Slider, Panel, Timer, Shape and StatusBar.'
  );
  next = next.replace(
    'It uses current native-ready Picture, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls.',
    'It uses current native-ready Picture, ImageList/Button image, PaintBox image drawing, Panel, Shape, Timer, Tabs, Table, TreeView, Slider and StatusBar controls.'
  );
  return next;
}

const doc = typeof document === 'undefined' ? null : document;
const sample = doc?.querySelector('#sample') ?? null;
const code = doc?.querySelector('#code') ?? null;
let queued = false;

function scheduleUpgrade() {
  if (!sample || !code || sample.value !== 'workshopDesk' || queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    if (sample.value !== 'workshopDesk') return;
    const upgraded = upgradeWorkshopDeskImageSurface(code.value);
    if (upgraded === code.value) return;
    code.value = upgraded;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

if (doc && sample && code) {
  code.addEventListener('input', scheduleUpgrade);
  code.addEventListener('change', scheduleUpgrade);
  sample.addEventListener('change', scheduleUpgrade);
  queueMicrotask(scheduleUpgrade);
}

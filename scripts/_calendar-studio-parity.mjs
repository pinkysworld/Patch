import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(path, after);
}

function once(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

edit('src/window-input-presentation.js', source => {
  let s = source;
  s = once(
    s,
    "  ensureCalendarButton();\n  ensureInputPresentationInspector();",
    "  ensureCalendarButton();\n  ensureCalendarStyle();\n  ensureInputPresentationInspector();",
    'Calendar style install'
  );
  s = once(
    s,
    "  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {\n    for (const input of root?.querySelectorAll?.('input.patch-input') ?? []) {",
    "  for (const [root, interactive] of [[document.querySelector('#designerCanvas'), false], [document.querySelector('#app'), true]]) {\n    for (const input of root?.querySelectorAll?.('input.patch-input') ?? []) {",
    'surface root tuple'
  );
  s = once(
    s,
    "      const password = passwordIds.has(id);\n      const mask = masks.get(id) ?? null;\n      input.type = numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : 'text';",
    "      const password = passwordIds.has(id);\n      const mask = masks.get(id) ?? null;\n      if (!calendar) unwrapStudioCalendar(input);\n      input.type = numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : 'text';",
    'Calendar unwrap before other modes'
  );
  s = once(
    s,
    "      } else if (calendar) {\n        clearMaskFromStudioInput(input);\n        input.setAttribute('aria-label', `${id || 'Calendar'} calendar input`);\n      } else if (mask && !password) applyMaskToStudioInput(input, id, mask);",
    "      } else if (calendar) {\n        clearMaskFromStudioInput(input);\n        input.setAttribute('aria-label', `${id || 'Calendar'} calendar input`);\n        syncStudioCalendar(input, id, interactive);\n      } else if (mask && !password) applyMaskToStudioInput(input, id, mask);",
    'Calendar visual sync'
  );
  s = once(
    s,
    "function clearMaskFromStudioInput(input) {",
    `const CALENDAR_MONTHS = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const CALENDAR_WEEKDAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const CALENDAR_LAYOUT_PROPS = Object.freeze(['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'margin', 'maxWidth', 'minWidth', 'maxHeight', 'minHeight', 'boxSizing']);

function ensureCalendarStyle() {
  if (document.querySelector('#patchCalendarStage1Style')) return;
  const style = document.createElement('style');
  style.id = 'patchCalendarStage1Style';
  style.textContent = \`\n.patch-calendar-stage1{display:flex;flex-direction:column;gap:5px;width:294px;max-width:100%;padding:7px;border:1px solid var(--border-strong,#d4d4d8);border-radius:10px;background:var(--surface,#fff);color:var(--text,#18181b);box-sizing:border-box}\n.patch-calendar-stage1>.patch-input{position:static!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;width:100%!important;max-width:none!important;height:32px!important;min-height:32px!important;margin:0!important;box-sizing:border-box}\n.patch-calendar-stage1-head{display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:4px}\n.patch-calendar-stage1-title{text-align:center;font-size:12px;font-weight:750;line-height:28px;white-space:nowrap}\n.patch-calendar-stage1-nav,.patch-calendar-stage1-day{font:inherit;border:0;border-radius:6px;background:transparent;color:inherit;min-width:0;cursor:pointer}\n.patch-calendar-stage1-nav{height:28px;font-size:18px;line-height:1}\n.patch-calendar-stage1-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;width:100%}\n.patch-calendar-stage1-weekday{text-align:center;font-size:9px;font-weight:750;line-height:16px;opacity:.65}\n.patch-calendar-stage1-day{height:24px;padding:0;font-size:10px;font-weight:650}\n.patch-calendar-stage1-day:hover,.patch-calendar-stage1-day:focus-visible{background:color-mix(in srgb,var(--text,#18181b) 10%,transparent);outline:none}\n.patch-calendar-stage1-day[aria-pressed=\"true\"]{background:var(--text,#18181b);color:var(--surface,#fff)}\n.patch-calendar-stage1-day:disabled{opacity:.18;cursor:default}\n#designerCanvas .patch-calendar-stage1-nav,#designerCanvas .patch-calendar-stage1-day{pointer-events:none}\n\`;
  document.head?.appendChild(style);
}

function parseCalendarIsoDate(value) {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month: month - 1, day };
}

function calendarIsoDate(year, month, day) {
  return \`${'${year}'}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
}

function moveCalendarLayoutToHost(input, host) {
  if (input.dataset.patchCalendarMovedStyle) return;
  const moved = {};
  for (const property of CALENDAR_LAYOUT_PROPS) {
    const value = input.style[property];
    if (!value) continue;
    moved[property] = value;
    host.style[property] = value;
    input.style[property] = '';
  }
  input.dataset.patchCalendarMovedStyle = JSON.stringify(moved);
  if (input.dataset.patchControlKey) {
    host.dataset.patchControlKey = input.dataset.patchControlKey;
    delete input.dataset.patchControlKey;
    host.__patchControlFingerprint = input.__patchControlFingerprint;
  }
  input.dataset.patchCalendarPreviousReadOnly = input.readOnly ? '1' : '0';
}

function restoreCalendarLayoutFromHost(input, host) {
  try {
    const moved = JSON.parse(input.dataset.patchCalendarMovedStyle || '{}');
    for (const property of CALENDAR_LAYOUT_PROPS) {
      input.style[property] = Object.prototype.hasOwnProperty.call(moved, property) ? moved[property] : '';
    }
  } catch { /* stale transient renderer metadata is safe to discard */ }
  delete input.dataset.patchCalendarMovedStyle;
  if (host?.dataset.patchControlKey) {
    input.dataset.patchControlKey = host.dataset.patchControlKey;
    input.__patchControlFingerprint = host.__patchControlFingerprint;
  }
  if (input.dataset.patchCalendarPreviousReadOnly !== undefined) {
    input.readOnly = input.dataset.patchCalendarPreviousReadOnly === '1';
    delete input.dataset.patchCalendarPreviousReadOnly;
  }
}

function unwrapStudioCalendar(input) {
  const host = input.closest?.('.patch-calendar-stage1');
  if (!host) return;
  restoreCalendarLayoutFromHost(input, host);
  host.parentNode?.insertBefore(input, host);
  host.remove();
}

function syncStudioCalendar(input, id, interactive) {
  ensureCalendarStyle();
  let host = input.closest?.('.patch-calendar-stage1');
  if (!host) {
    host = document.createElement('div');
    host.className = 'patch-calendar-stage1';
    host.setAttribute('role', 'group');
    input.parentNode?.insertBefore(host, input);
    host.appendChild(input);
    moveCalendarLayoutToHost(input, host);
  }
  host.dataset.patchCalendarId = id || '';
  host.dataset.patchCalendarInteractive = interactive ? 'true' : 'false';
  host.setAttribute('aria-label', \`${'${id || \'Calendar\'}'} calendar\`);
  input.readOnly = true;
  const selected = parseCalendarIsoDate(input.value);
  if (!host.dataset.patchCalendarViewYear || !host.dataset.patchCalendarViewMonth) {
    const today = selected ?? (() => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    })();
    host.dataset.patchCalendarViewYear = String(today.year);
    host.dataset.patchCalendarViewMonth = String(today.month);
  }
  renderStudioCalendar(host, input, id, interactive);
}

function renderStudioCalendar(host, input, id, interactive) {
  const year = Number(host.dataset.patchCalendarViewYear);
  const month = Number(host.dataset.patchCalendarViewMonth);
  const selected = parseCalendarIsoDate(input.value);
  const signature = \`${'${year}'}:\${month}:\${input.value}:\${interactive ? 1 : 0}\`;
  if (host.dataset.patchCalendarSignature === signature) return;
  host.dataset.patchCalendarSignature = signature;

  for (const child of [...host.children]) if (child !== input) child.remove();

  const head = document.createElement('div');
  head.className = 'patch-calendar-stage1-head';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'patch-calendar-stage1-nav';
  previous.textContent = '‹';
  previous.setAttribute('aria-label', 'Previous month');
  previous.disabled = !interactive;
  const title = document.createElement('div');
  title.className = 'patch-calendar-stage1-title';
  title.textContent = \`${'${CALENDAR_MONTHS[month]}'} \${year}\`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'patch-calendar-stage1-nav';
  next.textContent = '›';
  next.setAttribute('aria-label', 'Next month');
  next.disabled = !interactive;
  head.append(previous, title, next);

  const grid = document.createElement('div');
  grid.className = 'patch-calendar-stage1-grid';
  grid.setAttribute('role', 'grid');
  for (const weekday of CALENDAR_WEEKDAYS) {
    const label = document.createElement('div');
    label.className = 'patch-calendar-stage1-weekday';
    label.textContent = weekday;
    label.setAttribute('role', 'columnheader');
    grid.appendChild(label);
  }
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let cell = 0; cell < 42; cell += 1) {
    const day = cell - firstOffset + 1;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'patch-calendar-stage1-day';
    if (day < 1 || day > daysInMonth) {
      button.disabled = true;
      button.setAttribute('aria-hidden', 'true');
      grid.appendChild(button);
      continue;
    }
    const iso = calendarIsoDate(year, month, day);
    button.textContent = String(day);
    button.setAttribute('aria-label', iso);
    button.setAttribute('aria-pressed', selected?.year === year && selected?.month === month && selected?.day === day ? 'true' : 'false');
    button.disabled = !interactive;
    if (interactive) button.addEventListener('click', () => {
      input.value = iso;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    grid.appendChild(button);
  }
  const navigate = delta => {
    const target = new Date(year, month + delta, 1);
    host.dataset.patchCalendarViewYear = String(target.getFullYear());
    host.dataset.patchCalendarViewMonth = String(target.getMonth());
    host.dataset.patchCalendarSignature = '';
    renderStudioCalendar(host, input, id, interactive);
  };
  if (interactive) {
    previous.addEventListener('click', () => navigate(-1));
    next.addEventListener('click', () => navigate(1));
  }
  host.append(head, grid);
}

function clearMaskFromStudioInput(input) {`,
    'Calendar Studio renderer helpers'
  );
  return s;
});

edit('tests/calendar-stage1.test.js', source => once(
  source,
  "  assert.match(studio, /calendar \\? 'calendar'/);\n});",
  "  assert.match(studio, /calendar \\? 'calendar'/);\n  assert.match(studio, /function syncStudioCalendar\\(input, id, interactive\\)/);\n  assert.match(studio, /patch-calendar-stage1-grid/);\n  assert.match(studio, /Previous month/);\n  assert.match(studio, /Next month/);\n  assert.match(studio, /input\\.dispatchEvent\\(new Event\\('input', \\{ bubbles: true \\}\\)\\)/);\n  assert.match(studio, /host\\.dataset\\.patchControlKey = input\\.dataset\\.patchControlKey/);\n});",
  'Calendar Studio visual assertions'
));

console.log('Calendar Studio parity patch applied.');

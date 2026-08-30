import { buildDiagnosticAssist, applyDiagnosticFix } from '../src/diagnostic-assist.js';

export const PATCH_STUDIO_SMART_DIAGNOSTICS_VERSION = '0.1';

const output = document.querySelector('#output');
const code = document.querySelector('#code');
const buildTarget = document.querySelector('#buildTarget');
const nativePanel = document.querySelector('#nativeBuildPanel');
let card = null;
let current = null;

if (output && code) {
  installStyles();
  const observer = new MutationObserver(renderFromOutput);
  observer.observe(output, { childList: true, characterData: true, subtree: true });
  renderFromOutput();
}

function renderFromOutput() {
  const diagnostic = parseFormattedDiagnostic(output?.textContent ?? '');
  if (!diagnostic) {
    hideCard();
    return;
  }

  const target = String(buildTarget?.value ?? '');
  const assist = buildDiagnosticAssist(diagnostic, {
    source: code.value,
    buildTarget: target,
    platform: platformFromTarget(target)
  });
  current = { diagnostic, assist };
  renderCard(diagnostic, assist);
}

export function parseFormattedDiagnostic(text) {
  const source = String(text ?? '');
  const match = source.match(/\b(PATCH\d{4})(?:\s+([^\s:]+):(\d+):(\d+))?\s+([^\n]+)/);
  if (!match) return null;
  return {
    code: match[1],
    message: match[5].trim(),
    location: match[3]
      ? { entry: match[2] || 'main.patch', line: Number(match[3]), column: Number(match[4]) }
      : null
  };
}

function renderCard(diagnostic, assist) {
  ensureCard();
  card.hidden = false;
  card.querySelector('[data-smart-title]').textContent = assist.title;
  card.querySelector('[data-smart-code]').textContent = diagnostic.location
    ? `${diagnostic.code} · ${diagnostic.location.entry}:${diagnostic.location.line}`
    : diagnostic.code;
  card.querySelector('[data-smart-what]').textContent = assist.what;
  card.querySelector('[data-smart-why]').textContent = assist.why;
  card.querySelector('[data-smart-recommendation]').textContent = assist.recommendation;

  const fixButton = card.querySelector('[data-smart-fix]');
  fixButton.hidden = !assist.fix;
  fixButton.textContent = assist.fix?.label ? `Fix anwenden · ${assist.fix.label}` : 'Fix anwenden';

  const locate = card.querySelector('[data-smart-locate]');
  locate.hidden = !diagnostic.location?.line;
}

function ensureCard() {
  if (card?.isConnected) return;
  card = document.createElement('section');
  card.id = 'smartDiagnosticCard';
  card.className = 'smart-diagnostic-card';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.setAttribute('aria-label', 'Patch compiler suggestion');
  card.hidden = true;

  const head = document.createElement('div');
  head.className = 'smart-diagnostic-head';
  const title = document.createElement('strong');
  title.dataset.smartTitle = '';
  const badge = document.createElement('span');
  badge.dataset.smartCode = '';
  badge.className = 'smart-diagnostic-code';
  head.append(title, badge);

  const body = document.createElement('div');
  body.className = 'smart-diagnostic-grid';
  body.append(
    field('Was ist passiert?', 'smartWhat'),
    field('Warum?', 'smartWhy'),
    field('Empfohlene Lösung', 'smartRecommendation')
  );

  const actions = document.createElement('div');
  actions.className = 'smart-diagnostic-actions';
  const fix = document.createElement('button');
  fix.type = 'button';
  fix.className = 'smart-diagnostic-primary';
  fix.dataset.smartFix = '';
  fix.textContent = 'Fix anwenden';
  fix.addEventListener('click', applyCurrentFix);

  const locate = document.createElement('button');
  locate.type = 'button';
  locate.className = 'secondary small';
  locate.dataset.smartLocate = '';
  locate.textContent = 'Im Code zeigen';
  locate.addEventListener('click', locateCurrentDiagnostic);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'secondary small';
  dismiss.textContent = 'Ausblenden';
  dismiss.addEventListener('click', hideCard);
  actions.append(fix, locate, dismiss);

  card.append(head, body, actions);
  const anchor = nativePanel?.parentElement ? nativePanel : document.querySelector('.projectbar');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
  else document.querySelector('.studio')?.prepend(card);
}

function field(labelText, key) {
  const wrapper = document.createElement('div');
  wrapper.className = 'smart-diagnostic-field';
  const label = document.createElement('span');
  label.className = 'smart-diagnostic-label';
  label.textContent = labelText;
  const value = document.createElement('p');
  value.dataset[key] = '';
  wrapper.append(label, value);
  return wrapper;
}

function applyCurrentFix() {
  const fix = current?.assist?.fix;
  if (!fix) return;

  if (fix.kind === 'select-build-target') {
    if (!buildTarget) return;
    buildTarget.value = fix.value;
    buildTarget.dispatchEvent(new Event('change', { bubbles: true }));
    markApplied(`Build-Ziel auf ${buildTarget.selectedOptions?.[0]?.textContent ?? fix.value} gesetzt.`);
    return;
  }

  const next = applyDiagnosticFix(code.value, fix);
  if (next === code.value) return;
  code.value = next;
  // These canonical events are intentionally emitted so Studio history,
  // Designer refresh and persistence see the repair as a normal source edit.
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  locateLine(fix.line);
  markApplied('Fix angewendet. Patch hat nur die vorgeschlagene lokale Änderung vorgenommen.');
}

function locateCurrentDiagnostic() {
  const line = current?.diagnostic?.location?.line;
  if (line) locateLine(line);
}

function locateLine(line) {
  const rows = code.value.split(/\r?\n/);
  const target = Math.max(1, Math.min(Number(line) || 1, rows.length));
  let start = 0;
  for (let index = 1; index < target; index += 1) start += rows[index - 1].length + 1;
  const end = start + (rows[target - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function markApplied(message) {
  if (!card) return;
  card.querySelector('[data-smart-recommendation]').textContent = message;
  const fix = card.querySelector('[data-smart-fix]');
  fix.hidden = true;
}

function hideCard() {
  if (card) card.hidden = true;
  current = null;
}

function platformFromTarget(target) {
  const value = String(target ?? '');
  if (value === 'native-macos') return 'macos';
  if (value === 'native-windows') return 'windows';
  if (value === 'native-linux') return 'linux';
  if (value === 'native-freebsd') return 'freebsd';
  return '';
}

function installStyles() {
  if (document.querySelector('style[data-patch-smart-diagnostics]')) return;
  const style = document.createElement('style');
  style.dataset.patchSmartDiagnostics = PATCH_STUDIO_SMART_DIAGNOSTICS_VERSION;
  style.textContent = `
    .smart-diagnostic-card {
      margin: 10px 18px 0;
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, #f59e0b 58%, var(--border, #d4d4d8));
      border-radius: 14px;
      background: color-mix(in srgb, #fef3c7 34%, var(--surface, #fff));
      color: var(--text, #18181b);
      box-shadow: 0 8px 24px rgb(0 0 0 / 7%);
    }
    .smart-diagnostic-card[hidden] { display: none !important; }
    .smart-diagnostic-head { display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .smart-diagnostic-head strong { font-size:14px; }
    .smart-diagnostic-code { font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--muted,#666); }
    .smart-diagnostic-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .smart-diagnostic-field { min-width:0; padding:10px; border-radius:10px; background:color-mix(in srgb, var(--surface,#fff) 76%, transparent); }
    .smart-diagnostic-label { display:block; margin-bottom:4px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--muted,#666); }
    .smart-diagnostic-field p { margin:0; font-size:12px; line-height:1.45; overflow-wrap:anywhere; }
    .smart-diagnostic-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    .smart-diagnostic-primary { border:0; border-radius:8px; padding:7px 11px; font-weight:750; cursor:pointer; background:#1d4ed8; color:#fff; }
    @media (max-width:760px) { .smart-diagnostic-grid { grid-template-columns:1fr; } .smart-diagnostic-card { margin-inline:10px; } }
    @media (forced-colors:active) { .smart-diagnostic-card { border:1px solid CanvasText; } .smart-diagnostic-primary { border:1px solid ButtonText; } }
  `;
  document.head.appendChild(style);
}

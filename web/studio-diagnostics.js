import { compile } from '../src/compiler.js';
import { studioProjectFileStem } from '../src/studio-project.js';
import { buildDiagnosticAssist, applyDiagnosticFix } from '../src/diagnostics.js';
import {
  buildStudioDiagnosticReport,
  formatStudioDiagnosticReport,
  redactDiagnosticText,
  serializeStudioDiagnosticReport
} from '../src/studio-diagnostics.js';
import { getStudioProjectDiagnosticContext } from './project-lifecycle.js';

const projectName = document.querySelector('#projectName');
const buildTarget = document.querySelector('#buildTarget');
const copyButton = document.querySelector('#copyDiagnostics');
const downloadButton = document.querySelector('#downloadDiagnostics');
const diagnosticsState = document.querySelector('#diagnosticsState');
const code = document.querySelector('#code');
const output = document.querySelector('#output');
const nativePanel = document.querySelector('#nativeBuildPanel');
const recentErrors = [];
const MAX_RECENT_ERRORS = 10;
let smartCard = null;
let currentSmartDiagnostic = null;

installStylesheet();
installSmartDiagnosticStyles();
adoptStartupDiagnostics();
installErrorCapture();
renderSmartDiagnostic(output?.textContent ?? '');
copyButton?.addEventListener('click', copyDiagnostics);
downloadButton?.addEventListener('click', downloadDiagnostics);

async function collectReport() {
  const context = getStudioProjectDiagnosticContext();
  let compilerError = null;
  try {
    compile(context.source, {
      name: studioProjectFileStem(projectName?.value),
      kind: context.kind,
      entry: context.entry
    });
  } catch (error) {
    compilerError = error;
  }

  return buildStudioDiagnosticReport({
    patchVersion: document.querySelector('.studio')?.dataset.patchVersion ?? 'unknown',
    source: context.source,
    entry: context.entry,
    composition: context.composition,
    projectKind: context.kind,
    buildTarget: buildTarget?.value ?? 'unknown',
    compilerError,
    recentErrors,
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      standalone: window.matchMedia?.('(display-mode: standalone)')?.matches === true,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller)
    }
  });
}

async function copyDiagnostics() {
  setState('Preparing diagnostics…');
  try {
    const report = await collectReport();
    await copyText(formatStudioDiagnosticReport(report));
    setState('Diagnostics copied. Local only.');
  } catch (error) {
    rememberError('diagnostics-copy', error);
    setState('Could not copy diagnostics.', error?.message);
  }
}

async function downloadDiagnostics() {
  setState('Preparing report…');
  try {
    const report = await collectReport();
    const filename = `${studioProjectFileStem(projectName?.value)}.patchreport`;
    download(filename, serializeStudioDiagnosticReport(report), 'application/json');
    setState(`Saved ${filename}. Nothing uploaded.`);
  } catch (error) {
    rememberError('diagnostics-report', error);
    setState('Could not create report.', error?.message);
  }
}

function adoptStartupDiagnostics() {
  const startup = window.__patchStudioStartupDiagnostics;
  if (startup?.snapshot) {
    for (const entry of startup.snapshot()) rememberStartupEntry(entry);
  }
  window.addEventListener('patch:studio-startup-diagnostic', event => {
    rememberStartupEntry(event.detail);
  });
}

function rememberStartupEntry(entry) {
  if (!entry) return;
  const type = `startup-${String(entry.type ?? 'error')}`;
  const asset = String(entry.asset ?? '').trim();
  const message = `${asset ? `${asset}: ` : ''}${String(entry.message ?? 'Unknown startup error')}`;
  rememberError(type, message);
}

function installErrorCapture() {
  window.addEventListener('error', event => {
    rememberError('browser-error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', event => {
    rememberError('unhandled-rejection', event.reason);
  });

  for (const [element, type] of [
    [output, 'studio-output'],
    [document.querySelector('#changes'), 'change-contract'],
    [document.querySelector('#nativeBuildStatus'), 'native-build'],
    [document.querySelector('#saveState'), 'storage']
  ]) {
    if (!element || typeof MutationObserver === 'undefined') continue;
    const observer = new MutationObserver(() => {
      captureVisibleFailure(type, element.textContent);
      if (element === output) renderSmartDiagnostic(element.textContent);
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  }
}

function captureVisibleFailure(type, text) {
  const message = String(text ?? '').trim();
  if (!message || !/(?:stopped|failed|failure|error|unavailable|invalid|could not)/i.test(message)) return;
  rememberError(type, message);
}

function rememberError(type, error) {
  const message = typeof error === 'object' && error !== null ? error.message ?? String(error) : String(error ?? 'Unknown error');
  const normalized = redactDiagnosticText(message);
  const previous = recentErrors[recentErrors.length - 1];
  if (previous?.type === type && previous?.message === normalized) return;
  recentErrors.push({ time: new Date().toISOString(), type, message: normalized });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS);
}

function renderSmartDiagnostic(text) {
  const diagnostic = parseFormattedDiagnostic(text);
  if (!diagnostic || !code) {
    hideSmartDiagnostic();
    return;
  }

  let context;
  try { context = getStudioProjectDiagnosticContext(); }
  catch { context = { source: code.value, entry: 'main.patch' }; }
  const target = String(buildTarget?.value ?? '');
  const assist = buildDiagnosticAssist(diagnostic, {
    source: context.source ?? code.value,
    buildTarget: target,
    platform: platformFromTarget(target)
  });
  currentSmartDiagnostic = { diagnostic, assist };
  renderSmartCard(diagnostic, assist);
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

function renderSmartCard(diagnostic, assist) {
  ensureSmartCard();
  if (!smartCard) return;
  smartCard.hidden = false;
  smartCard.querySelector('[data-smart-title]').textContent = assist.title;
  smartCard.querySelector('[data-smart-code]').textContent = diagnostic.location
    ? `${diagnostic.code} · ${diagnostic.location.entry}:${diagnostic.location.line}`
    : diagnostic.code;
  smartCard.querySelector('[data-smart-what]').textContent = assist.what;
  smartCard.querySelector('[data-smart-why]').textContent = assist.why;
  smartCard.querySelector('[data-smart-recommendation]').textContent = assist.recommendation;

  const fixButton = smartCard.querySelector('[data-smart-fix]');
  fixButton.hidden = !assist.fix;
  fixButton.textContent = assist.fix?.label ? `Apply fix · ${assist.fix.label}` : 'Apply fix';
  smartCard.querySelector('[data-smart-locate]').hidden = !diagnostic.location?.line;
}

function ensureSmartCard() {
  if (smartCard?.isConnected) return;
  smartCard = document.createElement('section');
  smartCard.id = 'smartDiagnosticCard';
  smartCard.className = 'smart-diagnostic-card';
  smartCard.setAttribute('role', 'status');
  smartCard.setAttribute('aria-live', 'polite');
  smartCard.setAttribute('aria-label', 'Patch compiler suggestion');
  smartCard.hidden = true;

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
    smartField('What happened?', 'smartWhat'),
    smartField('Why?', 'smartWhy'),
    smartField('Recommended solution', 'smartRecommendation')
  );

  const actions = document.createElement('div');
  actions.className = 'smart-diagnostic-actions';
  const fix = document.createElement('button');
  fix.type = 'button';
  fix.className = 'smart-diagnostic-primary';
  fix.dataset.smartFix = '';
  fix.textContent = 'Apply fix';
  fix.addEventListener('click', applyCurrentSmartFix);

  const locate = document.createElement('button');
  locate.type = 'button';
  locate.className = 'secondary small';
  locate.dataset.smartLocate = '';
  locate.textContent = 'Show in code';
  locate.addEventListener('click', locateCurrentSmartDiagnostic);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'secondary small';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', hideSmartDiagnostic);
  actions.append(fix, locate, dismiss);

  smartCard.append(head, body, actions);
  const anchor = nativePanel ?? document.querySelector('.projectbar');
  if (anchor?.parentNode) anchor.parentNode.insertBefore(smartCard, anchor.nextSibling);
  else document.querySelector('.studio')?.prepend(smartCard);
}

function smartField(labelText, key) {
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

function applyCurrentSmartFix() {
  const fix = currentSmartDiagnostic?.assist?.fix;
  if (!fix || !code) return;

  if (fix.kind === 'select-build-target') {
    if (!buildTarget) return;
    buildTarget.value = fix.value;
    buildTarget.dispatchEvent(new Event('change', { bubbles: true }));
    markSmartFixApplied(`Build target changed to ${buildTarget.selectedOptions?.[0]?.textContent ?? fix.value}.`);
    return;
  }

  const next = applyDiagnosticFix(code.value, fix);
  if (next === code.value) return;
  code.value = next;
  // Keep repairs on the normal Studio mutation path so history, persistence and
  // Designer refresh observe them exactly like a user source edit.
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  locateSmartLine(fix.line);
  markSmartFixApplied('Fix applied. Patch changed only the suggested local source fragment.');
}

function locateCurrentSmartDiagnostic() {
  const line = currentSmartDiagnostic?.diagnostic?.location?.line;
  if (line) locateSmartLine(line);
}

function locateSmartLine(line) {
  if (!code) return;
  const rows = code.value.split(/\r?\n/);
  const target = Math.max(1, Math.min(Number(line) || 1, rows.length));
  let start = 0;
  for (let index = 1; index < target; index += 1) start += rows[index - 1].length + 1;
  const end = start + (rows[target - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function markSmartFixApplied(message) {
  if (!smartCard) return;
  smartCard.querySelector('[data-smart-recommendation]').textContent = message;
  smartCard.querySelector('[data-smart-fix]').hidden = true;
}

function hideSmartDiagnostic() {
  if (smartCard) smartCard.hidden = true;
  currentSmartDiagnostic = null;
}

function platformFromTarget(target) {
  const value = String(target ?? '');
  if (value === 'native-macos') return 'macos';
  if (value === 'native-windows') return 'windows';
  if (value === 'native-linux') return 'linux';
  if (value === 'native-freebsd') return 'freebsd';
  return '';
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'diagnostics-copy-fallback';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand?.('copy');
  area.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
}

function setState(text, detail = '') {
  if (!diagnosticsState) return;
  diagnosticsState.textContent = text;
  if (detail) diagnosticsState.title = redactDiagnosticText(detail, 300);
  else diagnosticsState.removeAttribute('title');
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-studio-diagnostics]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './studio-diagnostics.css';
  link.dataset.patchStudioDiagnostics = '1';
  document.head.appendChild(link);
}

function installSmartDiagnosticStyles() {
  if (document.querySelector('style[data-patch-smart-diagnostics]')) return;
  const style = document.createElement('style');
  style.dataset.patchSmartDiagnostics = '0.1';
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

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

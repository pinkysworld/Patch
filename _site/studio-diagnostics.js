import { compile } from './src/compiler.js?v=9ad29318e93c7c71';
import { studioProjectFileStem } from './src/studio-project.js?v=9ad29318e93c7c71';
import {
  buildStudioDiagnosticReport,
  formatStudioDiagnosticReport,
  redactDiagnosticText,
  serializeStudioDiagnosticReport
} from './src/studio-diagnostics.js?v=9ad29318e93c7c71';
import { getStudioProjectDiagnosticContext } from './project-lifecycle.js?v=9ad29318e93c7c71';

const projectName = document.querySelector('#projectName');
const buildTarget = document.querySelector('#buildTarget');
const copyButton = document.querySelector('#copyDiagnostics');
const downloadButton = document.querySelector('#downloadDiagnostics');
const diagnosticsState = document.querySelector('#diagnosticsState');
const recentErrors = [];
const MAX_RECENT_ERRORS = 10;

installStylesheet();
adoptStartupDiagnostics();
installErrorCapture();
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
    [document.querySelector('#output'), 'studio-output'],
    [document.querySelector('#changes'), 'change-contract'],
    [document.querySelector('#nativeBuildStatus'), 'native-build'],
    [document.querySelector('#saveState'), 'storage']
  ]) {
    if (!element || typeof MutationObserver === 'undefined') continue;
    const observer = new MutationObserver(() => captureVisibleFailure(type, element.textContent));
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

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

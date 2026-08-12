export const PATCH_STUDIO_DIAGNOSTICS_FORMAT = 'patch-studio-diagnostics';
export const PATCH_STUDIO_DIAGNOSTICS_VERSION = 1;
export const PATCH_STUDIO_DIAGNOSTICS_MAX_ERRORS = 10;
export const PATCH_STUDIO_DIAGNOSTICS_MAX_MESSAGE = 1000;

const encoder = new TextEncoder();

export async function sha256Text(text) {
  const bytes = encoder.encode(String(text ?? ''));
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function redactDiagnosticText(value, maxLength = PATCH_STUDIO_DIAGNOSTICS_MAX_MESSAGE) {
  let text = String(value ?? '');
  text = text
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted-token]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]+\b/g, '[redacted-token]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted-token]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\/Users\/[^/\s]+/g, '/Users/[redacted-user]')
    .replace(/\/home\/[^/\s]+/g, '/home/[redacted-user]')
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\[redacted-user]');
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : PATCH_STUDIO_DIAGNOSTICS_MAX_MESSAGE;
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`;
}

export function redactSourceEchoes(value, source) {
  let text = String(value ?? '');
  const lines = [...new Set(String(source ?? '').split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 8))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 200);
  for (const line of lines) text = text.split(line).join('[redacted-source]');
  return text;
}

export function normalizeStudioDiagnosticError(error, type = 'studio', source = '') {
  if (!error) return null;
  const item = typeof error === 'object' ? error : { message: String(error) };
  return {
    type: redactDiagnosticText(type, 80),
    name: redactDiagnosticText(item.name ?? 'Error', 80),
    code: item.code === undefined || item.code === null ? null : redactDiagnosticText(item.code, 120),
    message: redactDiagnosticText(redactSourceEchoes(item.message ?? item, source), PATCH_STUDIO_DIAGNOSTICS_MAX_MESSAGE)
  };
}

export function normalizeRecentStudioErrors(errors, source = '') {
  const out = [];
  for (const item of Array.isArray(errors) ? errors.slice(-PATCH_STUDIO_DIAGNOSTICS_MAX_ERRORS) : []) {
    const error = normalizeStudioDiagnosticError(item?.error ?? item?.message ?? item, item?.type ?? 'studio', source);
    if (!error) continue;
    out.push({
      time: normalizeTime(item?.time),
      ...error
    });
  }
  return out;
}

export async function buildStudioDiagnosticReport(input = {}) {
  const source = String(input.source ?? '');
  const sourceBytes = encoder.encode(source).length;
  const sourceSha256 = await sha256Text(source);
  const compilerError = normalizeStudioDiagnosticError(input.compilerError, 'compiler', source);
  const environment = input.environment ?? {};

  return {
    format: PATCH_STUDIO_DIAGNOSTICS_FORMAT,
    version: PATCH_STUDIO_DIAGNOSTICS_VERSION,
    generatedAt: normalizeTime(input.generatedAt ?? new Date()),
    patchVersion: redactDiagnosticText(input.patchVersion ?? 'unknown', 80),
    project: {
      kind: input.projectKind === 'window' ? 'window' : 'console',
      sourceBytes,
      sourceSha256: sourceSha256 ?? 'unavailable'
    },
    build: {
      target: redactDiagnosticText(input.buildTarget ?? 'unknown', 120)
    },
    compiler: {
      status: compilerError ? 'error' : 'ok',
      error: compilerError
    },
    environment: {
      userAgent: redactDiagnosticText(environment.userAgent ?? 'unknown', 500),
      language: redactDiagnosticText(environment.language ?? 'unknown', 80),
      online: Boolean(environment.online),
      standalone: Boolean(environment.standalone),
      serviceWorkerControlled: Boolean(environment.serviceWorkerControlled)
    },
    recentErrors: normalizeRecentStudioErrors(input.recentErrors, source),
    privacy: {
      sourceIncluded: false,
      uploaded: false,
      secretsRedacted: true,
      sourceEchoesRedacted: true
    }
  };
}

export function serializeStudioDiagnosticReport(report) {
  validateStudioDiagnosticReport(report);
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatStudioDiagnosticReport(report) {
  validateStudioDiagnosticReport(report);
  const lines = [
    `Patch Studio diagnostics ${report.patchVersion}`,
    `Generated: ${report.generatedAt}`,
    `Project: ${report.project.kind}, ${report.project.sourceBytes} source bytes`,
    `Source SHA-256: ${report.project.sourceSha256}`,
    `Build target: ${report.build.target}`,
    `Compiler: ${report.compiler.status}`,
    `Browser: ${report.environment.userAgent}`,
    `Language: ${report.environment.language}`,
    `Online: ${report.environment.online ? 'yes' : 'no'}`,
    `Standalone PWA: ${report.environment.standalone ? 'yes' : 'no'}`,
    `Service worker controlled: ${report.environment.serviceWorkerControlled ? 'yes' : 'no'}`
  ];
  if (report.compiler.error) lines.push(`Compiler error: ${report.compiler.error.message}`);
  if (report.recentErrors.length) {
    lines.push('', 'Recent Studio errors:');
    for (const error of report.recentErrors) lines.push(`- ${error.time} [${error.type}] ${error.message}`);
  }
  lines.push('', 'Privacy: source omitted, source echoes and secrets redacted, nothing uploaded.');
  return lines.join('\n');
}

export function validateStudioDiagnosticReport(report) {
  if (!report || report.format !== PATCH_STUDIO_DIAGNOSTICS_FORMAT || report.version !== PATCH_STUDIO_DIAGNOSTICS_VERSION) {
    throw new Error('Patch Studio diagnostics format/version is unsupported.');
  }
  if (!report.project || typeof report.project.sourceBytes !== 'number' || typeof report.project.sourceSha256 !== 'string') {
    throw new Error('Patch Studio diagnostics project summary is incomplete.');
  }
  if (!report.compiler || !['ok', 'error'].includes(report.compiler.status)) {
    throw new Error('Patch Studio diagnostics compiler summary is incomplete.');
  }
  if (!Array.isArray(report.recentErrors)) throw new Error('Patch Studio diagnostics recent error list is invalid.');
  if (report.privacy?.sourceIncluded !== false || report.privacy?.uploaded !== false) {
    throw new Error('Patch Studio diagnostics privacy contract is invalid.');
  }
  return report;
}

function normalizeTime(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

export const PATCH_CLI_RESULT_FORMAT = 'patch-cli-result';
export const PATCH_CLI_RESULT_VERSION = 1;

export const PATCH_CLI_EXIT = Object.freeze({
  OK: 0,
  USAGE: 1,
  FAILURE: 2
});

export function createCliResult({ command, ok, exitCode, entry = null, data = null, diagnostic = null }) {
  const result = {
    format: PATCH_CLI_RESULT_FORMAT,
    version: PATCH_CLI_RESULT_VERSION,
    command: String(command ?? ''),
    ok: Boolean(ok),
    exitCode: Number(exitCode),
    entry: entry === null ? null : String(entry),
    data: data ?? null,
    diagnostic: diagnostic ?? null
  };
  return validateCliResult(result);
}

export function validateCliResult(result) {
  if (!result || result.format !== PATCH_CLI_RESULT_FORMAT || result.version !== PATCH_CLI_RESULT_VERSION) {
    throw new Error('Patch CLI result format/version is unsupported.');
  }
  if (typeof result.command !== 'string' || !result.command) throw new Error('Patch CLI result command is invalid.');
  if (typeof result.ok !== 'boolean') throw new Error('Patch CLI result ok flag is invalid.');
  if (![PATCH_CLI_EXIT.OK, PATCH_CLI_EXIT.USAGE, PATCH_CLI_EXIT.FAILURE].includes(result.exitCode)) {
    throw new Error('Patch CLI result exit code is invalid.');
  }
  if (result.ok !== (result.exitCode === PATCH_CLI_EXIT.OK)) throw new Error('Patch CLI result status/exit code disagree.');
  if (result.entry !== null && (typeof result.entry !== 'string' || !result.entry)) throw new Error('Patch CLI result entry is invalid.');
  if (result.diagnostic !== null && (!result.diagnostic || result.diagnostic.format !== 'patch-diagnostic')) {
    throw new Error('Patch CLI result diagnostic is invalid.');
  }
  return result;
}

export class MenuShortcutError extends Error {}

const KEY_RE = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/;

/** Parse a quoted Patch shortcut expression such as "Primary+Shift+S". */
export function parseMenuShortcutExpression(expr, line = null) {
  if (expr === null || expr === undefined) return null;
  const source = String(expr).trim();
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw shortcutError(line, 'Menu shortcut must be quoted text, for example shortcut "Primary+S".');
  }
  if (typeof value !== 'string') {
    throw shortcutError(line, 'Menu shortcut must be quoted text, for example shortcut "Primary+S".');
  }
  return parseMenuShortcut(value, line);
}

/**
 * Parse a portable menu shortcut.
 *
 * Primary maps to Control on Windows/Linux and Command on macOS. Stage 1 keys
 * are A-Z, 0-9 and F1-F12. Shift and Alt are optional portable modifiers.
 */
export function parseMenuShortcut(value, line = null) {
  const raw = String(value ?? '').trim();
  if (!raw) throw shortcutError(line, 'Menu shortcut cannot be empty.');

  const parts = raw.split('+').map(part => part.trim()).filter(Boolean);
  if (!parts.length) throw shortcutError(line, 'Menu shortcut cannot be empty.');

  let primary = false;
  let shift = false;
  let alt = false;
  let key = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'primary') {
      if (primary) throw shortcutError(line, "Menu shortcut repeats the 'Primary' modifier.");
      primary = true;
      continue;
    }
    if (lower === 'shift') {
      if (shift) throw shortcutError(line, "Menu shortcut repeats the 'Shift' modifier.");
      shift = true;
      continue;
    }
    if (lower === 'alt') {
      if (alt) throw shortcutError(line, "Menu shortcut repeats the 'Alt' modifier.");
      alt = true;
      continue;
    }

    const candidate = part.toUpperCase();
    if (!KEY_RE.test(candidate)) {
      throw shortcutError(
        line,
        `Unsupported menu shortcut part '${part}'. Use Primary, Shift, Alt and one A-Z, 0-9 or F1-F12 key.`
      );
    }
    if (key !== null) throw shortcutError(line, 'Menu shortcut must contain exactly one key.');
    key = candidate;
  }

  if (key === null) throw shortcutError(line, 'Menu shortcut must contain one A-Z, 0-9 or F1-F12 key.');
  const shortcut = { primary, shift, alt, key };
  return { ...shortcut, display: menuShortcutIdentity(shortcut) };
}

export function menuShortcutIdentity(shortcut) {
  if (!shortcut) return '';
  const parts = [];
  if (shortcut.primary) parts.push('Primary');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(String(shortcut.key ?? '').toUpperCase());
  return parts.join('+');
}

export function menuShortcutPlatformDisplay(shortcut, platform) {
  if (!shortcut) return '';
  const parts = [];
  if (shortcut.primary) parts.push(platform === 'appkit' ? 'Command' : 'Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push(platform === 'appkit' ? 'Option' : 'Alt');
  parts.push(shortcut.key);
  return parts.join('+');
}

function shortcutError(line, message) {
  return new MenuShortcutError(`${line === null || line === undefined ? '' : `line ${line}: `}${message}`);
}

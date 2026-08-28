import {
  PATCH_PICTURE_DISPLAY_DEFAULTS,
  formatPictureNumber,
  isDefaultPatchPictureDisplay,
  normalizePatchPictureDisplay
} from './picture-control.js';

export const PATCH_PICTURE_SOURCE_VERSION = '0.1';

const PATCH_NAME = /^[A-Za-z_]\w*$/;
const PROPERTY_NAMES = new Set(['fit', 'center', 'opacity', 'description']);

export class PatchPictureSourceError extends Error {
  constructor(message, code = 'PICTURE_SOURCE_INVALID') {
    super(message);
    this.name = 'PatchPictureSourceError';
    this.code = code;
  }
}

/**
 * Parse the core Picture declaration, before an optional Designer `at ... size ...`
 * suffix is handled by the shared Window layout parser.
 *
 * Canonical syntax:
 * picture as logo from "images/hero.png" fit contain center true opacity 1 description "Hero"
 *
 * `from` and display properties are optional. Formatting omits canonical defaults
 * so existing `picture as picture_1 at ...` source stays stable. Legacy
 * `picture "Caption" as id` remains a caption-only form.
 */
export function parsePatchPictureDeclaration(value) {
  const source = String(value ?? '').trim();
  const canonical = source.match(/^picture\s+as\s+([A-Za-z_]\w*)(?:\s+(.*))?$/i);
  if (canonical) {
    return freezePicture({
      id: canonical[1],
      ...parseCanonicalRest(canonical[2] ?? ''),
      legacyCaption: false
    });
  }

  const legacy = source.match(/^picture\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/i);
  if (!legacy) {
    throw new PatchPictureSourceError(
      "Picture syntax is 'picture as <name> [from <source>] [fit …] [center …] [opacity …] [description \"…\"]' or the legacy caption form 'picture \"Caption\" as <name>'.",
      'PICTURE_SOURCE_SYNTAX'
    );
  }

  const textExpr = String(legacy[1]).trim();
  if (!textExpr) {
    throw new PatchPictureSourceError('Legacy Picture caption cannot be empty.', 'PICTURE_SOURCE_CAPTION');
  }
  return freezePicture({
    id: legacy[2],
    sourceExpr: null,
    textExpr,
    description: quotedPlainText(textExpr) ?? '',
    legacyCaption: true
  });
}

export function formatPatchPictureDeclaration(input = {}) {
  const id = String(input.id ?? '').trim();
  if (!PATCH_NAME.test(id)) {
    throw new PatchPictureSourceError(`'${id || '?'}' is not a valid Patch Picture name.`, 'PICTURE_SOURCE_ID');
  }

  let display;
  try {
    display = normalizePatchPictureDisplay(input);
  } catch (error) {
    throw new PatchPictureSourceError(error?.message ?? String(error), error?.code ?? 'PICTURE_SOURCE_STYLE');
  }

  const sourceExpr = trimOrNull(input.sourceExpr);
  const textExpr = trimOrNull(input.textExpr);
  const legacyCaption = input.legacyCaption === true && !sourceExpr && isDefaultPatchPictureDisplay(display);
  if (legacyCaption && textExpr) {
    return `picture ${textExpr} as ${id}`;
  }

  const parts = ['picture', 'as', id];
  if (sourceExpr) parts.push('from', sourceExpr);
  if (display.fit !== PATCH_PICTURE_DISPLAY_DEFAULTS.fit) parts.push('fit', display.fit);
  if (display.center !== PATCH_PICTURE_DISPLAY_DEFAULTS.center) parts.push('center', 'false');
  if (display.opacity !== PATCH_PICTURE_DISPLAY_DEFAULTS.opacity) parts.push('opacity', formatPictureNumber(display.opacity));
  if (display.description) parts.push('description', JSON.stringify(display.description));
  return parts.join(' ');
}

export function updatePatchPictureDeclaration(source, changes = {}) {
  const current = parsePatchPictureDeclaration(source);
  const next = { ...current, ...changes };
  if (Object.hasOwn(changes, 'sourceExpr')) {
    next.sourceExpr = trimOrNull(changes.sourceExpr);
    if (next.sourceExpr) next.legacyCaption = false;
  }
  if (Object.hasOwn(changes, 'description')) {
    next.description = changes.description;
    next.legacyCaption = false;
  }
  if (['fit', 'center', 'opacity'].some(key => Object.hasOwn(changes, key))) {
    next.legacyCaption = false;
  }
  return formatPatchPictureDeclaration(next);
}

function parseCanonicalRest(rest) {
  const values = {
    sourceExpr: null,
    textExpr: null,
    description: PATCH_PICTURE_DISPLAY_DEFAULTS.description
  };
  const tokens = tokenize(rest);
  let index = 0;
  if (tokens[index]?.toLowerCase() === 'from') {
    index += 1;
    const sourceTokens = [];
    while (index < tokens.length && !PROPERTY_NAMES.has(tokens[index].toLowerCase())) {
      sourceTokens.push(tokens[index]);
      index += 1;
    }
    if (!sourceTokens.length) {
      throw new PatchPictureSourceError("Picture 'from' needs a source expression.", 'PICTURE_SOURCE_VALUE');
    }
    values.sourceExpr = sourceTokens.join(' ');
  }

  const seen = new Set();
  const raw = {};
  while (index < tokens.length) {
    const property = tokens[index].toLowerCase();
    if (!PROPERTY_NAMES.has(property)) {
      throw new PatchPictureSourceError(`Unknown Picture property '${tokens[index]}'.`, 'PICTURE_SOURCE_PROPERTY');
    }
    if (seen.has(property)) {
      throw new PatchPictureSourceError(`Picture property '${property}' appears more than once.`, 'PICTURE_SOURCE_DUPLICATE_PROPERTY');
    }
    seen.add(property);
    index += 1;
    if (index >= tokens.length) {
      throw new PatchPictureSourceError(`Picture property '${property}' needs a value.`, 'PICTURE_SOURCE_VALUE');
    }
    const token = tokens[index++];
    if (property === 'description') {
      const description = quotedPlainText(token);
      if (description === null) {
        throw new PatchPictureSourceError('Picture description must be quoted text.', 'PICTURE_SOURCE_DESCRIPTION');
      }
      values.description = description;
    } else if (property === 'fit') {
      raw.fit = token;
    } else if (property === 'center') {
      raw.center = token;
    } else if (property === 'opacity') {
      raw.opacity = numberValue(token, 'opacity');
    }
  }

  let display;
  try {
    display = normalizePatchPictureDisplay({ ...raw, description: values.description });
  } catch (error) {
    throw new PatchPictureSourceError(error?.message ?? String(error), error?.code ?? 'PICTURE_SOURCE_STYLE');
  }
  if (display.description) values.textExpr = JSON.stringify(display.description);
  return { ...values, ...display };
}

function freezePicture(input) {
  let display;
  try {
    display = normalizePatchPictureDisplay(input);
  } catch (error) {
    throw new PatchPictureSourceError(error?.message ?? String(error), error?.code ?? 'PICTURE_SOURCE_STYLE');
  }
  const textExpr = trimOrNull(input.textExpr) ?? (display.description ? JSON.stringify(display.description) : null);
  return Object.freeze({
    id: input.id,
    sourceExpr: trimOrNull(input.sourceExpr),
    textExpr,
    legacyCaption: input.legacyCaption === true,
    ...display
  });
}

function tokenize(value) {
  const source = String(value ?? '').trim();
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) break;
    if (source[index] === '"') {
      const parsed = readQuotedToken(source, index);
      tokens.push(parsed.token);
      index = parsed.next;
      continue;
    }
    const start = index;
    while (index < source.length && !/\s/.test(source[index])) index += 1;
    tokens.push(source.slice(start, index));
  }
  return tokens;
}

function readQuotedToken(source, start) {
  let index = start + 1;
  let escaped = false;
  while (index < source.length) {
    const ch = source[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      index += 1;
      continue;
    }
    if (ch === '"') {
      const token = source.slice(start, index + 1);
      try {
        if (typeof JSON.parse(token) !== 'string') throw new Error('not text');
      } catch {
        throw new PatchPictureSourceError('Picture quoted text is not valid.', 'PICTURE_SOURCE_QUOTE');
      }
      return { token, next: index + 1 };
    }
    index += 1;
  }
  throw new PatchPictureSourceError('Picture quoted text is not closed.', 'PICTURE_SOURCE_QUOTE');
}

function quotedPlainText(value) {
  const text = String(value ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) return null;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function numberValue(value, property) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new PatchPictureSourceError(`Picture ${property} must be a finite number.`, 'PICTURE_SOURCE_NUMBER');
  }
  return number;
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

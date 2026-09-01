export const PATCH_WINDOW_ICON_VERSION = '1.0';
export const PATCH_WINDOW_ICON_POLICY_ID = 'window-icon/1.0';
export const PATCH_WINDOW_ICON_RESOURCE_PREFIX = 'patch-resource:';

const PATCH_NAME = /^[A-Za-z_]\w*$/;
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const QUOTED = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')$/;

export class PatchWindowIconError extends Error {
  constructor(message, code = 'WINDOW_ICON_INVALID') {
    super(message);
    this.name = 'PatchWindowIconError';
    this.code = code;
    this.policy = PATCH_WINDOW_ICON_POLICY_ID;
  }
}

/**
 * Window / application icon source contract 1.0.
 *
 * Canonical source:
 * window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
 *
 * Studio and Standalone Web package the icon as a Form chrome image and as the
 * application favicon (first Form that declares icon). Current Ready Native GUI
 * IR 1.9 / payload v19 / runtime v1.10 transports project-backed PNG/JPEG Form
 * and application icons through the versioned desktop package path. This source
 * policy module remains independent from the native IR implementation version.
 */
export const PATCH_WINDOW_ICON_POLICY = Object.freeze({
  id: PATCH_WINDOW_ICON_POLICY_ID,
  version: PATCH_WINDOW_ICON_VERSION,
  // Retained compatibility metadata from the source-policy introduction. These
  // fields are not the Current Ready native boundary; currentReady below is.
  nativeGuiIR: '1.4',
  payload: 14,
  runtime: '1.5',
  introducedAgainstNativeGuiIR: '1.4',
  currentReady: Object.freeze({ nativeGuiIR: '1.9', payload: 19, runtime: '1.10' }),
  native: 'current-ready',
  studioWeb: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  reason: 'Application/Form icons are Current Ready on Windows, macOS and Linux through Native GUI IR 1.9 / payload v19 / runtime v1.10. Older pre-v19 native compatibility contracts remain fail-closed rather than silently dropping icon metadata.'
});

export function parsePatchWindowDeclaration(value) {
  const source = String(value ?? '').trim().replace(/:\s*$/, '');
  if (!/^window\b/i.test(source)) {
    throw new PatchWindowIconError(
      'Window syntax is \'window "Title" [as <name>] [size width, height] [icon "patch-resource:app.icon"]\'.',
      'WINDOW_SOURCE_SYNTAX'
    );
  }

  let rest = source.replace(/^window\s+/i, '').trim();
  if (!rest) {
    throw new PatchWindowIconError('Window title expression cannot be empty.', 'WINDOW_SOURCE_TITLE');
  }

  let iconExpr = null;
  const iconTail = rest.match(/^(.*)\s+icon\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*$/i);
  if (iconTail) {
    rest = iconTail[1].trim();
    iconExpr = normalizeWindowIconExpression(iconTail[2]).sourceExpr;
  } else if (hasBareIconKeyword(rest)) {
    throw new PatchWindowIconError(
      'Window icon needs a quoted source such as "patch-resource:app.icon".',
      'WINDOW_ICON_VALUE'
    );
  }

  let width = null;
  let height = null;
  const sizeTail = rest.match(/^(.*)\s+size\s+(\d+)\s*,\s*(\d+)\s*$/i);
  if (sizeTail) {
    rest = sizeTail[1].trim();
    width = Number(sizeTail[2]);
    height = Number(sizeTail[3]);
  }

  let id = null;
  const asTail = rest.match(/^(.*)\s+as\s+([A-Za-z_]\w*)\s*$/i);
  if (asTail) {
    rest = asTail[1].trim();
    id = asTail[2];
  }

  const titleExpr = rest.trim();
  if (!titleExpr) {
    throw new PatchWindowIconError('Window title expression cannot be empty.', 'WINDOW_SOURCE_TITLE');
  }

  return freezeWindow({ titleExpr, id, width, height, iconExpr });
}

export function formatPatchWindowDeclaration(input = {}) {
  const parsed = freezeWindow(input);
  const parts = ['window', parsed.titleExpr];
  if (parsed.id) parts.push('as', parsed.id);
  if (parsed.width !== null && parsed.height !== null) parts.push('size', `${parsed.width}, ${parsed.height}`);
  if (parsed.iconExpr) parts.push('icon', parsed.iconExpr);
  return `${parts.join(' ')}:`;
}

export function normalizeWindowIconExpression(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return Object.freeze({ sourceExpr: null, locator: null, resourceId: null });
  }

  let locator;
  if (QUOTED.test(raw)) {
    try {
      locator = JSON.parse(raw[0] === "'" ? `"${raw.slice(1, -1).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` : raw);
    } catch {
      throw new PatchWindowIconError(
        'Window icon needs a quoted source such as "patch-resource:app.icon".',
        'WINDOW_ICON_VALUE'
      );
    }
  } else if (raw.startsWith(PATCH_WINDOW_ICON_RESOURCE_PREFIX) || !/\s/.test(raw)) {
    locator = raw;
  } else {
    throw new PatchWindowIconError(
      'Window icon needs a quoted source such as "patch-resource:app.icon".',
      'WINDOW_ICON_VALUE'
    );
  }

  if (typeof locator !== 'string' || !locator.trim()) {
    throw new PatchWindowIconError('Window icon source cannot be empty.', 'WINDOW_ICON_VALUE');
  }
  locator = locator.trim();

  let resourceId = null;
  if (locator.startsWith(PATCH_WINDOW_ICON_RESOURCE_PREFIX)) {
    resourceId = locator.slice(PATCH_WINDOW_ICON_RESOURCE_PREFIX.length);
    if (!RESOURCE_ID.test(resourceId)) {
      throw new PatchWindowIconError(
        `Window icon resource id '${resourceId || '?'}' is invalid.`,
        'WINDOW_ICON_RESOURCE'
      );
    }
    locator = `${PATCH_WINDOW_ICON_RESOURCE_PREFIX}${resourceId}`;
  }

  return Object.freeze({
    sourceExpr: JSON.stringify(locator),
    locator,
    resourceId
  });
}

export function windowIconResourceId(iconExpr) {
  return normalizeWindowIconExpression(iconExpr || '').resourceId;
}

export function collectWindowIcons(nodes) {
  return (nodes ?? []).filter(node => node?.kind === 'window' && node.iconExpr);
}

export function selectApplicationWindowIcon(nodes) {
  const windowNode = collectWindowIcons(nodes)[0] ?? null;
  if (!windowNode) return null;
  const normalized = normalizeWindowIconExpression(windowNode.iconExpr);
  return Object.freeze({
    windowId: windowNode.id ?? null,
    line: windowNode.line ?? null,
    iconExpr: normalized.sourceExpr,
    locator: normalized.locator,
    resourceId: normalized.resourceId
  });
}

/**
 * Compatibility diagnostic used by native contracts that predate payload v19.
 * Current Ready IR 1.9 consumes Window icons and must not call this helper.
 */
export function nativeWindowIconUnsupportedMessage(node, line = null) {
  if (!node?.iconExpr) return null;
  const where = line == null ? 'legacy native GUI Form' : `line ${line}: legacy native GUI Form`;
  const name = node.id ? `'${node.id}'` : 'window';
  return `${where} ${name} does not transport icon ${node.iconExpr}. This compatibility contract remains fail-closed; use Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 for desktop application/Form icon transport.`;
}

export function hasWindowIcon(node) {
  return Boolean(node?.iconExpr);
}

function stripQuoted(text) {
  return String(text ?? '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
}

function hasBareIconKeyword(text) {
  return /\sicon(?:\s|$)/i.test(stripQuoted(text));
}

function freezeWindow(input) {
  const titleExpr = String(input.titleExpr ?? '').trim();
  if (!titleExpr) {
    throw new PatchWindowIconError('Window title expression cannot be empty.', 'WINDOW_SOURCE_TITLE');
  }

  let id = null;
  if (input.id !== undefined && input.id !== null && String(input.id).trim()) {
    id = String(input.id).trim();
    if (!PATCH_NAME.test(id)) {
      throw new PatchWindowIconError(`'${id}' is not a valid Patch Form name.`, 'WINDOW_SOURCE_ID');
    }
  }

  let width = null;
  let height = null;
  const hasWidth = input.width !== undefined && input.width !== null && String(input.width).trim() !== '';
  const hasHeight = input.height !== undefined && input.height !== null && String(input.height).trim() !== '';
  if (hasWidth !== hasHeight) {
    throw new PatchWindowIconError('Window size needs both width and height.', 'WINDOW_SOURCE_SIZE');
  }
  if (hasWidth) {
    width = Number(input.width);
    height = Number(input.height);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new PatchWindowIconError('Window size must use whole numbers.', 'WINDOW_SOURCE_SIZE');
    }
  }

  let iconExpr = null;
  const rawIcon = input.iconExpr ?? input.icon ?? null;
  if (rawIcon !== undefined && rawIcon !== null && String(rawIcon).trim()) {
    iconExpr = normalizeWindowIconExpression(rawIcon).sourceExpr;
  }

  return Object.freeze({ titleExpr, id, width, height, iconExpr });
}

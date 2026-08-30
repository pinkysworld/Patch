export const PATCH_PICTURE_DISPLAY_VERSION = '0.1';
export const PATCH_PICTURE_FIT_MODES = Object.freeze(['contain', 'cover', 'fill', 'none']);

export const PATCH_PICTURE_DISPLAY_DEFAULTS = Object.freeze({
  fit: 'contain',
  center: true,
  opacity: 1,
  description: ''
});

const FITS = new Set(PATCH_PICTURE_FIT_MODES);

export class PatchPictureError extends Error {
  constructor(message, code = 'PICTURE_INVALID') {
    super(message);
    this.name = 'PatchPictureError';
    this.code = code;
  }
}

export function normalizePatchPictureFit(value) {
  const fit = String(value ?? PATCH_PICTURE_DISPLAY_DEFAULTS.fit).trim().toLowerCase();
  if (!FITS.has(fit)) {
    throw new PatchPictureError(
      `Picture fit must be contain, cover, fill or none, not '${fit || '?'}'.`,
      'PICTURE_FIT'
    );
  }
  return fit;
}

export function normalizePatchPictureCenter(value) {
  if (value === undefined || value === null || value === '') return PATCH_PICTURE_DISPLAY_DEFAULTS.center;
  if (value === true || value === false) return value;
  const token = String(value).trim().toLowerCase();
  if (token === 'true') return true;
  if (token === 'false') return false;
  throw new PatchPictureError(`Picture center must be true or false, not '${token}'.`, 'PICTURE_CENTER');
}

export function normalizePatchPictureOpacity(value) {
  const opacity = value === undefined || value === null || value === ''
    ? PATCH_PICTURE_DISPLAY_DEFAULTS.opacity
    : Number(value);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new PatchPictureError('Picture opacity must be a finite number from 0 to 1.', 'PICTURE_OPACITY');
  }
  return opacity;
}

export function normalizePatchPictureDescription(value) {
  if (value === undefined || value === null) return PATCH_PICTURE_DISPLAY_DEFAULTS.description;
  return String(value);
}

export function normalizePatchPictureDisplay(input = {}) {
  const fit = normalizePatchPictureFit(input.fit);
  const center = normalizePatchPictureCenter(input.center);
  const opacity = normalizePatchPictureOpacity(input.opacity);
  const description = normalizePatchPictureDescription(input.description);
  return Object.freeze({
    fit,
    center,
    opacity,
    description,
    proportional: fit !== 'fill'
  });
}

export function isDefaultPatchPictureDisplay(input = {}) {
  const display = normalizePatchPictureDisplay(input);
  return display.fit === PATCH_PICTURE_DISPLAY_DEFAULTS.fit
    && display.center === PATCH_PICTURE_DISPLAY_DEFAULTS.center
    && display.opacity === PATCH_PICTURE_DISPLAY_DEFAULTS.opacity;
}

export function patchPictureCssStyle(input = {}) {
  const display = normalizePatchPictureDisplay(input);
  return Object.freeze({
    objectFit: display.fit,
    objectPosition: display.center ? '50% 50%' : '0% 0%',
    opacity: String(display.opacity)
  });
}

export function nativePictureDisplayUnsupportedMessage(input = {}, line = null) {
  const display = normalizePatchPictureDisplay(input);
  const extras = [];
  if (display.fit !== PATCH_PICTURE_DISPLAY_DEFAULTS.fit) extras.push(`fit ${display.fit}`);
  if (display.center !== PATCH_PICTURE_DISPLAY_DEFAULTS.center) extras.push('center false');
  if (display.opacity !== PATCH_PICTURE_DISPLAY_DEFAULTS.opacity) extras.push(`opacity ${formatPictureNumber(display.opacity)}`);
  if (!extras.length) return null;
  const where = line == null ? 'native GUI 1.4 PictureBox' : `line ${line}: native GUI 1.4 PictureBox`;
  return `${where} does not transport ${extras.join(', ')}. Use default contain/centered/opaque PictureBox, or a Web target.`;
}

export function applyPatchPictureProportional(fit, proportional) {
  const current = normalizePatchPictureFit(fit);
  if (proportional === false || proportional === 'false') return 'fill';
  if (proportional === true || proportional === 'true') return current === 'fill' ? 'contain' : current;
  throw new PatchPictureError('Picture proportional must be true or false.', 'PICTURE_PROPORTIONAL');
}

export function formatPictureNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new PatchPictureError('Picture numeric property is not finite.', 'PICTURE_NUMBER');
  }
  return String(number);
}

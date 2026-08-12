export const PATCH_NATIVE_ACCESSIBILITY_VERSION = '0.1';

const EXPLICIT_NAME_TYPES = new Set(['input', 'combo', 'listbox', 'tabs', 'radio']);

export function needsExplicitNativeAccessibleName(control) {
  return EXPLICIT_NAME_TYPES.has(String(control?.type ?? ''));
}

export function nativeAccessibleName(control) {
  const visible = String(control?.text ?? '').trim();
  if (visible && !/[{}]/.test(visible)) return visible;
  const identifier = String(control?.id ?? control?.binding ?? '').trim();
  return humanizeNativeIdentifier(identifier);
}

export function nativeRadioItemAccessibleName(control, option) {
  const group = nativeAccessibleName(control);
  const item = String(option ?? '').trim();
  if (group && item) return `${group}: ${item}`;
  return item || group;
}

export function humanizeNativeIdentifier(value) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  const words = source
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

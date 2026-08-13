import { buildNativeGuiIR, validateNativeGuiIR } from './native-gui-ir.js';
import { PATCH_WINDOW_LAYOUT_POLICY_VERSION, validateWindowLayoutPolicyManifest } from './window-layout-policy.js';

export const PATCH_NATIVE_RESPONSIVE_LAYOUT_EXTENSION = 'patch-native-responsive-layout';
export const PATCH_NATIVE_RESPONSIVE_LAYOUT_VERSION = '0.1';

export function buildResponsiveNativeGuiIR(compiled) {
  const ir = buildNativeGuiIR(compiled);
  const manifest = validateWindowLayoutPolicyManifest(compiled?.windowLayoutPolicy ?? {
    format: 'patch-window-layout-policy',
    version: PATCH_WINDOW_LAYOUT_POLICY_VERSION,
    windows: ir.forms.map(form => ({ width: form.width, height: form.height, controls: form.controls.map(() => ({ policy: { kind: 'fixed' } })) }))
  });
  if (manifest.windows.length !== ir.forms.length) throw new Error('Native responsive layout Form count does not match Native GUI IR.');

  const forms = ir.forms.map((form, formIndex) => {
    const policyForm = manifest.windows[formIndex];
    if ((policyForm?.controls?.length ?? 0) !== form.controls.length) {
      throw new Error(`Native responsive layout control count does not match Form ${formIndex + 1}.`);
    }
    return {
      ...form,
      controls: form.controls.map((control, controlIndex) => ({
        ...control,
        layoutPolicy: policyForm.controls[controlIndex]?.policy ?? { kind: 'fixed' }
      }))
    };
  });

  const extended = {
    ...ir,
    forms,
    extensions: {
      ...(ir.extensions ?? {}),
      responsiveLayout: {
        format: PATCH_NATIVE_RESPONSIVE_LAYOUT_EXTENSION,
        version: PATCH_NATIVE_RESPONSIVE_LAYOUT_VERSION,
        policyVersion: PATCH_WINDOW_LAYOUT_POLICY_VERSION
      }
    }
  };
  validateNativeGuiIR(extended);
  return extended;
}

export function validateResponsiveNativeGuiIR(ir) {
  validateNativeGuiIR(ir);
  const extension = ir?.extensions?.responsiveLayout;
  if (!extension) return ir;
  if (extension.format !== PATCH_NATIVE_RESPONSIVE_LAYOUT_EXTENSION || extension.version !== PATCH_NATIVE_RESPONSIVE_LAYOUT_VERSION || extension.policyVersion !== PATCH_WINDOW_LAYOUT_POLICY_VERSION) {
    throw new Error('Native responsive layout extension format/version is unsupported.');
  }
  for (const form of ir.forms) {
    for (const control of form.controls ?? []) validatePolicy(control.layoutPolicy);
  }
  return ir;
}

export function hasResponsiveNativeLayout(ir) {
  validateResponsiveNativeGuiIR(ir);
  return (ir.forms ?? []).some(form => (form.controls ?? []).some(control => control.layoutPolicy?.kind && control.layoutPolicy.kind !== 'fixed'));
}

function validatePolicy(policy) {
  if (!policy || policy.kind === 'fixed') return;
  if (policy.kind === 'dock' && ['left', 'right', 'top', 'bottom', 'fill'].includes(policy.side)) return;
  if (policy.kind === 'anchor' && Array.isArray(policy.edges) && policy.edges.length && policy.edges.every(edge => ['left', 'right', 'top', 'bottom'].includes(edge))) return;
  throw new Error('Native responsive layout policy is invalid.');
}

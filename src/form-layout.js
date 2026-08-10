export const PATCH_FORM_LAYOUT_VERSION = '0.1';

const CONTROL_DEFAULTS = {
  text: { width: 200, height: 30 },
  button: { width: 120, height: 36 },
  input: { width: 220, height: 36 },
  checkbox: { width: 220, height: 36 },
  combo: { width: 220, height: 36 }
};

export function buildFormLayoutManifest(ast) {
  return {
    format: 'patch-source-backed-form-layout',
    version: PATCH_FORM_LAYOUT_VERSION,
    windows: (ast ?? []).filter(node => node.kind === 'window').map(node => {
      const controls = (node.body ?? []).filter(child => child.kind === 'uiControl');
      const positioned = node.width !== undefined || node.height !== undefined || controls.some(child => child.layout);
      return {
        width: node.width ?? null,
        height: node.height ?? null,
        controls: controls.map((child, index) => positioned ? effectiveControlLayout(child, index) : null)
      };
    })
  };
}

export function applyFormLayout(root, manifest, options = {}) {
  if (!root || !manifest?.windows) return;
  const windowSelector = options.windowSelector ?? '.window';
  const bodySelector = options.bodySelector ?? '.body';
  const shells = [...root.querySelectorAll(windowSelector)];

  manifest.windows.forEach((form, index) => {
    const shell = shells[index];
    if (!shell) return;
    const body = shell.querySelector(bodySelector);
    if (!body) return;
    if (form.width) {
      shell.style.width = `${form.width}px`;
      shell.style.maxWidth = '100%';
    }
    if (form.height) body.style.minHeight = `${form.height}px`;
    if (!form.controls.some(Boolean)) return;

    body.style.position = 'relative';
    body.style.display = 'block';
    body.style.padding = '0';
    body.style.overflow = 'hidden';
    const elements = [...body.children];
    form.controls.forEach((layout, controlIndex) => {
      if (!layout) return;
      const el = elements[controlIndex];
      if (!el) return;
      el.style.position = 'absolute';
      el.style.left = `${layout.x}px`;
      el.style.top = `${layout.y}px`;
      el.style.width = `${layout.width}px`;
      el.style.height = `${layout.height}px`;
      el.style.maxWidth = 'none';
      el.style.margin = '0';
    });
  });
}

function effectiveControlLayout(control, index) {
  const defaults = CONTROL_DEFAULTS[control.control] ?? { width: 120, height: 36 };
  return {
    x: control.layout?.x ?? 24,
    y: control.layout?.y ?? (24 + index * 48),
    width: control.layout?.width ?? defaults.width,
    height: control.layout?.height ?? defaults.height
  };
}

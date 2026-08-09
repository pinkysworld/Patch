export const PATCH_FORM_LAYOUT_VERSION = '0.1';

export function buildFormLayoutManifest(ast) {
  return {
    format: 'patch-source-backed-form-layout',
    version: PATCH_FORM_LAYOUT_VERSION,
    windows: (ast ?? []).filter(node => node.kind === 'window').map(node => ({
      width: node.width ?? null,
      height: node.height ?? null,
      controls: (node.body ?? []).filter(child => child.kind === 'uiControl').map(child => child.layout ?? null)
    }))
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
      if (layout.width !== null) el.style.width = `${layout.width}px`;
      if (layout.height !== null) el.style.height = `${layout.height}px`;
      el.style.maxWidth = 'none';
      el.style.margin = '0';
    });
  });
}

# Window and application icons

`window-icon/1.0` is the versioned application/window icon contract. It is **not** a Native GUI IR, payload or runtime bump. Native GUI IR 1.4 / payload v14 / runtime v1.5 Forms still carry title, size and controls only.

`src/window-icon.js` is the authoritative module.

## Canonical source

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
  text "Count: {count}"
```

`icon` is optional. Formatting omits it when unset, so existing `window "Title" as main size 640, 420:` source stays stable. The expression is a quoted source. Project resources use `patch-resource:<id>` locators from the v4 resource store.

The first Form that declares `icon` is the application icon for Standalone Web / favicon packaging. Later Forms may declare their own chrome icons.

## Surfaces

| Surface | Behavior |
|---|---|
| Patch source / Designer / Object Inspector Form tools | optional `icon` on the window line |
| Studio preview | Form chrome shows the icon |
| Standalone Web | Form chrome plus document favicon from the first Form icon |
| Native GUI IR 1.4 | fail-closed; no Form icon field |

Studio and Web keep the current project-v4 image inventory: PNG, JPEG, WebP and SVG. This slice does not add ICO/ICNS to the Resource Manager and does not claim Win32 `.ico`, AppKit or Linux desktop packaging.

## Why this is not an IR bump

Native GUI IR 1.4 has no Form icon field. Packaging Windows `.ico`, macOS app icons and Linux desktop icons would change Win32, AppKit and GTK together. A later native expansion must:

1. version a native Form icon field or a later native IR;
2. add Win32, AppKit and GTK packaging coverage together;
3. keep source-backed `icon` and Web favicon behavior unless that inventory also changes;
4. regenerate docs, smokes and the public site/PWA graph.

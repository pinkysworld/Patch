# GPT / Grok handoff

Living briefing for ChatGPT, Grok and other coding agents working on [pinkysworld/Patch](https://github.com/pinkysworld/Patch). Update this file in the same change that alters product contracts, RAD status or the next recommended slice.

Last refreshed: **2026-08-28** by Grok on `grok/rad-paintbox-draw-image-r1`.

## What Patch is

Patch is a small **change-oriented** language plus **Patch Studio**, a source-backed RAD IDE. Persistent application state does not mutate invisibly. Ordinary post-creation mutation is a semantic `change`. There is no hidden `.frm` / `.dfm`. Designer operations rewrite ordinary `.patch` source or the explicit project-v4 resource store.

Public Studio: https://minh.systems/Patch/

## Current product contract

Do not silently widen or flatten these labels.

| Surface | Current |
|---|---|
| Package | `0.2.0-beta.36` |
| Change IR | `0.10` |
| Native GUI IR | `1.7` |
| Sealed payload | `v17` |
| Ready/offline runtime | `v1.8` (Windows, macOS, Linux; token-free) |
| Frozen TreeView line | Native GUI IR **1.2** / payload **v12** / runtime **v1.3** (Slider fail-closed) |
| Previous Slider line | Native GUI IR **1.3** / payload **v13** / runtime **v1.4** |
| Previous Chrome line | Native GUI IR **1.4** / payload **v14** / runtime **v1.5** |
| Previous Shape line | Native GUI IR **1.5** / payload **v15** / runtime **v1.6** |
| Previous PaintBox Stage 1 line | Native GUI IR **1.6** / payload **v16** / runtime **v1.7** |
| Studio project | multi-file/resource bundle **v4** |
| Component registry | **0.8** |
| Formal claim | **beta.32** invocation-frame-aware direct-Wasm correspondence for the finite safe-integer call-tree fragment. Studio/native/RAD work does **not** widen that claim. |
| Native Picture formats | **native-picture-formats/1.0** (Ready PNG/JPEG; deferred WebP/SVG). Not an IR bump. |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Older versioned modules are compatibility evidence, not current Ready.

## Collaboration

- GPT branches: `gpt/...`. Current RAD PR: [#268](https://github.com/pinkysworld/Patch/pull/268) `gpt/rad-imagelist-r1`.
- Grok branches: `grok/...` when the work is a separate slice. Current stacked PRs: [#269](https://github.com/pinkysworld/Patch/pull/269) Picture display, [#270](https://github.com/pinkysworld/Patch/pull/270) native Picture formats, [#271](https://github.com/pinkysworld/Patch/pull/271) Button ImageList consumer, [#272](https://github.com/pinkysworld/Patch/pull/272) Window/application icons, [#273](https://github.com/pinkysworld/Patch/pull/273) Shape native, [#276](https://github.com/pinkysworld/Patch/pull/276) PaintBox native. This slice stacks PaintBox `draw image` onto #276.
- Tracking issue: [#247](https://github.com/pinkysworld/Patch/issues/247) RAD R1.
- After every slice: tests, docs, public site copy, this file, and regenerate `docs/COMPONENT_CAPABILITY_MATRIX.md`.
- Do not merge stale planning PRs [#245](https://github.com/pinkysworld/Patch/pull/245) / [#246](https://github.com/pinkysworld/Patch/pull/246); the canonical plans now live in `docs/RAD_STUDIO_MASTERPLAN.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md`.

## Non-negotiable rules

1. Source is authoritative. No second persistent UI model, no Designer-only component graph, no `localStorage` application state.
2. UI toolkit interaction is transient until source commits it through `change`.
3. Unsupported targets **fail closed**. Authoring is not runtime support.
4. Do not bump Native GUI IR / payload / runtime unless the native C++/AppKit/GTK runtimes, sealers, smokes and docs all move together.
5. Do not claim PictureBox image loading beyond `native-picture-formats/1.0` (PNG/JPEG Ready). WebP/SVG remain deferred/fail-closed on native Picture sealing until a later versioned native contract expands Win32/AppKit/GTK together.
6. Panel Stage 1 is visual grouping, not Delphi-style native child containment.
7. Keep beginner syntax small. Sophistication stays in compiler/runtime.
8. Add a test for every semantic rule. Public site/PWA/offline asset closure must include new Studio modules.

## RAD R1 status

Completed:

- Component registry v0.8 with property/event/renderer/target metadata
- Resource Manager Stage 1 (logical ids, SHA-256, bounds, missing-resource rejection)
- Picture authoring + Web embed + bounded native PNG/JPEG
- Picture display properties: source-backed fit/center/opacity/description, Designer/Object Inspector, Web preview; native non-default fit/center/opacity fail closed
- Explicit native Picture format policy `native-picture-formats/1.0`: Studio/Web keep PNG/JPEG/WebP/SVG; native Ready PNG/JPEG; WebP/SVG deferred/fail-closed without an IR bump
- Shape Stage 1 authoring + Standalone Web + native lowering/runtime parity (IR 1.5 / payload v15 / runtime v1.6)
- PaintBox Stage 1 authoring + `paint` drawing + Standalone Web + native lowering/runtime parity (IR 1.6 / payload v16 / runtime v1.7)
- PaintBox `draw image` resource consumption: quoted `patch-resource:` / `data:` locators, native PNG/JPEG Ready, WebP/SVG fail-closed (IR 1.7 / payload v17 / runtime v1.8)
- ImageList Stage 1 authoring (nonvisual tray, resource-backed items)
- First ImageList consumer: Button `image list.item` on Studio/Web; native GUI still fail-closes ImageList and Button images
- Window/application icons: source-backed `icon` on the window line, Studio/Web favicon packaging under `window-icon/1.0`; native GUI still fail-closes
- Generated component capability matrix (`patch components`, `docs/COMPONENT_CAPABILITY_MATRIX.md`)

Remaining, in this order:

1. ImageList native runtime / Button images on native GUI
2. native application/window icon packaging for Win32 `.ico`, AppKit and Linux desktop

Do not bump Native GUI IR / payload / runtime for Window icons or Button images. Native `.ico` / AppKit / Linux desktop icon packaging waits until those backends move together.

## How to add a component

Follow an existing Stage 1 (Shape/PaintBox/ImageList) rather than inventing a second catalog.

Required coverage from issue #247:

1. parser if syntax changes
2. source serialization round-trip
3. Designer add/edit/delete
4. Object Inspector
5. browser preview
6. event behavior where applicable
7. accessibility
8. native lowering or an explicit fail-closed diagnostic
9–11. Windows/macOS/Linux runtime where advertised
12. docs/example
13. public site/offline asset closure

Then:

- add the descriptor to `src/component-registry.js`
- run `node scripts/generate-component-matrix.js`
- update `docs/GPT.md`, authoring surface, README/site copy if the user-visible inventory changed

## Useful commands

```bash
npm test
npm run check:project
npm run check:site
node scripts/generate-component-matrix.js --check
node src/cli-entry.js components
node src/cli-entry.js components --json
node src/cli-entry.js doctor --json
```

`patch components` prints the canonical registry/target matrix. Prefer that over scraping Designer HTML.

## File map

| Path | Role |
|---|---|
| `src/component-registry.js` | Canonical component metadata |
| `src/picture-control.js` | Picture display normalization, CSS and native fail-closed diagnostic |
| `src/picture-source.js` | Picture declaration codec |
| `src/button-image.js` | Button `image list.item` codec, Form-scoped resolve, native fail-closed diagnostic |
| `src/window-icon.js` | Window/application `icon` codec, Web favicon selection, native fail-closed diagnostic |
| `docs/WINDOW_ICONS.md` | `window-icon/1.0` policy |
| `src/component-matrix.js` | Generated matrix/JSON/CLI projection |
| `src/component-support.js` | Build-target support assessment |
| `src/native-current-contract.js` | Current IR 1.7 / v17 / v1.8 facade |
| `src/native-gui-ir-v17.js` | Native GUI IR 1.7 PaintBox `draw image` lowering |
| `src/sealed-native-gui-v17.js` | Payload v17 PaintBox image trailer (`PIMG`) |
| `src/native-gui-ir-v16.js` | Native GUI IR 1.6 PaintBox Stage 1 lowering |
| `src/sealed-native-gui-v16.js` | Payload v16 PaintBox trailer (`PPBX`) |
| `src/native-gui-ir-v15.js` | Native GUI IR 1.5 Shape lowering |
| `src/sealed-native-gui-v15.js` | Payload v15 Shape trailer (`PSHP`) |
| `src/native-picture-format-policy.js` | `native-picture-formats/1.0` Ready PNG/JPEG vs deferred WebP/SVG |
| `src/native-picture-resources.js` | Native Picture resource embed + format-policy enforcement |
| `docs/NATIVE_PICTURE_FORMATS.md` | Native Picture format policy |
| `web/` | Patch Studio site/PWA |
| `examples/workshop-desk.patch` | Acceptance showcase. Interpreter/Web may persist Table/Tree text-lists; current native lowering still fail-closes `set = value` from Table `changed` because that event value is list-valued. Do not interpolate lists into `text`. |
| `examples/shape-window.patch` | Native Shape Stage 1 rectangle/rounded/ellipse/line showcase |
| `examples/paintbox-window.patch` | Native PaintBox Stage 1 clear/line/rectangle/ellipse/text showcase |
| `examples/paintbox-image-window.patch` | Native PaintBox `draw image` showcase with inline PNG data URI |
| `docs/RAD_STUDIO_MASTERPLAN.md` | Architecture |
| `docs/RAD_STUDIO_MASTER_BACKLOG.md` | Long-term backlog |
| `docs/COMPONENT_CAPABILITY_MATRIX.md` | Generated capability table |
| `docs/ROADMAP.md` | Current remaining R1 gates |

## Next ChatGPT slice

**ImageList native / Button images, or native window icons.** PaintBox `draw image` is native on IR 1.7 / payload v17 / runtime v1.8. Native GUI IR 1.7 still fail-closes Window icons, ImageList and Button image bindings. Do not bump Native GUI IR / payload / runtime unless native backends move together. Native `.ico`/AppKit/Linux desktop icon packaging and ToolBar/TreeView image bindings can wait.

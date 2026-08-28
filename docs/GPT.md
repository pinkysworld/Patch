# GPT / Grok handoff

Living briefing for ChatGPT, Grok and other coding agents working on [pinkysworld/Patch](https://github.com/pinkysworld/Patch). Update this file in the same change that alters product contracts, RAD status or the next recommended slice.

Last refreshed: **2026-08-28** on `grok/rad-paintbox-draw-image-r1`, after #276 merged to `main`.

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
| Native Picture formats | **native-picture-formats/1.0** (Ready PNG/JPEG; deferred WebP/SVG) |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Older versioned modules are compatibility evidence, not current Ready.

## Collaboration

- `main` includes merged #276 with native PaintBox Stage 1, current Workshop Desk, Studio/site synchronization and the rounded Patch P branding.
- Current RAD PR: [#277](https://github.com/pinkysworld/Patch/pull/277) `grok/rad-paintbox-draw-image-r1`.
- #277 is based on current `main`, not on the stale pre-merge #276 stack.
- Earlier RAD slices #268 through #276 are historical/merged foundations, not bases for new work.
- Tracking issue: [#247](https://github.com/pinkysworld/Patch/issues/247) RAD R1.
- After every slice: tests, docs, public site copy, this file, and regenerate `docs/COMPONENT_CAPABILITY_MATRIX.md` when registry target metadata changes.
- Do not merge stale planning PRs #245 / #246; the canonical plans live in `docs/RAD_STUDIO_MASTERPLAN.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md`.

## Non-negotiable rules

1. Source is authoritative. No second persistent UI model, no Designer-only component graph, no `localStorage` application state.
2. UI toolkit interaction is transient until source commits it through `change`.
3. Unsupported targets **fail closed**. Authoring is not runtime support.
4. Do not bump Native GUI IR / payload / runtime unless the native Win32/AppKit/GTK runtimes, sealers, smokes and docs all move together.
5. Native image decoding remains bounded by `native-picture-formats/1.0`: PNG/JPEG Ready, WebP/SVG deferred/fail-closed.
6. Panel Stage 1 is visual grouping, not Delphi-style native child containment.
7. Keep beginner syntax small. Sophistication stays in compiler/runtime.
8. Add a test for every semantic rule. Public site/PWA/offline asset closure must include new Studio modules.

## RAD R1 status

Completed or integrated in #277:

- Component registry v0.8 with property/event/renderer/target metadata
- Resource Manager Stage 1 and project bundle v4 resources
- Picture authoring + Web embed + bounded native PNG/JPEG
- Picture display properties and explicit `native-picture-formats/1.0`
- Shape Stage 1 authoring + Web + native parity
- PaintBox Stage 1 authoring + pure `paint` + Web + native clear/line/rectangle/ellipse/text parity on IR 1.6 / payload v16 / runtime v1.7
- PaintBox `draw image` with quoted `patch-resource:` or `data:` locator, Studio/Web rendering and native PNG/JPEG transport on IR 1.7 / payload v17 / runtime v1.8
- ImageList Stage 1 authoring and Button `image list.item` on Studio/Web
- Window/application icon source declaration and Studio/Web favicon packaging under `window-icon/1.0`
- generated component capability matrix
- complete z-order front/back/forward/backward actions, source-backed editor/Designer Undo/Redo, active-Form full-cost rendering and the 10-Form / 200-control benchmark
- Workshop Desk current Ready acceptance source covering Forms, Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Picture, Panel, Shape, PaintBox including `draw image`, StatusBar and Timer

Remaining R1 resource-consumer gaps:

1. native ImageList/Button-image transport, with later ToolBar/Tree bindings sharing the same contract rather than a fake standalone ImageList claim
2. native application/window icon packaging across Win32, AppKit and Linux desktop

Do not label these gaps complete until all advertised desktop backends move together and their workflows are green.

## Review corrections in #277

The initial Grok implementation was directionally correct but required native-runtime hardening before merge. Win32 now keeps the GDI+ `IStream` alive for the cached `Image` lifetime and uses type-safe geometry. AppKit preserves the v1.7 state-driven PaintBox repaint chain before adding the image overlay. GTK installs the v1.7 event rewire and then adds image refresh hooks including Timer. The PIMG reader bounds recursive depth and node counts before allocation, and runtime smokes require a real image to decode.

## How to add a component

Follow an existing Stage 1 such as Shape, PaintBox or ImageList rather than inventing a second catalog. Required coverage is parser/source round-trip, Designer add/edit/delete, Object Inspector, browser preview, event/accessibility behavior, native lowering or explicit fail-closed diagnostics, Windows/macOS/Linux runtime where advertised, docs/example and public site/offline closure.

Then update `src/component-registry.js`, run `node scripts/generate-component-matrix.js`, and synchronize this file plus public/product docs.

## Useful commands

```bash
npm test
npm run check:project
npm run check:site
node scripts/generate-component-matrix.js --check
node src/cli-entry.js components --json
node src/cli-entry.js doctor --json
```

## File map

| Path | Role |
|---|---|
| `src/component-registry.js` | Canonical component metadata |
| `src/picture-control.js` / `src/picture-source.js` | Picture display and source contracts |
| `src/button-image.js` | Button `image list.item` codec and native fail-closed boundary |
| `src/window-icon.js` | Window/application icon codec and native fail-closed boundary |
| `src/native-current-contract.js` | Current IR 1.7 / v17 / v1.8 facade |
| `src/native-gui-ir-v17.js` | Native GUI IR 1.7 PaintBox `draw image` lowering |
| `src/sealed-native-gui-v17.js` | Payload v17 PaintBox image trailer (`PIMG`) |
| `src/native-gui-ir-v16.js` | Frozen PaintBox Stage 1 lowering |
| `src/sealed-native-gui-v16.js` | Frozen payload v16 PaintBox trailer (`PPBX`) |
| `src/native-picture-format-policy.js` | PNG/JPEG Ready vs WebP/SVG deferred policy |
| `examples/workshop-desk.patch` | Current cross-platform Ready acceptance showcase; excludes native-fail-closed ImageList/Button-image and Window-icon consumers |
| `examples/paintbox-window.patch` | Focused native PaintBox five-operation Stage 1 example |
| `examples/paintbox-image-window.patch` | Focused native PaintBox `draw image` example |
| `docs/RAD_STUDIO_MASTERPLAN.md` | Architecture |
| `docs/RAD_STUDIO_MASTER_BACKLOG.md` | Long-term backlog |
| `docs/ROADMAP.md` | Current remaining gates |

## Next slice

After #277 is fully green and merged, the remaining R1 choices are **native ImageList/Button images** and **native application/window icons**. Keep them explicit resource-consumer contracts and move all advertised native hosts together. Do not regress the current PaintBox v1.8 line or widen the beta.32 formal claim.
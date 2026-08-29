# GPT / Grok handoff

Living briefing for coding agents working on [pinkysworld/Patch](https://github.com/pinkysworld/Patch). Update this file in the same change that alters product contracts, RAD status or the next recommended slice.

Last refreshed: **2026-08-29**, after Offline Studio publication, primary non-executing Designer integration, active-Form materialization, six-Form Workshop expansion and compiler-oriented Studio branding.

## What Patch is

Patch is a small **change-oriented** language plus **Patch Studio**, a source-backed RAD IDE. Persistent application state does not mutate invisibly. Ordinary post-creation mutation is a semantic `change`. There is no hidden `.frm` / `.dfm`; Designer operations rewrite ordinary `.patch` source or the explicit project-v4 resource store.

Public Studio: https://minh.systems/Patch/
Public downloads: https://minh.systems/Patch/downloads.html

## Current product contract

Do not silently widen or flatten these labels.

| Surface | Current |
|---|---|
| Package | `0.2.0-beta.36` |
| Change IR | `0.10` |
| Native GUI IR | `1.7` |
| Sealed payload | `v17` |
| Ready/offline runtime | `v1.8` (Windows, macOS, Linux; token-free) |
| Frozen TreeView line | Native GUI IR **1.2** / payload **v12** / runtime **v1.3** |
| Previous Slider line | Native GUI IR **1.3** / payload **v13** / runtime **v1.4** |
| Previous Chrome line | Native GUI IR **1.4** / payload **v14** / runtime **v1.5** |
| Previous Shape line | Native GUI IR **1.5** / payload **v15** / runtime **v1.6** |
| Previous PaintBox Stage 1 line | Native GUI IR **1.6** / payload **v16** / runtime **v1.7** |
| Studio project | multi-file/resource bundle **v4** |
| Component registry | **0.8** |
| Studio design model/cache | `studio-design-model/0.1`, `studio-design-cache/0.1` |
| Studio Form materialization | `studio-form-materialization/0.1`, one full active Form plus lightweight inactive shells |
| Studio brand | `compiler-p-v1` through the shared `web/icon.svg` browser/PWA/Offline Studio asset |
| Native ImageList preparation | `native-imagelist-asset-plan/0.1`, not native Ready |
| Offline Studio | manifest **v1**, rolling Stage 1 channel **`offline-studio-v0.2`** |
| Formal claim | **beta.32** invocation-frame-aware direct-Wasm correspondence for the finite safe-integer call-tree fragment. Studio/native/RAD work does **not** widen that claim. |
| Native Picture formats | **native-picture-formats/1.0** (Ready PNG/JPEG; deferred WebP/SVG) |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Older versioned modules are compatibility evidence, not current Ready.

## Current collaboration state

- `main` includes the public Offline Studio release work from PR #285 (`offline-studio-v0.2`); current R0 work wires the existing design-model/cache foundations into the primary Designer refresh without widening runtime/formal contracts.
- Active R0 tracker: [#282](https://github.com/pinkysworld/Patch/issues/282).
- Current status source: `docs/ROADMAP.md`.
- Long-term execution backlog: `docs/RAD_STUDIO_MASTER_BACKLOG.md`.
- Architecture plan: `docs/RAD_STUDIO_MASTERPLAN.md`.
- Offline installed-IDE contract: `docs/OFFLINE_STUDIO.md`.
- Do not resurrect stale R1 planning from older PRs/issues. The roadmap and master backlog are authoritative.

## Non-negotiable rules

1. Source is authoritative. No second persistent UI model, no Designer-only component graph, no `localStorage` application state.
2. UI toolkit interaction is transient until source commits it through `change`.
3. Unsupported targets **fail closed**. Authoring is not runtime support.
4. Do not bump Native GUI IR / payload / runtime unless Win32/AppKit/GTK runtimes, sealers, smokes and docs move together.
5. Native image decoding remains bounded by `native-picture-formats/1.0`: PNG/JPEG Ready, WebP/SVG deferred/fail-closed.
6. Panel Stage 1 is visual grouping, not Delphi-style native child containment.
7. Keep beginner syntax small. Sophistication stays in compiler/runtime.
8. Add a test for every semantic rule. Public site/PWA/Offline Studio closure must include new Studio modules.
9. Offline Studio must not gain a general shell API. Stage 2 privileged operations must be narrow, authenticated and workspace-bounded.
10. Tested release downloads and production code-signing evidence are separate claims.

## R0 / issue #282 status

Completed foundations:

- single-parse Studio Run via compiler AST reuse;
- lazy Change IR formatting;
- hidden runtime Form materialization;
- transactional Run/re-entry guard;
- Workshop real-Chrome freeze regression;
- `studio-design-model/0.1`, which builds design UI/state without executing application behavior;
- `studio-design-cache/0.1` bounded source-revision snapshots;
- Workshop and 10-Form / 200-control design-model/cache acceptance coverage;
- primary `refreshDesigner()` uses the bounded declaration-only design snapshot cache and no longer executes unrelated application behavior;
- hosted and Offline Studio package the same design-model/cache module closure;
- `studio-form-materialization/0.1` materializes control DOM only for the active Designer Form;
- specialized PaintBox, Shape, Panel, StatusBar and Table adapters honor the same Form boundary;
- StatusBar design-time rendering consumes a declaration-only snapshot rather than executing the app;
- real-Chrome six-Form Workshop switching proves inactive Forms settle with zero Designer controls;
- Run yields before the large compile/execute/render task;
- compiler-oriented `compiler-p-v1` branding is shared by Studio header, favicon/PWA and Offline Studio packaging.

Current incremental-runtime additions:

- Stage 1 keyed Form/control identities keep unchanged Form DOM stable across runtime events;
- changed Form replacement restores bounded focus, caret, scroll and unchanged-model multi-selection state;
- Tabs switch locally inside their panel instead of rebuilding the complete app tree.

Next R0 work:

1. share revision snapshots across remaining Designer adapters and define the Worker boundary;
2. move from changed-Form replacement to fine-grained changed-control reconciliation;
3. preserve richer transient Table/Tree adapter selection through the canonical keyed-state layer;
4. add measurable six-Form Workshop event-to-paint performance gates;
5. preserve Explorer/Inspector/selection contracts across materialized Form switches;
6. split runtime/render/build responsibilities out of `web/playground.js`;
7. make Pages deployment release-aware without weakening fail-closed runtime verification.

Broad R2 component expansion should not displace this P0 architecture work.

## R1 status

Implemented graphics/resource foundation includes Resource Manager v4, Picture, Shape, PaintBox including native PNG/JPEG `draw image`, ImageList authoring + Web Button image consumer, Window/Web icon contract, and `native-imagelist-asset-plan/0.1`.

Remaining R1 resource-consumer gaps:

1. version and transport ImageList/Button assets through the next Native GUI IR/payload/runtime line, then implement Win32/AppKit/GTK consumers;
2. version and implement native application/window icon packaging across Win32/AppKit/Linux.

Do not label either complete until all advertised desktop backends move together and workflows are green.

## Offline Studio status

Stage 1 is a downloadable Offline IDE beta using the same generated Studio application as the hosted product.

Rolling release: `offline-studio-v0.2`

Expected assets:

- `PatchStudio-windows-x64.exe`
- `PatchStudio-macos-arm64`
- `PatchStudio-linux-x64`
- `offline-studio-manifest.json`
- `SHA256SUMS`

The Offline Studio workflow builds/self-smokes Windows, macOS and Linux, assembles a release bundle, verifies identical embedded-site manifests and checksums in PR CI, and only publishes the verified bundle on `main`.

Stage 1 supports offline authoring, Designer/Run and current browser-local build targets. Host-native desktop Build **inside the IDE** is still Stage 2. The existing standalone offline compiler remains the current native local-link route.

Windows/Linux beta IDE binaries are unsigned. macOS is ad-hoc signed but not Developer ID notarized. Production signing remains an external distribution gate.

Stage 2 next work:

- install/embed the current offline compiler and host runtime beside Studio;
- narrow per-launch authenticated loopback build API;
- workspace path authorization;
- host-native Windows/macOS/Linux Build without GitHub/network;
- artifact pane outputs, diagnostics and SHA-256 evidence.

## How to add a component

Follow existing source-backed components rather than inventing a second catalog. Required coverage is parser/source round-trip, Designer add/edit/delete, Object Inspector, browser preview, event/accessibility behavior, native lowering or explicit fail-closed diagnostics, Windows/macOS/Linux runtime where advertised, docs/example and public/Offline Studio asset closure.

Then update `src/component-registry.js`, run `node scripts/generate-component-matrix.js`, and synchronize product docs.

## Useful commands

```bash
npm test
npm run check:project
npm run check:site
npm run check:offline-studio
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
| `src/native-gui-ir-v17.js` | Current native GUI lowering |
| `src/sealed-native-gui-v17.js` | Current payload v17 sealer |
| `src/native-picture-format-policy.js` | PNG/JPEG Ready vs WebP/SVG deferred policy |
| `src/studio-design-model.js` | Non-executing design model foundation |
| `src/studio-design-cache.js` | Bounded design snapshot cache |
| `src/studio-form-materialization.js` | Canonical active-Form Designer materialization policy |
| `scripts/build-offline-studio.js` | Self-contained Offline Studio builder |
| `.github/workflows/offline-studio.yml` | Cross-platform Offline Studio build/release contract |
| `examples/workshop-desk.patch` | Current cross-platform Ready acceptance showcase |
| `docs/OFFLINE_STUDIO.md` | Offline IDE download/security/Stage 2 contract |
| `docs/RAD_STUDIO_MASTERPLAN.md` | Architecture |
| `docs/RAD_STUDIO_MASTER_BACKLOG.md` | Long-term backlog and execution order |
| `docs/ROADMAP.md` | Current remaining gates |

## Next slice

Prioritize the next **R0 #282 renderer/performance slice**: stable keyed Form/control identities, incremental visible updates with focus/caret/selection preservation, and measurable six-Form Workshop timing gates. In parallel, share revision snapshots across remaining Designer adapters and define the Worker boundary. The two explicit native R1 resource-consumer gaps and Offline Studio Stage 2 may progress alongside these without creating parallel semantic/build systems.

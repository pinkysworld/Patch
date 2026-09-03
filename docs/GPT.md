# GPT / Grok handoff

Living briefing for coding agents working on [pinkysworld/Patch](https://github.com/pinkysworld/Patch). Update this file in the same change that alters product contracts, RAD status, release distribution or the next recommended slice.

Last refreshed: **2026-09-03**, after source-backed Copy/Cut/Paste, Layers/Object Tree 0.2, the complete Offline Studio distribution matrix, Offline Stage 2 R0.1 secure build bridge, and the Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 promotion.

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
| Native GUI IR | `1.9` |
| Sealed payload | `v19` |
| Ready/offline runtime | `v1.10` on Windows, macOS and Linux |
| Button/ImageList underlay | IR `1.8` / payload `v18` / runtime `v1.9` |
| Explicit compatibility path | payload `v17` / runtime `v1.8` |
| Frozen TreeView line | IR `1.2` / payload `v12` / runtime `v1.3` |
| Studio project | multi-file/resource bundle `v4` |
| Component registry | `0.9` |
| Studio design model/cache | `studio-design-model/0.1`, `studio-design-cache/0.1` |
| Form materialization | `studio-form-materialization/0.1` |
| Designer clipboard | `patch-designer-control-clipboard` v1 |
| Offline Studio | manifest v1, rolling `offline-studio-v0.2` |
| Offline Compiler | rolling `offline-compiler-v0.2` |
| Offline native Build | Stage 2 R0.1 `patch-offline-build-bridge/0.1` implemented in source; installed UI/toolchain integration remains open |
| Native Picture formats | `native-picture-formats/1.0`: PNG/JPEG Ready, WebP/SVG deferred |
| Formal claim | beta.32 invocation-frame-aware direct-Wasm correspondence for the finite safe-integer call-tree fragment; later Studio/native/RAD work does not widen it |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Older versioned modules remain compatibility/reproducibility evidence, not current Ready.

## Current collaboration state

Recent merged foundations include:

- Designer rail/canvas and toolbar hierarchy cleanup;
- Layers/Object Tree 0.2;
- common Designer command path;
- source-backed control Copy/Cut/Paste across Forms/projects with semantic clipboard validation;
- Designer-scoped Cmd/Ctrl+C/X/V and Command Palette integration;
- Quick Open scoped-query noise reduction;
- real-browser performance gate isolation with startup-only bounded retry;
- complete Offline Studio Stage 1 matrix including Windows ARM64, Linux ARM64, macOS Intel runtime kit and portable FreeBSD-tested path;
- Offline Stage 2 R0.1 secure native-build bridge;
- Current Ready IR 1.9 / v19 / runtime v1.10 including Button/ImageList compatibility and application/Form icons.

Current status source: `docs/ROADMAP.md`.
Long-term RAD backlog: `docs/RAD_STUDIO_MASTER_BACKLOG.md`.
Architecture plan: `docs/RAD_STUDIO_MASTERPLAN.md`.
Offline installed-IDE contract: `docs/OFFLINE_STUDIO.md`.

## Non-negotiable rules

1. Source is authoritative. No second persistent UI model, no Designer-only component graph, no hidden form file.
2. UI toolkit interaction is transient until Patch source commits persistent state through `change`.
3. Unsupported targets fail closed. Authoring is not runtime support.
4. Do not bump Native GUI IR / payload / runtime unless Win32/AppKit/GTK runtimes, sealers, smokes, releases and docs move together.
5. Native image decoding remains bounded by `native-picture-formats/1.0`: PNG/JPEG Ready, WebP/SVG deferred/fail-closed.
6. Panel Stage 1 is visual grouping, not full native child containment.
7. Add tests for semantic rules and public claims. The hosted site and Offline Studio closure must include every imported Studio module.
8. Offline Studio must never expose a general shell API. Privileged operations are narrow, authenticated, versioned and workspace-bounded.
9. Tested hashes and production code-signing/notarization are separate claims.
10. Do not widen the beta.32 formal assurance claim through unrelated product work.

## RAD status

### R0 architecture/reliability

Implemented foundations include:

- compiler AST reuse and lazy Change IR formatting;
- declaration-only design model/cache and shared exact-source snapshots;
- active-Form materialization;
- keyed Form/control runtime identities and bounded transient state restoration;
- local Tabs reconciliation;
- real-Chrome Workshop and 10-Form/200-control gates;
- real-browser performance test isolated from the broad Node suite;
- one bounded retry only for recognized Chrome/DevTools startup failures.

Remaining R0 work includes the versioned Worker boundary, measured Table/Tree virtualization where justified, further adapter-owned incremental reconciliation, and splitting runtime/render/build responsibilities out of `web/playground.js`.

### R2 Designer parity already landed

- source-backed single-control clipboard schema across Forms/projects;
- collision-safe id/event remapping;
- semantic external clipboard validation;
- shared Copy/Cut/Paste command path and shortcuts;
- paste into empty active Form;
- Layers/Object Tree Stage 0.2.

Still open: multi-selection clipboard transfer, independent source-backed TabOrder/visual Tab Order mode, Lock Controls/design guides, richer container parity and professional IDE features.

## Offline Studio status

Rolling release: `offline-studio-v0.2`.

Published assets:

- `PatchStudio-windows-x64.exe`
- `PatchStudio-windows-arm64.exe`
- `PatchStudio-macos-arm64`
- `PatchStudio-macos-x64.tar.gz`
- `PatchStudio-linux-x64`
- `PatchStudio-linux-arm64`
- `PatchStudio-portable-node18.tar.gz`
- `offline-studio-manifest.json`
- `SHA256SUMS`

The macOS Intel archive contains its own Intel Node runtime. The portable Node 18+ path is exercised in a real FreeBSD 15 x64 VM. All host-specific distributions must carry the same deterministic Studio manifest before release assembly.

Stage 1 supports offline authoring, Designer, Run and current browser-local build targets.

### Stage 2 R0.1

`src/offline-studio-build-bridge.js` implements `patch-offline-build-bridge/0.1`:

- loopback `127.0.0.1` only;
- per-launch Bearer capability, timing-safe comparison;
- closed bounded JSON request schema;
- only `POST /v1/build` / `build-native-window`;
- relative `.patch` source paths only;
- canonical workspace/source containment with traversal and symlink escape rejection;
- fixed `.patch-build/native/<requestId>` output;
- direct `buildNativeGuiForHost()` invocation;
- no general shell, argv, environment or arbitrary output path.

Installed host-native Build is **not yet a completed user-facing workflow**. Remaining integration: package compiler/current runtime beside Studio, explicit workspace-open authority, capability delivery to UI, visible Build wiring, structured artifact diagnostics and installed Windows/macOS/Linux native-build self-smokes.

## Current native surface

Current Ready is IR 1.9 / payload v19 / runtime v1.10. It includes the established native component stack plus Shape, PaintBox including bounded PNG/JPEG `draw image`, Button/ImageList images and Window/application icons.

Application icon packaging is Current Ready:

- Windows deterministic `.ico` and PE resource-slot embedding;
- macOS `.icns` / `CFBundleIconFile`;
- Linux hicolor PNG / `.desktop` metadata.

Future native features require a new explicit versioned contract rather than widening v19 in place.

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
| `src/native-current-contract.js` | Current IR 1.9 / v19 / v1.10 facade |
| `src/native-gui-ir-v19.js` | Current native GUI lowering |
| `src/sealed-native-gui-v19.js` | Current payload v19 sealer |
| `src/native-picture-format-policy.js` | PNG/JPEG Ready vs WebP/SVG deferred policy |
| `src/studio-design-model.js` | Non-executing design model |
| `src/studio-design-cache.js` | Bounded design snapshot cache |
| `src/studio-form-materialization.js` | Active-Form materialization policy |
| `web/designer-control-clipboard-model.js` | Versioned source-backed control transfer model |
| `web/designer-control-clipboard-guard.js` | Semantic validation for external clipboard payloads |
| `src/offline-studio-build-bridge.js` | Stage 2 R0.1 privileged native-build capability boundary |
| `scripts/build-offline-studio.js` | Self-contained Offline Studio builder |
| `.github/workflows/offline-studio.yml` | Cross-platform Offline Studio build/release contract |
| `examples/workshop-desk.patch` | Dense RAD/runtime acceptance fixture |
| `docs/OFFLINE_STUDIO.md` | Offline IDE download/security/Stage 2 contract |
| `docs/RAD_STUDIO_MASTER_BACKLOG.md` | Long-term backlog and execution order |
| `docs/ROADMAP.md` | Current remaining gates |

## Next recommended slices

Keep the current architecture single-path and source-backed. The next useful RAD slices are:

1. a compact visible Designer Edit group that dispatches the already shared Copy/Cut/Paste/Duplicate/Delete command ids;
2. multi-selection clipboard transfer after the single-control transfer model remains stable;
3. F4/Properties and other conventional keyboard affordances;
4. Offline Stage 2 R0.2 capability delivery and visible Build integration without exposing general local-process authority;
5. the remaining R0 Worker/module-boundary and measured performance work.

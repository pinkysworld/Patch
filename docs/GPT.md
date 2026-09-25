# GPT / Grok handoff

Living briefing for coding agents working on [pinkysworld/Patch](https://github.com/pinkysworld/Patch). Update this file in the same change that alters product contracts, RAD status or the next recommended slice.

Last refreshed: **2026-09-25**. Current Ready is Native GUI IR 1.9 / payload v19 / runtime v1.10. Keyed rendering, the design-model cache, active-Form materialization and that native promotion are done. Do not reimplement them.

## What Patch is

Patch is a small **change-oriented** language plus **Patch Studio**, a source-backed RAD IDE. Persistent application state does not mutate invisibly. Ordinary post-creation mutation is a semantic `change`. There is no hidden `.frm` / `.dfm`; Designer operations rewrite ordinary `.patch` source or the explicit project-v4 resource store.

Public Studio: https://minh.systems/Patch/
Public downloads: https://minh.systems/Patch/downloads.html

## Current product contract

Do not silently widen or flatten these labels. Future native features need a new IR, payload and runtime. Do not widen v19 in place.

| Surface | Current |
|---|---|
| Package | `0.2.0-beta.36` |
| Change IR | `0.10` |
| Native GUI IR | `1.9` |
| Sealed payload | `v19` |
| Ready/offline runtime | `v1.10` (Windows, macOS, Linux; token-free) |
| Contract id | `native-gui-1.9/payload-19/runtime-1.10` |
| Runtime tags | `native-win32-runtime-v1.10`, `native-macos-runtime-v1.10`, `native-linux-runtime-v1.10` |
| Frozen TreeView line | Native GUI IR **1.2** / payload **v12** / runtime **v1.3**. Not the current Slider line. |
| Previous Slider line | Native GUI IR **1.3** / payload **v13** / runtime **v1.4** |
| Previous Chrome line | Native GUI IR **1.4** / payload **v14** / runtime **v1.5** |
| Previous Shape line | Native GUI IR **1.5** / payload **v15** / runtime **v1.6** |
| Previous PaintBox Stage 1 line | Native GUI IR **1.6** / payload **v16** / runtime **v1.7** |
| Offline Compiler compatibility underlay | Native GUI IR **1.7** / payload **v17** / runtime **v1.8**. Explicit `--gui-payload-version 17` only. Not the default. |
| Button ImageList underlay | Native GUI IR **1.8** / payload **v18** / runtime **v1.9**, preserved inside Current Ready |
| Studio project | multi-file/resource bundle **v4** |
| Component registry | **0.10** |
| Studio design model/cache | `studio-design-model/0.1`, `studio-design-cache/0.1` |
| Studio Form materialization | `studio-form-materialization/0.1`, one full active Form plus lightweight inactive shells |
| Studio brand | `compiler-p-v1` through the shared `web/icon.svg` browser/PWA/Offline Studio asset |
| Button ImageList images | Current Ready on Windows, macOS and Linux. `native-imagelist-asset-plan/0.1` is only the pretransport planner. |
| Application/Form icons | Current Ready on Windows, macOS and Linux. Package plan: `src/native-window-icon-package-v110.js`. |
| PNG/JPEG Picture, Shape, PaintBox | Current Ready, including PaintBox `draw image`. |
| Deferred native picture formats | WebP/SVG stay deferred under `native-picture-formats/1.0`. |
| Studio/Web-only, fail-closed on Current Ready | PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, ScrollBar, GroupBox, ScrollBox, SplitContainer, advanced Table column width/alignment, TreeView node images, hints and state tones. |
| Offline Studio | manifest **v1**, rolling channel **`offline-studio-v0.2`**. Stage 2 R0.2 host-native Window Build is shipped for Windows x64, macOS Apple Silicon and Linux x64 only. |
| Formal claim | **beta.32** invocation-frame-aware direct-Wasm correspondence for the finite safe-integer call-tree fragment. Studio/native/RAD work does **not** widen that claim. |

Product JavaScript imports `src/native-current-contract.js`. The frozen TreeView facade is `src/native-frozen-contract.js`. Older versioned modules are compatibility evidence, not current Ready.

Workshop Desk has two explicit fixtures: `examples/workshop-desk.patchproject` is the working seven-Form Studio/Web Project-v4 app; `examples/workshop-desk-native.patch` is the Current Ready native acceptance source. Do not widen native v19 merely to keep the richer app native-compatible.

## Current collaboration state

- `main` is package `0.2.0-beta.36`. Current Ready native promotion to 1.9 / 19 / 1.10 is complete, including Button ImageList and application/Form icons.
- Active R0 tracker: [#282](https://github.com/pinkysworld/Patch/issues/282). Remaining work is the unchecked list in `docs/ROADMAP.md`, not the already-landed renderer/cache/materialization work.
- Current status source: `docs/ROADMAP.md`.
- Long-term execution backlog: `docs/RAD_STUDIO_MASTER_BACKLOG.md`.
- Architecture plan: `docs/RAD_STUDIO_MASTERPLAN.md`.
- Offline installed-IDE contract: `docs/OFFLINE_STUDIO.md`.
- Do not resurrect stale R1 planning from older PRs/issues. The roadmap and master backlog are authoritative.

## Non-negotiable rules

1. Source is authoritative. No second persistent UI model, no Designer-only component graph, no `localStorage` application state.
2. UI toolkit interaction is transient until source commits it through `change`.
3. Unsupported targets **fail closed**. Authoring is not runtime support.
4. Do not bump Native GUI IR / payload / runtime unless Win32/AppKit/GTK runtimes, sealers, smokes and docs move together. Do not widen v19 for a new feature.
5. Native image decoding remains bounded by `native-picture-formats/1.0`: PNG/JPEG Ready, WebP/SVG deferred/fail-closed.
6. Panel Stage 1 is visual grouping, not Delphi-style native child containment. Positioned Panel children fail closed on Current Ready rather than flattening silently.
7. Keep beginner syntax small. Sophistication stays in compiler/runtime.
8. Add a test for every semantic rule. Public site/PWA/Offline Studio closure must include new Studio modules.
9. Offline Studio must not gain a general shell API. Stage 2 privileged operations stay narrow, authenticated and workspace-bounded.
10. Tested release downloads and production code-signing evidence are separate claims.

## R0 / issue #282 status

Done. Do not reimplement:

- single-parse Studio Run via compiler AST reuse;
- lazy Change IR formatting;
- hidden runtime Form materialization;
- transactional Run/re-entry guard;
- `studio-design-model/0.1` and bounded `studio-design-cache/0.1`;
- primary `refreshDesigner()` uses the bounded declaration-only design snapshot cache and no longer executes unrelated application behavior;
- hosted and Offline Studio package the same design-model/cache module closure;
- `studio-form-materialization/0.1` materializes control DOM only for the active Designer Form;
- keyed runtime Form/control identities and `keyed-control-v2`;
- bounded transient Table/Tree selection restoration;
- local Tabs reconciliation;
- Designer selection/Object Inspector/structural-editor state survives Form materialization;
- Build controller and Studio Window renderer extracted from the main playground orchestration path;
- real-Chrome Workshop and 10-Form / 200-control performance gates;
- Current Ready promotion to Native GUI IR 1.9 / payload v19 / runtime v1.10.

Remaining unchecked R0 work, from `docs/ROADMAP.md`:

1. virtualize very large Table/Tree previews where measurements justify it;
2. define and implement a versioned Worker boundary for parse/compile/design-model work;
3. bound any remaining design-time expression evaluation;
4. extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists;
5. finish extracting runtime lifecycle and remaining transient UI state from `web/playground.js`;
6. make Pages deployment release-aware so expected runtime-publication races do not generate failure noise;
7. reduce CI notification noise and shrink Offline Compiler triggers to the real dependency closure.

## R1 status

Shipped on Current Ready. Do not treat these as open gaps:

- Resource Manager v4, Picture, Shape and PaintBox, including native PNG/JPEG `draw image`;
- Button `ImageList` images on Windows, macOS and Linux through IR 1.8 / payload v18 / runtime v1.9, preserved by IR 1.9 / payload v19 / runtime v1.10;
- application/Form icons on Windows, macOS and Linux, including PE / `.icns` / hicolor+`.desktop` packaging through `src/native-window-icon-package-v110.js`.

Still open, and only through a new explicit native contract when a native consumer is claimed:

1. ImageList transport for ToolBar/ToolButton/Menu/Tree consumers, only when those component contracts exist;
2. richer Picture native display-property combinations;
3. PaintBox pointer/path/transform/gradient expansion;
4. PWA icon-set generation and a visual application-branding editor.

TreeView node images, hints and state tones are Studio/Web-only and fail closed on Current Ready.

## Offline Studio status

Stage 1 is the downloadable Offline IDE beta. Stage 2 R0.2 host-native Window Build is already shipped for three hosts. See `docs/OFFLINE_STUDIO.md`.

Rolling release: `offline-studio-v0.2`

Installed host-native Window Build:

| Host | Installed native Build |
|---|---|
| Windows x64 | Yes |
| macOS Apple Silicon | Yes |
| Linux x64 | Yes |
| Windows ARM64 | Not yet, fail-closed |
| Linux ARM64 | Not yet, fail-closed |
| macOS Intel runtime kit | Not yet, fail-closed |
| Portable Node bundle / FreeBSD path | Not yet, fail-closed |

Do not claim host-native Build for a host that table does not mark Yes.

Shipped Stage 2 R0.2 on those three hosts includes the authenticated narrow build bridge, project-v4 image resources, structured `patch-diagnostic` v1 compiler errors, and Linux desktop sidecars in one deterministic archive when an application icon produces them.

Still open:

- Windows ARM64, Linux ARM64 and macOS Intel installed Build, only after matching compiler/runtime distributions exist;
- whether Console installed Build needs a separate narrow bridge action;
- richer warning/multi-error diagnostic lists and source-navigation actions;
- user-facing artifact-pane integration for outputs, diagnostics and checksums;
- an explicit local-versus-remote build selector, with local as the offline path;
- optional remote/fresh CI Build kept separate from the offline path.

Windows/Linux beta IDE binaries are unsigned. macOS Apple Silicon is ad-hoc signed but not Developer ID notarized. Production signing remains an external distribution gate.

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
| `src/component-registry.js` | Canonical component metadata, registry **0.10** |
| `src/picture-control.js` / `src/picture-source.js` | Picture display and source contracts |
| `src/button-image.js` | Button `image list.item` codec. `nativeButtonImageUnsupportedMessage` is the pre-v18 compatibility reject, not the Current Ready path. |
| `src/window-icon.js` | Window/application icon codec |
| `src/native-current-contract.js` | Current IR 1.9 / v19 / v1.10 facade |
| `src/native-gui-ir-v19.js` | Current native GUI lowering |
| `src/sealed-native-gui-v19.js` | Current payload v19 sealer |
| `src/native-window-icon-package-v110.js` | Current Ready Windows/macOS/Linux icon package plan |
| `src/native-window-icon-packaging.js` | Pre-promotion icon artifact planner. Not the v1.10 package plan. |
| `src/native-gui-ir-v17.js` / `src/sealed-native-gui-v17.js` | Explicit Offline Compiler compatibility underlay, not the default |
| `src/native-frozen-contract.js` | Frozen TreeView IR 1.2 / v12 / v1.3. Not the current Slider line. |
| `src/native-picture-format-policy.js` | PNG/JPEG Ready vs WebP/SVG deferred policy |
| `src/studio-design-model.js` | Non-executing design model foundation |
| `src/studio-design-cache.js` | Bounded design snapshot cache |
| `src/studio-form-materialization.js` | Canonical active-Form Designer materialization policy |
| `scripts/build-offline-studio.js` | Self-contained Offline Studio builder |
| `.github/workflows/offline-studio.yml` | Cross-platform Offline Studio build/release contract |
| `examples/workshop-desk.patch` | Seven-Form Current Ready acceptance showcase |
| `docs/OFFLINE_STUDIO.md` | Offline IDE download/security/Stage 2 contract |
| `docs/RAD_STUDIO_MASTERPLAN.md` | Architecture |
| `docs/RAD_STUDIO_MASTER_BACKLOG.md` | Long-term backlog and execution order |
| `docs/ROADMAP.md` | Current remaining gates |

## Next slice

Do the remaining unchecked R0 items first: large Table/Tree preview virtualization, a versioned Worker boundary, bounding leftover design-time expression evaluation, adapter-owned incremental reconciliation, extracting the rest of runtime lifecycle from `web/playground.js`, release-aware Pages deploys, and quieter CI. Then R2/Panel follow-through (container-relative Anchors/Dock, nested Panels, visual reparent, and native Panel containment only through a new native contract). Then Offline Studio Stage 2 leftovers listed above. Then R4 parity that stays Studio/Web-only and fail-closed on Current Ready until a new native contract. Future native features need a new IR rather than widening v19.

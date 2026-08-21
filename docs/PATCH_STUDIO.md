# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy while keeping one readable source-backed Patch application model across browser and desktop targets.

## Current status: 0.2 beta.35+

Patch Studio provides:

- source editing, local autosave and privacy-redacted local diagnostics;
- canonical **multi-file project bundle v3** plus Project Tree and deterministic Run/Build composition;
- Console and Window Run;
- a source-backed visual Designer with named Forms;
- Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, **Slider Stage 1**, Table, TreeView and Tabs authoring;
- Form/control drag, resize, keyboard movement and source-backed layout actions;
- structural Table, TreeView and Tabs Properties editors;
- top-level/nested duplicate, reorder and source-reveal workflows;
- Change Contract and Change IR views;
- portable `.patchapp`, Web, direct/bootstrap Wasm and portable C99 builds;
- token-free Ready Windows/macOS/Linux Console and Window builds;
- downloadable offline compiler/linker;
- FreeBSD Console through portable C99.

The default Windows/macOS/Linux desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required for those Ready builds. Optional cloud/AOT remains a separate advanced route.

Patch package **0.2.0-beta.35** keeps Change IR **0.10**. Native GUI IR remains **1.2**, the current sealed payload is **v12**, and the token-free Ready/offline runtime is **v1.3**. The beta.32 invocation-frame result remains the current formal runtime-correspondence milestone; later product work does not widen it.

## Product-backlog boundary

The repository-controlled beta.35+ Studio/compiler backlog is currently closed. The former open product items for a richer data-control surface and structural/nested keyboard refinement are satisfied by Slider Stage 1 plus the implemented keyboard/focus milestone.

Remaining unchecked roadmap items are deliberately separated because they need something outside ordinary repository implementation:

- native Slider parity requires a new versioned Native GUI IR/backend/payload/runtime contract;
- real Windows/macOS signing evidence requires credentials;
- manual Narrator/VoiceOver/Orca validation requires actual assistive-technology testing;
- controlled performance results require fixed-hardware measurements;
- genuine third-party integration evidence requires an external application/plugin context.

See `docs/ROADMAP.md` for the exact split.

## Canonical multi-file project state

The canonical browser project is `patch-studio-project` bundle **version 3**. It carries bounded multi-file Patch sources, deterministic composition/provenance, project name, Console/Window kind, selected build target and native build mode. Older versions migrate explicitly; unknown future versions fail closed.

Typing, sample switching and source-backed Designer mutations feed the same project/source signals. Source, recovery, Designer, Change Contract, Project Tree and native-build UI therefore observe one canonical project state rather than parallel editor models.

Recovery snapshots preserve the complete project, not only the active editor buffer.

## Source-backed Designer

Form dimensions, control geometry, Slider range/step, Table rows, TreeView hierarchy, Tabs pages and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent visual-designer document.

### Forms

The current source-backed Form lifecycle supports:

- Add Form;
- active Form selection and canvas activation;
- Name, Title, Width and Height Properties;
- pointer resize;
- **Fit controls** source rewrite;
- **Default 640×420** source rewrite;
- full Form duplication with fresh Form/control ids and copied handlers;
- confirmed deletion with orphan-handler cleanup;
- last-Form protection.

Previous/next controls plus `Alt+PageUp` / `Alt+PageDown` navigate Forms. That active-Form state is transient IDE state only.

### Control discovery and Properties

The desktop Designer exposes a compact control rail and a categorized **Add control** picker. The picker groups controls into Basic, Choices, Data and Containers and is the narrow/mobile discovery surface as well. `Ctrl/Cmd+Shift+A` focuses it.

All top-level controls share one authoritative primary-selection boundary and common Properties actions. The Properties pane is wider by default, resizable, collapsible and responsive. Its width preference is local IDE state rather than Patch application state.

A selected control can be moved/resized visually. Pointer and keyboard changes rewrite visible source. Common source-backed actions include Center H, Center V, Default size and collision-aware Auto place.

Designer multi-select is an explicit transient secondary set over the shared primary selection. It never becomes Patch state or Change History.

## Slider Stage 1

Slider Stage 1 is the current richer data/input control beyond Table/ListBox/TreeView:

```patch
create number volume = 50
window "Mixer" as main size 560, 300:
  text "Volume: {volume}"
  slider 0..100 as volume step 5 at 24, 80 size 300, 44
when volume changed:
  change volume:
    set = value
```

Studio provides:

- **+ Slider** source-backed insertion;
- default `0..100 step 1` generation;
- id/min/max/step Properties;
- normal source-backed X/Y/width/height geometry;
- App Preview range rendering and live transient display;
- bounded finite numeric `changed` dispatch;
- insertion inside source-backed Tabs pages;
- a Slider sample application.

Slider interaction itself never persists application state. The event-local `value` is a finite number inside the declared range; state changes only when source executes ordinary semantic `change`.

Standalone Window Web supports the same contract. Current Native GUI IR 1.2 / payload v12 / runtime v1.3 intentionally does not. A native Slider program fails closed until a future versioned native contract adds parity.

See `docs/SLIDER_STAGE1.md`.

## ListBox multi-selection

The state type behind a ListBox id determines its interaction contract:

```patch
create list fruits = ["Banana", "Mango"]
window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits
when fruits changed:
  change fruits:
    set = value
```

Text-backed ListBox remains single-select. List-backed ListBox is multi-select in Studio App Preview, Standalone Window Web, direct Win32/AppKit/GTK AOT and current token-free Ready/offline Windows/macOS/Linux paths.

Native GUI IR 1.1 introduced persistent text-list state and the list-backed ListBox event ABI. Current Native GUI IR **1.2** / payload **v12** / runtime **v1.3** preserves it unchanged while adding TreeView.

## Table / Grid

Table is source-backed and runtime selection remains transient:

```patch
window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
when people changed:
  show value
```

Top-level and nested Table Properties support editable columns/cells, add/remove, reorder and duplicate row/column operations. Column movement always keeps the header and corresponding cells aligned. Invalid row widths fail closed instead of silently truncating/padding data.

Current payload v12/runtime v1.3 preserves Table structure, responsive layout and transient selected-row semantics.

## TreeView

TreeView hierarchy is ordinary Patch source:

```patch
create list selected = []
window "Files" as main size 560, 380:
  tree as files at 24, 56 size 300, 240:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "README.md"
when files changed:
  change selected:
    set = value
```

Top-level and nested TreeView Properties support add root/child, rename, move, indent/outdent, delete and deep-copy subtree duplication. The editor refuses to leave an invalid empty TreeView.

Selecting `compiler.js` exposes `['src', 'compiler.js']` as transient event-local `value`. Persistence occurs only because source explicitly executes `change selected`.

Direct native and token-free Ready/offline parity use Native GUI IR **1.2**, sealed payload **v12** and runtime **v1.3** on Windows, macOS and Linux.

## Tabs and nested controls

Tabs page structure and nested controls are source-backed. Studio supports page add/rename/reorder/delete/duplicate and nested insertion/removal/reorder/duplicate for:

- Text;
- Button;
- Input;
- Checkbox;
- Radio;
- ComboBox;
- ListBox;
- **Slider**;
- Table;
- TreeView.

Nested Table and TreeView use dedicated structural Properties editors. Multi-line blocks move/copy atomically. Named duplicates receive globally unique ids and matching handlers are copied to the remapped id.

Tabs-inside-Tabs remains intentionally outside the current stage and fails closed.

See `docs/TABS.md`.

## Keyboard and accessibility refinement

The automated structural/nested editor baseline includes:

- roving TreeView/Tabs selection with ArrowUp/ArrowDown/Home/End;
- `Ctrl/Cmd+Arrow` structural move/indent/outdent shortcuts;
- `Ctrl/Cmd+Enter` commit/focus actions;
- Escape to close nested structure editors and restore focus;
- `aria-keyshortcuts` projection;
- explicit `:focus-visible` treatment;
- focus restoration after supported source-backed rewrites.

This closes the repository-side keyboard-refinement milestone. It is **not** a WCAG conformance statement. Manual Narrator, VoiceOver, Orca and comparable assistive-technology testing remains an external validation gate.

See `docs/STUDIO_KEYBOARD_ACCESSIBILITY.md`.

## Transient GUI event values

Current event values are:

- Input, ComboBox, Radio and text-backed ListBox: text;
- Checkbox: Boolean;
- Slider: bounded finite number;
- list-backed ListBox: text-list of selected display strings;
- Table: text-list for the selected row;
- TreeView: text-list for the selected root-to-node display path.

Persistent application state changes only through explicit Patch `change`. Tabs page selection and Designer/editor selection remain renderer/IDE state.

## Native desktop path

Current mappings include Win32, AppKit and GTK3 controls for the supported TreeView-capable surface. Unsupported native behavior fails closed. There is no implicit Electron fallback; the separately labelled compatibility package is the only Electron-based GUI path.

Current release tags are:

- `native-win32-runtime-v1.3`;
- `native-macos-runtime-v1.3`;
- `native-linux-runtime-v1.3`.

Frozen compatibility lines remain explicit: v11/runtime v1.2 for Menu+list, v10/runtime v1.1 for list state, v9/runtime v1.0 for Table and earlier responsive/base contracts below them.

## Runtime integrity

The token-free Ready path is protected by the release/deployment integrity chain:

1. Pages requires the current runtime releases.
2. It downloads the exact browser-consumed assets.
3. GitHub Release SHA-256 digests are read.
4. `scripts/runtime-integrity-manifest.js` independently re-hashes the assets.
5. Pages publishes `runtimes/runtime-manifest.json`.
6. `web/runtime-integrity.js` hashes the selected runtime again with Web Crypto before packaging.

A missing entry or mismatch stops packaging. This proves byte identity inside the release/deployment path; it is not Authenticode or Developer ID/notarization evidence.

## Offline compiler

The downloadable compiler is the command-line counterpart to Ready builds. Windows/macOS/Linux `patch link` defaults to Native GUI IR **1.2**, payload **v12** and runtime **v1.3**, preserving responsive layout, Table, multi-select ListBox, Menu and TreeView semantics.

The offline-compiler CI independently links and executes canonical current Window apps on Windows, Linux, Apple Silicon macOS and Intel macOS. FreeBSD remains Console-only via portable C99.

## PWA and public website

Patch Studio derives a deterministic content revision from browser-facing pages/assets/compiler/runtime modules. Generated local asset references carry that revision and the Service Worker uses it as the active cache identity.

Same-origin `/runtimes/` requests are fresh-first online with successful bytes retained as offline fallback.

The public website now uses a shared refreshed presentation layer. Studio exposes the current contracts and quick-start shortcuts directly above the IDE workspace. The Documentation page groups the current docs and provides a local text filter without telemetry or an external search service.

## Recovery and diagnostics

Recovery keeps deduplicated local snapshots and supports Snapshot now, Restore, Export, Delete and Clear all.

`Copy diagnostics` and `.patchreport` create local privacy-redacted support bundles. They include version, target, source size/hash, compiler state, browser/PWA state and bounded recent errors but omit project source. No diagnostics upload path exists in Studio.

## Formal/research boundary

The ordinary Studio does not need Lean. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

Product/UI/runtime work after beta.32 does not expand those claims. Runtime capture, validator/frame reconstruction, remaining parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Where future work belongs

Core current Studio authoring is complete for the existing control vocabulary. Future work should be classified by dependency rather than added as a vague never-ending backlog:

- **new product milestone:** genuinely new controls or IDE capabilities with concrete tests;
- **new native ABI milestone:** Slider native parity or another feature requiring a versioned native contract;
- **distribution gate:** installers, signing evidence or update channels;
- **manual validation gate:** screen-reader/assistive-technology verification;
- **research gate:** controlled measurements, external integration evidence or venue feedback.

That separation keeps the beta.35+ product surface accurate without overstating external evidence.
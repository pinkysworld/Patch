# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.35+

Patch Studio provides source editing and local autosave, Console and Window Run, a source-backed visual Designer, named Forms, direct Form/control drag and resize, multi-file project bundle v3, a Project Tree, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Table/TreeView controls, Tabs, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

The public website is split into focused **Studio**, **Language**, **Documentation**, **Downloads** and **Help** pages. The default Windows/macOS/Linux desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required for those Ready builds. Optional local/cloud AOT remains separate.

Patch package **0.2.0-beta.35** keeps Change IR **0.10**. The beta.32 invocation-frame assurance result remains the current formal runtime-correspondence milestone. Later product/runtime work does not widen that formal claim.

## Canonical multi-file Studio state

The canonical browser project is `patch-studio-project` bundle **version 3**. It carries bounded multi-file Patch sources, deterministic composition/provenance, project name, Console/Window kind, selected build target and native build mode. Older project versions migrate explicitly; unknown future versions fail closed.

Programmatic sample/Designer mutations and normal typing use the same project/source signals, so source, recovery, Designer, Change Contract, Project Tree and native-build panel observe one project state. Recovery snapshots preserve the complete project rather than only one editor buffer.

The source workspace includes a source-backed Project Tree. Run and Build compose the bounded project deterministically instead of inventing a hidden second application model.

## Source-backed Forms and controls

Form dimensions, control geometry, labels, ids, options, Table rows, TreeView hierarchy, Tabs pages and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent form document.

The desktop Designer presents the controls in a compact left rail, including Table and TreeView as first-class source-backed tools. A categorized **Add control** picker groups the same tools into **Basic**, **Choices**, **Data** and **Containers**. On narrow screens the picker replaces the long row of individual add icons; on desktop the rail remains available for fast direct insertion. Ctrl/Cmd+Shift+A focuses the picker. The picker deliberately delegates to the existing source-backed toolbox buttons rather than introducing a second add or source-mutation path.

The Properties pane defaults to a wider desktop layout, can be resized by dragging its separator, can be collapsed from the Designer toolbar and remembers its local width. On narrower screens Properties moves below the canvas. This workspace state is an IDE preference only and does not become Patch application state.

The current Designer toolbar exposes a compact shared-selection context. It shows the selected control type, id, Form and multi-select count, provides **Focus selected / Focus form** and **Clear**, and supports Escape-to-deselect when focus is not inside an editor field. Properties uses the same shared selection boundary, shows a type-specific heading and reports whether common source-backed fields are current or have unapplied edits.

The Form workflow keeps the active Form selector and Add Form action directly available while Name, Title, Width and Height live in a compact **Form settings** popover. The active Form is highlighted in the canvas; clicking or keyboard-activating a Form title switches to it. Previous/next buttons and Alt+PageUp / Alt+PageDown navigate named Forms. These are transient IDE interactions only.

**Fit controls** computes the bounding box of the active Form's source-backed controls plus padding and rewrites the ordinary `window ... size W, H` source. **Default 640×420** restores the ordinary source-backed default dimensions. Neither action creates hidden layout state.

A selected control can be moved/resized visually. A Form has a lower-right resize grip. Pointer and keyboard changes rewrite visible Patch source. Forms may grow beyond the visible Designer width; the Designer remains scrollable instead of clamping the Form.

Table, TreeView and Tabs additionally expose source-backed structural editors inside Properties. These editors rewrite only the selected `table`/`row`, `tree`/`node` or `tabs`/`tab` block and validate the resulting Patch source before accepting the edit. They do not introduce a second hidden data model.

Table and TreeView no longer maintain parallel private Designer-selection variables. Their special adapters use the shared `web/designer-selection.js` layer, which keeps one adapter-aware selection state per Designer canvas, applies the common `.designer-selected` marker and emits the internal `patch-designer-selection-change` event. Ordinary controls and Tabs are bridged into the same shared primary-selection and Properties boundary through `web/designer-core-selection.js`. Designer multi-select remains an explicit transient secondary set over that primary selection. This IDE interaction state never becomes Patch application state or Change History.

GUI interaction does not implicitly persist state. Current transient event values are:

- Input, ComboBox, Radio and text-backed ListBox: text;
- Checkbox: Boolean;
- list-backed ListBox: text-list of selected display strings;
- Table: text-list for the selected row;
- TreeView: text-list for the selected root-to-node display path.

Persistent application state changes only through explicit Patch `change`. Tabs page selection remains renderer/toolkit-local unless a future language contract exposes it.

## ListBox multi-selection

The state type behind a ListBox id determines its interaction contract.

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

Table remains source-backed and selection remains transient:

```patch
window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
when people changed:
  show value
```

Selecting a Table in the Designer exposes an editable grid in Properties. Column expressions and cell expressions can be edited in place; columns and rows can be added or removed. Applying the grid rewrites the visible `table` header and `row` lines while preserving the control id, geometry and event handlers. Row width mismatch fails closed instead of silently truncating or padding data.

Table originated in Native GUI IR 0.8 / payload v9/runtime v1.0. Current payload v12/runtime v1.3 preserves its columns, rows, responsive layout policy and transient selected-row semantics.

## TreeView

TreeView hierarchy is source-backed:

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

The Designer can create a TreeView with a small starter hierarchy, select the control, move/resize it, rename its id, jump to its source and delete the complete hierarchy. The Tree nodes panel in Properties can add roots or children, rename a selected node, move it up/down, indent/outdent it and delete it. Every action rewrites ordinary visible `node` source rather than creating a hidden visual-designer document. The editor refuses to leave a TreeView with no nodes.

Selecting `compiler.js` at runtime exposes `['src', 'compiler.js']` as transient event-local `value`. Persistence occurs only because source explicitly executes `change selected`.

TreeView Stage 1 is implemented in Studio App Preview and Standalone Window Web. Direct native and token-free Ready/offline parity use Native GUI IR **1.2**, sealed payload **v12** and runtime **v1.3** on Windows, macOS and Linux.

## Tabs page and nested-control editing

Tabs page structure is also ordinary Patch source:

```patch
window "Settings":
  tabs as settings:
    tab "General":
      text "General"
      table "Name", "Value" as preferences:
        row "Theme", "System"
    tab "Advanced":
      tree as sections:
        node "Security"
          node "Keys"
```

Selecting Tabs in the Designer exposes its pages in Properties. A page can be added, renamed, moved up/down or removed. Moving a page preserves its complete nested control body. Deleting a page removes event handlers belonging to controls deleted with that page so the source cannot be left with orphan handlers. Tabs requires at least two pages, so the editor disables and rejects deletion at that boundary.

The selected page also exposes its flow-layout controls. The Designer can add Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView directly into that page, assigning globally unique ids where needed. Existing nested controls can be removed. Named handlers are removed with the deleted control, and multi-line Table rows or TreeView nodes are removed with the complete parent block rather than being orphaned.

Nested Table and TreeView receive small valid source-backed starter structures without `at/size` geometry because controls inside Tabs use flow layout. Their dedicated nested Properties editors now mirror the top-level structural workflows: Table supports editable column/cell expressions plus add/remove columns and rows, while TreeView supports add root/child, rename, move, indent/outdent and delete. Each action rewrites only the selected nested `table`/`row` or `tree`/`node` block and reparses the source before accepting it.

The nested inspector is UI convenience over the visible Patch source, not a second model. A nested Table still fails closed on row-width mismatch or zero columns, and a nested TreeView still refuses to become empty.

The editor refuses to leave a page empty and still fails closed for Tabs-inside-Tabs. Page selection remains transient renderer/toolkit state, nested controls retain their ordinary event contracts, and existing Native GUI IR/runtime contracts are unchanged.

See `docs/TABS.md` for the current Tabs syntax, native mappings, compatibility history and limitations.

## Menus and dialogs

The current native line includes structural menus, separators, portable shortcuts and source-backed Boolean `enabled` / `checked` MenuItem projections, plus informational and result-bearing Confirm/Open/Save dialogs. Menu activation does not create hidden persistent toolkit state.

The version history remains additive:

```text
Native GUI IR 0.7  base controls/dialogs
Native GUI IR 0.8  Table
Native GUI IR 0.9  Menu separators/shortcuts
Native GUI IR 1.0  Menu enabled/checked state
Native GUI IR 1.1  persistent list state + multi-select ListBox
Native GUI IR 1.2  hierarchical TreeView
```

## Direct native desktop path

Current native mappings include Win32, AppKit and GTK3 controls for the supported surface. TreeView maps to the platform TreeView/common control on Windows, `NSOutlineView` on macOS and `GtkTreeView` + `GtkTreeStore` on Linux.

Unsupported native behavior fails closed. There is no implicit Electron fallback. The separately labelled compatibility package is the only Electron-based GUI path.

## Token-free Ready runtime

Current Windows, Linux and macOS Ready Window downloads lower Native GUI IR **1.2** in the browser and seal payload **v12** into native runtime **v1.3**.

Current platform release tags are:

- `native-win32-runtime-v1.3`;
- `native-macos-runtime-v1.3`;
- `native-linux-runtime-v1.3`.

Frozen compatibility lines remain explicit: v11/runtime v1.2 for Menu+list, v10/runtime v1.1 for persistent list state, v9/runtime v1.0 for Table, and older responsive/base contracts below that. New source features are never silently encoded into older payload versions.

## Native build resilience and runtime integrity

The optional cloud/AOT path supports explicit Cancel, timeout and Retry. Retry uses the original in-memory build snapshot rather than silently rebuilding changed editor contents.

The token-free Ready path is the default. The Beta.34 runtime-template integrity mechanism now protects the current v1.3 assets:

1. Pages requires `studio-runtime-v0.6` plus all three native runtime-v1.3 releases.
2. It downloads the exact browser-consumed runtime assets.
3. It reads the SHA-256 digest recorded by GitHub Release.
4. `scripts/runtime-integrity-manifest.js` independently hashes the downloaded files and rejects mismatch.
5. Pages publishes `runtimes/runtime-manifest.json`.
6. `web/runtime-integrity.js` hashes the selected runtime again with Web Crypto before `native-build.js` may use it.

A missing entry or mismatch stops packaging. This is byte-integrity validation inside the existing release/deployment trust path, not Authenticode or Developer ID/notarization.

## Offline compiler

The downloadable compiler is the command-line counterpart to the Ready path. Current Windows/macOS/Linux `patch link` defaults to Native GUI IR **1.2**, payload **v12** and runtime **v1.3**, with responsive layout, Table, multi-select ListBox, Menu and TreeView support. Explicit payload v10/v11 compatibility remains available for older non-Tree artifacts.

The offline-compiler CI links and executes canonical responsive, Table, ListBox, Menu and TreeView apps on Windows, Linux, Apple Silicon macOS and Intel macOS before publishing the rolling download assets. FreeBSD remains Console-only through portable C99.

## PWA updates

Patch Studio derives a deterministic content revision from browser-facing pages/assets/compiler/runtime modules. Generated CSS, JavaScript, manifest and icon references carry that revision; the Service Worker uses it as the active cache identity.

Same-origin `/runtimes/` requests are fresh-first online. Successfully fetched bytes remain available only as offline fallback. The browser bundle and Service Worker include the current Native GUI IR 1.2 / sealed payload v12 dependency chain plus the source-backed TreeView Designer, resizable Designer workspace, shared primary-selection/Properties modules, compact Designer context UX, categorized control picker, active Form navigation/sizing workflow and the shared TreeView/Table/Tabs structural editor modules, including nested Text/Button/Input/Checkbox/Radio/ComboBox/ListBox/Table/TreeView insertion/removal and nested Table/TreeView structural editing for Tabs pages.

## Recovery and diagnostics

Recovery keeps deduplicated local snapshots and supports Snapshot now, Restore, Export, Delete and Clear all.

`Copy diagnostics` and `.patchreport` create local privacy-redacted support bundles. They include version, target, source size/hash, compiler state, browser/PWA state and bounded recent errors but omit project source. No diagnostics upload path exists in Studio.

## Beta.32 research boundary

The ordinary Studio does not need Lean or expose beta.32 proof machinery. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

The reproducible evidence set includes `GeneratedRepeatedTransitiveRuntimeCertificate.lean`. Product/UI/runtime work after beta.32 does not expand those assurance claims. Runtime capture, validator/frame reconstruction, remaining parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Production-readiness additions

The current Studio/repository includes stable `PATCHxxxx` diagnostics, versioned CLI JSON results, recovery, deterministic release manifests, SHA-256 runtime verification, CodeQL/security checks, compiler fuzzing, differential backend tests, Change/History/Undo/Redo property tests, source-compatibility coverage and reproducibility gates.

## Next work

TreeView Ready/offline parity, first-class TreeView Designer support, source-backed top-level TreeView/Table data editors, Tabs page editing, nested Tabs insertion/removal for Text/Button/Input/Checkbox/Radio/ComboBox/ListBox/Table/TreeView, nested Table/TreeView structural Properties editing, the shared top-level Designer selection/Properties bridge, compact Designer context UX, categorized control discovery and active Form navigation/source-backed sizing workflow are complete.

Highest-value remaining Studio work is removing the final historical `playground.js` selection mirror/fallback paths, then broader data-control/container polish and additional accessibility/keyboard refinement. Distribution work remains installer/uninstall formats, real credentialed Windows signing evidence, real macOS signing/notarization evidence, more self-contained Linux packaging where justified, FreeBSD native GUI and a fresh remote native build service that does not require a user-supplied GitHub token.

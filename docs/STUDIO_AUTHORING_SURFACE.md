# Patch Studio current authoring surface

Status: **0.2.0-beta.36+** current source-backed Studio authoring surface.

This document is the compact inventory for the visual Designer workflows available for the current Patch component vocabulary. It does not introduce a second application model and does not widen the formal assurance contract.

## Forms

The current Form lifecycle is complete for ordinary source-backed authoring:

- add a Form;
- select and navigate Forms from the canonical Form selector;
- activate a Form from its canvas title;
- edit source-backed name, title, icon, width and height;
- resize visually;
- fit the Form to its controls;
- restore the 640×420 default size;
- duplicate the complete Form, including nested structures, fresh control ids and copied control handlers;
- delete a Form with explicit confirmation and orphan-handler cleanup;
- refuse deletion of the last remaining Form.

Duplicate/Delete activation always returns through the existing Form selector. There is no second persistent active-Form model. Multi-Form Designer rendering keeps every source-backed Form shell in the DOM but renders only the active Form at full browser cost by default.

## Visual and nonvisual components

The shared current Component Registry **0.10** workflow covers Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox and StatusBar plus nonvisual Timer and ImageList authoring.

The standard-control Stage-1 presentation layer additionally provides:

- PasswordEdit as ordinary Input plus `# @input-mode password`;
- MaskedEdit as ordinary Input plus `# @input-mask "..."`;
- CheckedListBox as list-backed ListBox plus `# @listbox-mode checked`;
- ProgressBar as number-backed Slider plus `# @slider-mode progress`;
- GroupBox as ordinary Panel plus `# @panel-mode group`;
- ScrollBox as ordinary Panel plus block-local `# @panel-scroll auto` directly inside the Panel block header.

These presentation contracts remain source-backed. PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox and ScrollBox are supported in Studio and Standalone Web. Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 deliberately fails closed for those presentation contracts rather than silently lowering them to a different native control.

ProgressBar Stage 1 is passive. It reads the same-id explicit `create number` state and has no control event. Application code changes that number only through ordinary explicit `change`; Studio/Web then re-renders the passive progress presentation.

GroupBox Stage 1 does not introduce hidden state or a second containment type. It is the existing Panel containment contract with source-backed grouped presentation; its caption is derived from the Panel id in this stage. Plain Panel and GroupBox therefore share the same child structure and explicit application-state semantics.

ScrollBox Stage 1 is an orthogonal Panel behavior rather than another component or application-state type. The block-local `# @panel-scroll auto` directive makes the existing Panel content area scroll when flow or positioned Panel Stage-2 children exceed the visible viewport. Scroll offset is transient UI state only, is retained across ordinary Studio/Web re-renders where possible, emits no Patch event and never enters Change IR or persistent application state. `# @panel-mode group` and `# @panel-scroll auto` may be combined on the same Panel.

For supported top-level visual controls, Studio provides:

- shared primary selection and common Properties actions;
- source reveal;
- property editing appropriate to the control type;
- delete;
- duplicate as a real Patch source block;
- globally unique id remapping for copied named controls;
- matching handler duplication for copied ids where the control has handlers;
- source-backed backing-state duplication for CheckedListBox and ProgressBar presets;
- pointer and keyboard positioning where the control owns geometry;
- pointer resizing where supported;
- Center H / Center V;
- Default size;
- collision-aware Auto place;
- Bring to front / Send to back plus one-step Move forward / Move backward;
- 8 px design grid with optional snap while dragging;
- live X,Y and W×H in the Designer selection summary;
- transient multi-select with shared movement and primary-relative alignment;
- source-backed Anchors and Docking where the component contract permits them;
- independent source-backed TabOrder;
- source-backed Lock Controls through `# @locked`;
- Layers/Object Tree inspection for z-order and Panel/Tabs containment.

Timer and ImageList are nonvisual and live in the nonvisual tray. StatusBar owns its bottom-docked layout. None of these IDE projections create hidden application state.

## Clipboard, duplicate and presentation metadata

The Designer clipboard uses a closed versioned source-backed contract. Clipboard v2 preserves the selected control block, relevant handlers, metadata and explicit backing-state records needed by CheckedListBox and ProgressBar. Version-1 clipboard payloads remain readable.

Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar and GroupBox metadata move with their control through delete, copy, cut, paste and duplicate. ScrollBox uses block-local Panel metadata, so its `# @panel-scroll auto` line moves atomically with the Panel block through the same lifecycle without extending the generic pre-declaration metadata grammar. Cross-project paste allocates fresh ids and explicit backing states when required instead of introducing hidden runtime storage.

## Table

Top-level and nested Tables share the same structural authoring semantics:

- edit columns and cells;
- add/remove rows and columns;
- Row Up / Down;
- Duplicate Row;
- Column Left / Right;
- Duplicate Column;
- row/column selection remains IDE state only;
- moving a column always moves its header and the corresponding cell in every row together;
- invalid row widths and invalid structures fail closed.

## TreeView

Top-level and nested TreeViews support:

- add root/child;
- rename;
- move up/down;
- indent/outdent;
- delete node;
- duplicate the selected node and its complete descendant subtree;
- keyboard roving selection and structural shortcuts;
- fail closed rather than leaving an invalid empty TreeView.

Subtree duplication is a deep copy; copied descendants do not share a hidden mutable model with the original.

## Tabs and Panel

Tabs authoring covers pages and supported controls inside pages.

Page workflows:

- add;
- rename;
- move up/down;
- delete within the minimum-page boundary;
- duplicate the complete page;
- duplicate-page id remapping for every named nested control;
- matching handler duplication for remapped ids.

Nested page-control workflows:

- add Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table and TreeView;
- remove;
- move up/down;
- duplicate;
- fresh globally unique ids for named duplicates;
- matching handler duplication;
- complete multi-line Table/TreeView blocks move or copy atomically;
- nested Table and TreeView structural editors use the same source-backed semantics as their top-level counterparts.

Tabs-inside-Tabs remains intentionally outside the current stage and fails closed.

Panel Stage 2 supports source-backed child coordinates relative to the Panel content area in Studio and Standalone Web, including mixed legacy-flow and positioned children. GroupBox Stage 1 reuses this Panel child contract and adds `# @panel-mode group` presentation plus a dedicated Studio palette/Inspector path. ScrollBox Stage 1 reuses the same containment contract with block-local `# @panel-scroll auto`, a dedicated Studio palette/Inspector path, automatic overflow and a bounded transient scroll-position cache. Current Ready native fails closed for GroupBox presentation, ScrollBox behavior and positioned Panel children because Native GUI IR 1.9 does not yet define those presentation/scrolling/true parent-child containment and clipping semantics.

## Graphics and resources

Project bundle v4 contains an explicit bounded resource store. Picture references logical `patch-resource:<id>` values rather than machine-local file paths. Resource Manager supports PNG, JPEG, WebP and SVG project assets, stable ids, hashes, preview, project persistence and drag/Place-on-Form Picture authoring.

Picture has Studio, Standalone Web and current bounded native PNG/JPEG support under `native-picture-formats/1.0`. Object Inspector can edit Picture source, fit, proportional sugar, center, opacity and accessible description. Unsupported native format/property combinations fail closed; native WebP/SVG remain deferred.

Shape has Studio, Standalone Web and current native Ready support. PaintBox has Studio, Standalone Web and current native Ready support for `clear`, `line`, `rectangle`, `ellipse`, `text` and bounded PNG/JPEG project-resource `draw image`, preserved in Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10.

ImageList provides ordered named project-resource entries. Buttons bind one item with `image list.item` on Studio/Web and Current Ready Windows/macOS/Linux. Forms may declare source-backed `icon` under `window-icon/1.0`; Studio/Web package Form chrome and application favicon, while Current Ready Windows/macOS/Linux carries the icon through Native GUI IR 1.9 / payload v19 / runtime v1.10 and the platform-specific package contracts.

## Selection, Properties and keyboard boundary

`web/designer-selection.js` is the authoritative primary-selection store. `web/designer-core-selection.js` owns common Apply/Delete/Source behavior for the shared top-level surface. There is no private `playground.js` control-selection mirror.

The Properties workspace is resizable/collapsible, exposes source-backed dirty/current status, has structural summaries and filters, and maintains keyboard focus after supported structural rewrites. Filters and focus state are transient IDE state only.

The current structural/nested keyboard refinement is documented in `docs/STUDIO_KEYBOARD_ACCESSIBILITY.md`: Tree/Tabs roving selection, structural shortcuts, `Ctrl/Cmd+Enter` commits, Escape close/focus restoration and explicit focus-visible treatment are implemented. Manual screen-reader/assistive-technology verification remains a separate validation activity rather than an unimplemented keyboard feature.

Studio source edits and Designer source rewrites participate in a bounded source-backed Undo/Redo history. Trusted typing coalesces; Designer rewrites remain atomic. Project/resource replacement boundaries reset history so stale source is never replayed into a different project. Remaining resource/non-source transaction coverage is an extension of the same model rather than a separate hidden history.

## Source and semantic boundary

Visual authoring never creates a hidden `.frm`, `.dfm`, second control tree or persistent designer application model. Authoring commands rewrite ordinary visible `.patch` source and reparse it before accepting structural edits. Project resources are the explicit project-v4 exception because binary asset bytes do not belong in source text.

Handler duplication changes only the `when <id> ...:` target when an id is copied. Handler bodies are preserved verbatim; Studio does not silently reinterpret semantic references inside those bodies.

Application persistence still occurs only through ordinary Patch semantic `change` operations. Designer selection, filters, active nested editors, scroll offsets and other authoring/runtime view state do not become Patch application state or Change History entries.

Slider `changed` exposes a bounded finite numeric transient `value`. List-backed ListBox exposes a transient text-list selection, Table exposes the selected row as a transient text list, and TreeView exposes the selected root-to-node display path as a transient text list. None of those renderer/toolkit values implicitly persist application state. ProgressBar and ScrollBox expose no events at all.

PaintBox `paint` is a pure drawing event. It cannot commit persistent `change`; state-dependent native drawing is refreshed from ordinary application state.

## Native delivery boundary

The Current Ready desktop consumer contract is Native GUI IR **1.9**, sealed payload **v19** and runtime **v1.10** on Windows, macOS and Linux. It preserves the prior Table, text-list/ListBox, Menu, TreeView, Slider, Chrome, Shape and PaintBox lines and adds the promoted Button/ImageList and Window-icon transport/consumer stack.

Payload v17/runtime v1.8 remains an explicit compatibility path in the Offline Compiler. Earlier versioned contracts, including the frozen Native GUI IR **1.2** / payload **v12** / runtime **v1.3** TreeView line, remain compatibility/reproducibility evidence rather than current targets.

Memo/TextArea, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox and positioned Panel-child Stage-2 semantics do not silently widen Native GUI IR 1.9. Unsupported selected-contract features fail closed until a new explicit native contract is implemented, released, digest-verified and promoted.

The current Ready/offline Windows, macOS and Linux path uses the stable `native-current-contract.js` facade. FreeBSD remains Console-only.

## Public/offline delivery

The current authoring modules are part of the deterministic content-addressed public Patch Studio build and Offline Studio package. The generated site validates both the transitive relative ES-module import closure and the local HTML JS/CSS/manifest/icon asset closure, so a browser dependency cannot be omitted silently.

The canonical multi-file Project-v4 **Patch Studio Showcase** is explicitly selectable in hosted and Offline Studio and covers the complete current Registry 0.10 Studio/Web acceptance surface. Workshop Desk remains the compact Current Ready native acceptance/stress application.

Large-project work includes a deterministic 10-Form / 200-control benchmark, parsed-model reuse, observer reconciliation batching, active-Form full-cost rendering, Chrome startup/Workshop stress and event-to-paint performance gates. Further virtualization remains measurement-driven work rather than a completed guarantee.

## What “complete” means here

This is the complete current authoring surface for the **existing Patch UI/control vocabulary**. It does not mean every Delphi/Visual Basic class of IDE feature or standard control already exists.

Remaining product work includes:

- new/richer data controls beyond the current Table, ListBox and TreeView vocabulary;
- Number/SpinEdit, date/time controls, SplitContainer and richer shell controls from the RAD master backlog;
- Panel child Anchors/Dock, nested Panels, visual reparenting and later explicit native containment;
- remaining resource/non-source Undo/Redo transaction coverage, further large-project virtualization and professional code-editor/debugger features;
- broader ImageList consumers such as ToolBar/ToolButton/Menu/Tree only after those component contracts exist;
- application branding and richer packaging/signing workflows;
- manual assistive-technology verification with Narrator, VoiceOver, Orca or comparable tools, which makes no WCAG conformance claim;
- distribution work such as installer/uninstaller formats and credentialed signing evidence.

Current contracts remain Patch **0.2.0-beta.36**, Studio project bundle **v4**, Component Registry **0.10**, Change IR **0.10**, Native GUI IR **1.9**, sealed payload **v19**, token-free Ready/offline runtime **v1.10**, with payload v17/runtime v1.8 retained as explicit compatibility and Native GUI IR **1.2** / payload **v12** / runtime **v1.3** preserved as the frozen TreeView compatibility line. The formal runtime-correspondence milestone remains **beta.32**.

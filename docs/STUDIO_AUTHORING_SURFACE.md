# Patch Studio current authoring surface

Status: **0.2.0-beta.36+** current source-backed Studio authoring surface.

This document is the compact inventory for the visual Designer workflows available for the current Patch component vocabulary. It does not introduce a second application model and does not widen the formal assurance contract.

## Forms

The current Form lifecycle is complete for ordinary source-backed authoring:

- add a Form;
- select and navigate Forms from the canonical Form selector;
- activate a Form from its canvas title;
- edit source-backed name, title, width and height;
- resize visually;
- fit the Form to its controls;
- restore the 640×420 default size;
- duplicate the complete Form, including nested structures, fresh control ids and copied control handlers;
- delete a Form with explicit confirmation and orphan-handler cleanup;
- refuse deletion of the last remaining Form.

Duplicate/Delete activation always returns through the existing Form selector. There is no second persistent active-Form model.

## Visual and nonvisual components

The shared top-level workflow covers Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView and Tabs. beta.36 additionally exposes Panel, Picture, Shape, PaintBox and StatusBar plus nonvisual Timer and ImageList authoring through the same project/Designer architecture.

For supported top-level visual controls, Studio provides:

- shared primary selection and common Properties actions;
- source reveal;
- property editing appropriate to the control type;
- delete;
- duplicate as a real Patch source block;
- globally unique id remapping for copied named controls;
- matching handler duplication for copied ids;
- pointer and keyboard positioning where the control owns geometry;
- pointer resizing where supported;
- Center H / Center V;
- Default size;
- collision-aware Auto place;
- Bring to front / Send to back;
- 8 px design grid with optional snap while dragging;
- live X,Y and W×H in the Designer selection summary;
- transient multi-select with shared movement and primary-relative alignment;
- source-backed Anchors and Docking where the component contract permits them.

Timer and ImageList are nonvisual and live in the nonvisual tray. StatusBar owns its bottom-docked layout. None of these IDE projections create hidden application state.

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

## Tabs

Tabs authoring covers both pages and controls inside pages.

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

## Graphics and resources

Project bundle v4 contains an explicit bounded resource store. Picture references logical `patch-resource:<id>` values rather than machine-local file paths. Resource Manager supports PNG, JPEG, WebP and SVG project assets, stable ids, hashes, preview and project persistence.

Picture has Studio, Standalone Web and current bounded native PNG/JPEG support. Object Inspector can edit Picture source, fit, proportional sugar, center, opacity and accessible description. Native GUI IR 1.4 keeps default contain/centered/opaque PictureBox display and fail-closes other fit/center/opacity values. Shape and PaintBox have Studio plus Standalone Web support while native runtime support remains explicitly fail-closed. ImageList Stage 1 provides ordered named project-resource entries but remains authoring-only until a real control consumer is versioned and tested.

## Selection, Properties and keyboard boundary

`web/designer-selection.js` is the authoritative primary-selection store. `web/designer-core-selection.js` owns common Apply/Delete/Source behavior for the shared top-level surface. The old `playground.js` selection mirror and Table/TreeView Inspector fallbacks are gone.

The Properties workspace is resizable/collapsible, exposes source-backed dirty/current status, has structural summaries and filters, and maintains keyboard focus after supported structural rewrites. Filters and focus state are transient IDE state only.

The current structural/nested keyboard refinement is documented in `docs/STUDIO_KEYBOARD_ACCESSIBILITY.md`: Tree/Tabs roving selection, structural shortcuts, `Ctrl/Cmd+Enter` commits, Escape close/focus restoration and explicit focus-visible treatment are implemented. Manual screen-reader/assistive-technology verification remains a separate validation activity rather than an unimplemented keyboard feature.

## Source and semantic boundary

Visual authoring never creates a hidden `.frm`, `.dfm`, second control tree or persistent designer application model. Authoring commands rewrite ordinary visible `.patch` source and reparse it before accepting structural edits. Project resources are the explicit project-v4 exception because binary asset bytes do not belong in source text.

Handler duplication changes only the `when <id> ...:` target when an id is copied. Handler bodies are preserved verbatim; Studio does not silently reinterpret semantic references inside those bodies.

Application persistence still occurs only through ordinary Patch semantic `change` operations. Designer selection, filters, active nested editors and other authoring state do not become Patch application state or Change History entries.

Slider `changed` exposes a bounded finite numeric transient `value`. List-backed ListBox exposes a transient text-list selection, Table exposes the selected row as a transient text list, and TreeView exposes the selected root-to-node display path as a transient text list. None of those renderer/toolkit values implicitly persist application state.

## Native delivery boundary

The current desktop consumer contract is Native GUI IR **1.4**, sealed payload **v14** and runtime **v1.5**. It preserves Table, text-list/ListBox, Menu, TreeView and Slider semantics and adds the current Chrome Stage 1 Panel, Timer, Picture and StatusBar transport.

The prior Slider compatibility line is Native GUI IR **1.3** / payload **v13** / runtime **v1.4**. Native GUI IR **1.2** / payload **v12** / runtime **v1.3** remains the frozen TreeView compatibility line. Unsupported selected-contract features fail closed instead of being silently dropped.

The current Ready/offline Windows, macOS and Linux path uses the same stable `native-current-contract.js` facade. FreeBSD remains Console-only.

## Public/offline delivery

The current authoring modules are part of the deterministic content-addressed public Patch Studio build and the offline PWA cache. The generated site validates both the transitive relative ES-module import closure and the local HTML JS/CSS/manifest/icon asset closure, so a browser dependency cannot be omitted silently. Studio-only authoring additions remain in `web/` so they do not unnecessarily trigger native-runtime build matrices.

## What “complete” means here

This is the complete current authoring surface for the **existing Patch UI/control vocabulary**. It does not mean every Delphi/Visual Basic class of IDE feature or standard control already exists.

Remaining product work includes:

- new/richer data controls beyond the current Table, ListBox and TreeView vocabulary;
- Memo/TextArea, ProgressBar, Number/SpinEdit, date/time controls and richer shell controls from the RAD master backlog;
- true independent TabOrder and richer container/layout semantics;
- Undo/Redo transactions, large-project performance work and professional code-editor/debugger features;
- native Shape/PaintBox parity and the first real ImageList consumer;
- application icons/branding and richer packaging/signing workflows;
- manual assistive-technology verification with Narrator, VoiceOver, Orca or comparable tools, which makes no WCAG conformance claim;
- distribution work such as installer/uninstaller formats and credentialed signing evidence.

Current contracts remain Patch **0.2.0-beta.36**, Studio project bundle **v4**, Component Registry **0.8**, Change IR **0.10**, Native GUI IR **1.4**, sealed payload **v14**, token-free Ready/offline runtime **v1.5**, with Native GUI IR **1.2** / payload **v12** / runtime **v1.3** preserved as frozen TreeView compatibility and the formal runtime-correspondence milestone remaining **beta.32**.

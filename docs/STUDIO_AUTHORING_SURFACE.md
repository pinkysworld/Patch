# Patch Studio current authoring surface

Status: **0.2.0-beta.35+** current source-backed Studio authoring surface.

This document is the compact inventory for the visual Designer workflows available for the **existing Patch control set**. It does not introduce a new language or runtime contract.

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

## Top-level controls

The Designer exposes Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table, TreeView and Tabs through the same source-backed toolbox/discovery boundary. Slider Stage 1 is additionally exposed through that same boundary.

For the supported top-level controls, Studio provides:

- shared primary selection and common Properties actions;
- source reveal;
- property editing appropriate to the control type;
- delete;
- duplicate as a real Patch source block;
- globally unique id remapping for copied named controls;
- matching handler duplication for copied ids;
- pointer and keyboard positioning;
- pointer resizing;
- Center H / Center V;
- Default size;
- collision-aware Auto place;
- transient multi-select with shared movement and primary-relative alignment.

Slider Stage 1 additionally exposes source-backed id, minimum, maximum and step Properties plus live range preview. Slider interaction is transient and numeric; persistence still requires explicit Patch `change`.

Duplicated Tabs remap ids for controls nested in all pages as well as the Tabs id itself. Table rows and TreeView hierarchies are copied with their complete parent source block.

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

- add Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView, plus Slider Stage 1;
- remove;
- move up/down;
- duplicate;
- fresh globally unique ids for named duplicates;
- matching handler duplication;
- complete multi-line Table/TreeView blocks move or copy atomically;
- nested Table and TreeView structural editors use the same source-backed semantics as their top-level counterparts.

Tabs-inside-Tabs remains intentionally outside the current stage and fails closed.

## Selection, Properties and keyboard boundary

`web/designer-selection.js` is the authoritative primary-selection store. `web/designer-core-selection.js` owns common Apply/Delete/Source behavior for the shared top-level surface. The old `playground.js` selection mirror and Table/TreeView Inspector fallbacks are gone.

The Properties workspace is resizable/collapsible, exposes source-backed dirty/current status, has structural summaries and filters, and maintains keyboard focus after supported structural rewrites. Filters and focus state are transient IDE state only.

The current structural/nested keyboard refinement is documented in `docs/STUDIO_KEYBOARD_ACCESSIBILITY.md`: Tree/Tabs roving selection, structural shortcuts, `Ctrl/Cmd+Enter` commits, Escape close/focus restoration and explicit focus-visible treatment are implemented. Manual screen-reader/assistive-technology verification remains a separate validation activity rather than an unimplemented keyboard feature.

## Source and semantic boundary

Visual authoring never creates a hidden `.frm`, `.dfm`, second control tree or persistent designer application model. Authoring commands rewrite ordinary visible `.patch` source and reparse it before accepting structural edits.

Handler duplication changes only the `when <id> ...:` target when an id is copied. Handler bodies are preserved verbatim; Studio does not silently reinterpret semantic references inside those bodies.

Application persistence still occurs only through ordinary Patch semantic `change` operations. Designer selection, filters, active nested editors and other authoring state do not become Patch application state or Change History entries.

Slider `changed` exposes a bounded finite numeric transient `value`. List-backed ListBox exposes a transient text-list selection, Table exposes the selected row as a transient text list, and TreeView exposes the selected root-to-node display path as a transient text list. None of those renderer/toolkit values implicitly persist application state.

## Public/offline delivery

The current authoring modules are part of the deterministic content-addressed public Patch Studio build and the offline PWA cache. Studio-only authoring additions remain in `web/` so they do not unnecessarily trigger native-runtime build matrices.

## What “complete” means here

This is the complete current authoring surface for the **existing Patch UI/control vocabulary**, now including Slider Stage 1. It does not mean every conceivable IDE feature exists.

The former ordinary product-backlog items for a richer data-control surface and structural/nested keyboard refinement are closed by Slider Stage 1 plus the implemented keyboard/focus milestone. Any new/richer data controls beyond the current Table, ListBox and TreeView vocabulary are future/new product milestones rather than missing beta.35 implementation. Slider Stage 1 is the completed current numeric-range addition. Remaining work is deliberately separated by dependency:

- **native Slider parity** requires a future versioned Native GUI IR/backend/payload/runtime contract rather than redefining v1.3;
- **manual assistive-technology verification with Narrator, VoiceOver, Orca** or comparable tools remains an external validation gate and makes no WCAG conformance claim;
- **distribution work such as installer/uninstaller formats** requires a concrete packaging decision plus release/signing evidence and is not missing current Studio authoring implementation;
- **credentialed distribution evidence** requires real Windows/macOS signing identities and installer/release-channel decisions;
- **research/evaluation gates** such as controlled fixed-hardware measurements and genuine third-party integration evidence remain outside Studio authoring.

Current contracts remain Patch **0.2.0-beta.35**, Change IR **0.10**, Native GUI IR **1.2**, sealed payload **v12**, token-free Ready/offline runtime **v1.3**, with the formal runtime-correspondence milestone remaining **beta.32**.
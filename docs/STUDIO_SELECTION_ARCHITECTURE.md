# Patch Studio Designer selection architecture

This document records the current top-level Designer selection architecture in Patch Studio 0.2 beta.36.

## Authoritative shared boundary

`web/designer-selection.js` owns one transient primary-selection record per Designer canvas. The record contains:

- `windowIndex`;
- `controlIndex`;
- an adapter identity (`core`, `table` or `tree`);
- the current control id when one exists.

Selection identity is location + adapter. Renaming an id therefore does not lose the selected control.

The shared layer applies the common `.designer-selected` DOM marker and emits the internal `patch-designer-selection-change` event when the primary selection changes.

There is no longer a private `playground.js` control-selection mirror. The renderer creates the visual controls and Inspector DOM shell, but it does not own selection, mutate source for Properties actions, or repopulate Properties from private state.

## Core bridge

`web/designer-core-selection.js` bridges the ordinary Designer controls into the same store:

- Text;
- Button;
- Input;
- Checkbox;
- Radio;
- ComboBox;
- ListBox;
- Tabs.

Table and TreeView use the same store through their special rendering adapters.

The core bridge owns the normal Properties action boundary for every active shared selection. Apply, Delete and Source resolve the currently selected source-backed control from the shared selection record. The former Table/TreeView Inspector fallback listeners have been removed, so there is one Properties action path rather than layered compatibility handlers.

Toolbox additions for ordinary controls remain source-backed through `forms-designer.js` and are reconciled into shared selection after the Designer rerenders. Table and TreeView keep their dedicated source-backed add/render adapters, then publish the same shared selection record. A selection that points to a removed control is cleared fail-closed.

The shared bridge never adopts renderer-only `.designer-selected` markers. Primary state may come only from the shared selection API, an actual selection action, or an explicit source-backed toolbox-add reconciliation path.

## Source-to-Designer navigation synchronization

`studio-source-designer-sync/0.1` extends `web/designer-core-selection.js` with a narrow source-navigation bridge. It does not create a second selection store.

When the source editor has focus, a pointer selection or navigation-key movement is considered only when the cursor resolves unambiguously to one of two source-backed targets:

- the declaration line of a top-level Designer control returned by `listDesignerControls()`;
- a `when <control> <event>:` handler whose control id resolves to one of those source-backed controls.

A matching target updates the existing shared Designer selection through `designerSelectionForControl()` and `selectDesignerElement()`. If the control belongs to another Form, the existing Form selector is changed first and selection is applied after the active Form has materialized. A recognized event handler also activates the existing Object Inspector Events view so the Form / Control / Event navigation context stays coherent.

The synchronization deliberately does **not** clear or guess Designer selection for arbitrary source lines, comments, state declarations, recipes or temporarily invalid source. It never writes Patch source and it never moves focus out of the source editor. Project/symbol quick-open can explicitly request the same synchronization through the existing `patch:studio-quick-open` event.

## Renderer boundary

`web/playground.js` now has a deliberately narrower Designer role:

- render Window/Form preview DOM;
- create the Inspector DOM shell consumed by the shared Properties bridge;
- expose stable Designer control metadata (`data-window-index` / `data-control-index`) for later enhancement layers;
- render App Preview and runtime interactions.

It does **not** import `addDesignerControl`, `updateDesignerControl`, `removeDesignerControl` or `listDesignerControls`, and it has no private `designerSelection`, `currentDesignerControl`, `selectDesignerControl`, `renderDesignerInspector` or renderer-owned Apply/Delete/Source handlers.

This keeps source mutation in the dedicated source-backed Designer modules rather than the generic renderer.

## Form layout synchronization

`web/forms-designer.js` listens directly for `patch-designer-selection-change`. Geometry fields and the common resize handle therefore follow shared selection without depending on a full renderer refresh or DOM-marker tricks.

The layout layer removes stale resize handles before applying the current primary selection, so clearing or moving selection does not leave a handle attached to an old control.

## Current Designer context UX

`web/designer-ux.js` is an IDE-only presentation layer over the same shared selection and source-backed Form model. It does not introduce a second application model.

The Designer toolbar exposes a compact selection context that shows the selected control type, id, Form and multi-select count. `Focus selected` centers the active control in the scrollable canvas; when nothing is selected the same action focuses the active Form. `Clear` and Escape clear the shared primary selection without changing Patch source.

The Form toolbar keeps the active Form selector and Add Form action visible while moving Name, Title, Width, Height and Apply into a compact Form settings popover. The open/closed state of that popover is an IDE preference stored locally and is not Patch application state.

The active Form is highlighted in the canvas and Form titles are pointer/keyboard activatable. Previous/next actions plus Alt+PageUp / Alt+PageDown navigate named Forms. `Fit controls` and `Default 640×420` rewrite ordinary source-backed Form dimensions through the existing Designer source updater.

Properties distinguishes the selected control type in its heading and reports whether common source-backed fields are already current or have pending edits. The common Apply action is disabled when there is nothing to apply. Structural Table, TreeView and Tabs editors retain their dedicated source-backed actions and the shared Structural Properties UX.

These UX additions are packaged in the public Studio and offline PWA. They do not change source semantics or runtime contracts.

## Multi-select

Designer multi-select remains a separate transient extension over the primary selection. The shared selection record identifies the primary control. `designer-multiselect.js` keeps the additional selected-control set used for group movement and alignment.

This does not create application state. It is only IDE interaction state.

## Persistence boundary

Designer selection, structural editor selection, Tabs page selection and source-navigation synchronization are transient UI state. They are not Patch state and do not enter Change History.

Persistent application state changes only through ordinary semantic `change` operations in Patch source.

## Completed migration invariant

The top-level Designer now has one authoritative primary-selection and common Properties boundary across core controls, Tabs, Table and TreeView. Special adapters may still own rendering details or structural editing, but they do not own competing primary-selection variables or Inspector Apply/Delete/Source handlers.

Any future control adapter should publish selection through `designer-selection.js`, let `designer-core-selection.js` resolve common Properties actions, and keep additional editor-specific state transient and source-backed.

## Contract boundary

This is Patch Studio editor architecture only. It does not change Patch syntax, Change IR **0.10**, Current Ready Native GUI IR **1.9** / payload **v19** / runtime **v1.10**, or any frozen/explicit compatibility line such as payload v17/runtime v1.8 and the older payload v12/runtime v1.3 TreeView contract.

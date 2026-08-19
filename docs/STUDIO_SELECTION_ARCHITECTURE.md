# Patch Studio Designer selection architecture

This document records the current top-level Designer selection migration in Patch Studio 0.2 beta.35+.

## Current shared boundary

`web/designer-selection.js` owns one transient selection record per Designer canvas. The record contains:

- `windowIndex`;
- `controlIndex`;
- an adapter identity (`core`, `table` or `tree`);
- the current control id when one exists.

Selection identity is location + adapter. Renaming an id therefore does not lose the selected control.

The shared layer applies the common `.designer-selected` DOM marker and emits the internal `patch-designer-selection-change` event when the primary selection changes.

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

Table and TreeView already use the same store through their special rendering adapters.

The core bridge also owns the normal Properties action boundary for the active shared selection. Apply, Delete and Source therefore resolve the currently selected source-backed control from the shared selection record rather than requiring separate Table/Tree inspector state. Table and TreeView keep their older inspector listeners as compatibility fallbacks during the migration, but the common bridge is loaded first and handles the normal Studio path.

Toolbox additions for ordinary controls are reconciled back into the shared selection after the source-backed Designer rerenders. A selection that points to a removed core control is cleared fail-closed.

The shared core bridge no longer adopts renderer-only `.designer-selected` markers. Its primary state may come only from the shared selection API, an actual selection action, or the explicit toolbox-add reconciliation path. This makes the migration one-way: the historical renderer can still mirror selection visually, but it cannot silently recreate shared selection state from a stale DOM class.

## Current Designer context UX

`web/designer-ux.js` is an IDE-only presentation layer over the same shared selection and source-backed Form model. It does not introduce a second application model.

The Designer toolbar exposes a compact selection context that shows the selected control type, id, Form and multi-select count. `Focus selected` centers the active control in the scrollable canvas; when nothing is selected the same action focuses the active Form. `Clear` and Escape clear the shared primary selection without changing Patch source.

The Form toolbar keeps the active Form selector and Add Form action visible while moving Name, Title, Width, Height and Apply into a compact Form settings popover. The open/closed state of that popover is an IDE preference stored locally and is not Patch application state.

The active Form is highlighted in the canvas and Form titles are pointer/keyboard activatable. Previous/next actions plus Alt+PageUp / Alt+PageDown navigate named Forms. `Fit controls` and `Default 640×420` rewrite ordinary source-backed Form dimensions through the existing Designer source updater.

Properties distinguishes the selected control type in its heading and reports whether common source-backed fields are already current or have pending edits. The common Apply action is disabled when there is nothing to apply. Structural Table, TreeView and Tabs editors retain their dedicated source-backed actions.

These UX additions are packaged in the public Studio and offline PWA. They do not change source semantics or runtime contracts.

## Multi-select

Designer multi-select remains a separate transient extension over the primary selection. The shared selection record identifies the primary control. `designer-multiselect.js` keeps the additional selected-control set used for group movement and alignment.

This does not create application state. It is only IDE interaction state.

## Persistence boundary

Designer selection, structural editor selection and Tabs page selection are transient UI state. They are not Patch state and do not enter Change History.

Persistent application state changes only through ordinary semantic `change` operations in Patch source.

## Remaining migration work

The historical `playground.js` renderer private `designerSelection` mirror still exists for its internal rerender path. It is no longer a source of truth for the shared core selection, and the core bridge does not recover selection from its DOM marker.

A later dedicated rewrite should:

1. remove the private `designerSelection` variable and the renderer-only selection helper functions from `playground.js`;
2. leave `playground.js` responsible only for rendering and creating the Inspector DOM shell;
3. remove now-dead Table/Tree inspector fallback listeners after the shared path has been proven stable;
4. keep multi-select as an explicit secondary-set layer over the shared primary selection.

Until those final compatibility paths are deleted, documentation should describe the architecture as one authoritative shared primary-selection/Properties boundary with a remaining legacy renderer mirror, not as total removal of every historical selection implementation.

## Contract boundary

This is Patch Studio editor architecture only. It does not change Patch syntax, Change IR 0.10, Native GUI IR 1.2, sealed payload v12, runtime v1.3 or the beta.32 formal runtime-correspondence claim.

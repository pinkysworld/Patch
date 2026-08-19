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

## Multi-select

Designer multi-select remains a separate transient extension over the primary selection. The shared selection record identifies the primary control. `designer-multiselect.js` keeps the additional selected-control set used for group movement and alignment.

This does not create application state. It is only IDE interaction state.

## Persistence boundary

Designer selection, structural editor selection and Tabs page selection are transient UI state. They are not Patch state and do not enter Change History.

Persistent application state changes only through ordinary semantic `change` operations in Patch source.

## Remaining migration work

The historical `playground.js` renderer still keeps a private `designerSelection` mirror for its internal rerender path. The shared store is now the cross-adapter canvas/Properties boundary, but that legacy mirror has not yet been deleted.

A later cleanup should:

1. move the remaining `playground.js` render lookup directly onto the shared selection API;
2. remove the private `designerSelection` variable and its helper functions;
3. remove now-dead Table/Tree inspector fallback listeners after the shared path has been proven stable;
4. keep multi-select as an explicit secondary-set layer over the shared primary selection.

Until those steps are complete, documentation should describe the work as a shared top-level selection/Properties bridge, not as total removal of every historical selection implementation.

## Contract boundary

This is Patch Studio editor architecture only. It does not change Patch syntax, Change IR 0.10, Native GUI IR 1.2, sealed payload v12, runtime v1.3 or the beta.32 formal runtime-correspondence claim.

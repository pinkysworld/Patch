# Native TreeView v1.3

Patch direct-native TreeView support is a versioned extension of the Stage 1 browser contract.

## Contract

- Native GUI IR **1.2** adds `tree` controls with recursive source-backed nodes.
- Win32, AppKit and GTK direct-AOT backends **1.3** consume that contract.
- `changed` exposes the selected node as the full root-to-node **text-list path**.
- Toolkit selection is transient. Persistent Patch state changes only through explicit semantic `change` operations.
- Scalar state interpolation in node text templates is projected into native labels during `RefreshUI`; list-state interpolation fails closed.
- Backend compatibility shadows are private implementation details and are removed from generated native source before it is returned.

## Platform widgets

| Platform | Native widget |
| --- | --- |
| Windows | Win32 common-controls `WC_TREEVIEWW` |
| macOS | AppKit `NSOutlineView` |
| Linux | GTK3 `GtkTreeView` + `GtkTreeStore` |

The direct build planner automatically selects the `tree-v13` tier when Patch source contains a TreeView. Existing Native GUI IR <= 1.1 and backend <= 1.2 contracts are unchanged.

## Example

`examples/treeview-window.patch` exercises hierarchy, scalar source-backed labels and explicit persistence of the selected path.

## Sealed Ready/offline boundary

This slice does **not** repurpose the current sealed payload v11/runtime v1.2 contract. Token-free Ready/offline TreeView support requires a separate additive sealed payload/runtime version so older sealed artifacts remain reproducible.

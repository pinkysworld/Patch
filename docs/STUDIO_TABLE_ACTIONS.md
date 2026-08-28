# Patch Studio Table row and column actions

Patch Studio exposes the same source-backed Table row/column operations for a top-level Table and for a Table nested inside a Tabs page.

## Actions

The Table structural Properties editor adds a compact row/column action surface:

- **Row Up / Down** moves the selected complete row.
- **Duplicate Row** inserts an independent copy directly after the selected row.
- **Column Left / Right** moves the selected column header together with the corresponding cell in every row.
- **Duplicate Column** inserts a copy of the selected header expression and every corresponding cell directly after it.

The row and column selectors are transient IDE selection only. They are not Patch application state and are not written to Change History.

## Source-backed contract

Every action starts from the current values visible in the Table grid and rewrites the existing visible `table` / `row` source block through the established Designer data APIs.

There is no second persistent Table model. Top-level Tables use `updateDesignerTableData`; nested Tables use `updateDesignerTabPageTableData`. Both consume the same immutable Studio-only operation helpers from `web/designer-table-model.js`.

A moved column is atomic at the structural level: its header and the matching cell in every row always move together. Duplicate operations create copied arrays before rewrite so later editing cannot mutate the original row through shared JavaScript references.

Keeping the helper in the Studio web layer is intentional: these are authoring operations, not runtime semantics, so a Designer-only change does not need to trigger native runtime distribution workflows.

## Boundaries

Moving the first row up, the last row down, the first column left or the last column right is a deterministic no-op. Invalid selections, malformed row widths, empty column expressions and unsupported directions fail closed.

A Table may have zero data rows, so row actions are disabled in that state. A Table always has at least one column; column duplication remains available even for a one-column Table while left/right movement is disabled at the boundary.

## Compatibility

These are Patch Studio authoring operations only. They do not change Patch syntax, Change IR 0.10, the current Native GUI IR 1.5 / payload v15 / runtime v1.6 product line, the frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line or the beta.32 formal-assurance boundary. The previous Native GUI IR 1.3 / payload v13 / runtime v1.4 Slider line remains compatibility evidence.

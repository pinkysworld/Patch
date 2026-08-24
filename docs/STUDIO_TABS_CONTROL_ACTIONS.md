# Patch Studio Tabs page control actions

Patch Studio supports source-backed reorder and duplication for controls inside a selected Tabs page.

## Actions

Each row in **Page controls** exposes:

- **Up** — moves the complete control source block before its previous sibling.
- **Down** — moves the complete control source block after its next sibling.
- **Duplicate** — inserts a complete copy immediately after the original.

The actions operate on Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView controls supported by the current nested Tabs Designer.

## Complete source blocks

Table rows and TreeView node hierarchies are part of the control block. Reorder and Duplicate therefore move or copy the complete multi-line structure rather than only the header line.

Boundary moves are deterministic no-ops. Invalid page/control indexes, unsupported nested control kinds and unsupported move directions fail closed.

## Named controls and handlers

When a duplicated control has an id, Studio assigns the copy a fresh globally unique id using the existing control-type naming convention. Matching `when <old-id> ...:` event blocks are duplicated with the new target id while preserving their bodies.

The original control and original handlers remain unchanged. Unnamed controls require no id rewrite.

## Inspector safety

Nested Table and TreeView structural editors internally refer to their control position inside the page. Before a reorder or duplication, Patch Studio closes any currently open nested structure editor so an old numeric position can never point at the wrong control after the source rewrite.

After the edit, keyboard focus is restored to the corresponding action on the moved or duplicated control row. This focus bookkeeping is transient IDE state only.

## Source-backed boundary

The feature stores no hidden Form/Tabs model and does not write to application state or Change History. The authoring action rewrites ordinary visible Patch source, reparses it, and then lets the existing Designer re-render from that source.

This is Studio-only authoring work. It does not change Patch syntax, Change IR 0.10, Native GUI IR 1.3 / payload v13 / runtime v1.4, the frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line or the beta.32 formal-assurance boundary.

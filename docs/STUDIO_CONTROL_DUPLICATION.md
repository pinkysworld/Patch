# Patch Studio selected-control duplication

Patch Studio exposes **Duplicate** in the shared Properties actions for one selected top-level Designer control.

## Supported controls

The action works for the complete current top-level Designer surface:

- Text;
- Button;
- Input;
- Checkbox;
- Radio;
- ComboBox;
- ListBox;
- Table;
- TreeView;
- Tabs.

The copied control is inserted directly after the original in visible Patch source and becomes the new shared primary Designer selection.

## Complete source-backed copy

Duplicate copies the complete source block rather than the rendered DOM element. This means Table rows, TreeView node hierarchies, and all Tabs pages/nested controls are preserved.

A control with explicit `at X, Y size W, H` geometry is normally offset by 16 px in both axes so the new control is immediately visible. If that positive offset would clip the copy against the Form boundary, Studio tries the corresponding negative offset instead. It never adds hidden layout state.

## Unique ids and event handlers

Every named control in the copied source block receives a fresh globally unique type-based id. For a duplicated Tabs container, this includes both the outer Tabs id and every named nested control on every page.

Matching `when <old-id> ...:` event blocks are duplicated with the new target id while preserving their bodies. The original ids and original handlers remain unchanged.

Input uses its normal `input <id>` source syntax; other named controls keep their normal `as <id>` syntax.

## Selection and multi-select

After the source rewrite, the duplicated control becomes the shared primary selection and receives keyboard focus. This is transient IDE state only.

Duplicate is intentionally disabled while more than one Designer control is selected. The current command has unambiguous single-control semantics; it does not silently choose between duplicating only the primary control and duplicating an entire multi-selection group.

## Source-backed boundary

The command reparses the rewritten source before it is accepted. It does not create a hidden Form document, does not persist Designer selection in Patch application state, and does not write IDE selection state to Change History.

This is Studio-only authoring work. It does not change Patch syntax, Change IR 0.10, Native GUI IR 1.3 / payload v13 / runtime v1.4, the frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line or the beta.32 formal-assurance boundary.

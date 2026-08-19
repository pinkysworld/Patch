# Patch Studio structural keyboard accessibility

Status: **0.2.0-beta.35+** Studio accessibility refinement. This is an editor/product capability only; it does not change Patch syntax, Change IR 0.10, Native GUI IR 1.2, sealed payload v12/runtime v1.3 or the beta.32 formal assurance boundary.

Patch Studio's source-backed structural Properties editors support keyboard-only operation for the current Table, TreeView and Tabs editing surface, including nested Table/TreeView editors inside Tabs pages.

## Roving selection lists

TreeView node lists and Tabs page lists use listbox/option semantics with one tabbable selected option at a time. Keyboard navigation is:

- `ArrowUp` / `ArrowDown`: select the previous/next option;
- `Home` / `End`: select the first/last option;
- focus remains on the selected option after a source-backed re-render.

The same behavior applies to the nested TreeView node list inside a selected Tabs page. Inactive options use roving `tabindex=-1`; the selected option remains in the normal Tab order.

## Structure shortcuts

When focus is on a TreeView node option:

- `Ctrl/Cmd + ArrowUp` / `ArrowDown`: move the node up/down;
- `Ctrl/Cmd + ArrowLeft` / `ArrowRight`: outdent/indent the node;
- `Ctrl/Cmd + Enter`: focus the node-label expression field.

When focus is on a Tabs page option:

- `Ctrl/Cmd + ArrowUp` / `ArrowDown`: reorder the page;
- `Ctrl/Cmd + Enter`: focus the page-title expression field.

The same TreeView hierarchy shortcuts apply to the nested TreeView structural editor inside Tabs.

## Apply and rename

`Ctrl/Cmd + Enter` in a source-backed structural input performs the corresponding non-destructive commit action:

- Table column or cell input: **Apply data**;
- TreeView node-label input: **Rename**;
- Tabs page-title input: **Rename**;
- nested Table column/cell input: **Apply data**;
- nested TreeView node-label input: **Rename**.

After the source rewrite, focus is restored to the corresponding editor field where possible.

## Nested editor close

Inside an expanded nested Table or TreeView structure editor, `Escape` closes the structure editor and restores focus to its **Edit** button in the page-control list.

## Focus presentation and accessibility metadata

Patch Studio provides explicit `:focus-visible` styling for structural list options, Table inputs, structural action buttons and nested structure containers. The shared keyboard layer also projects `aria-keyshortcuts` metadata onto the relevant controls.

These behaviors are implemented by `web/designer-structural-keyboard.js` and installed once on the shared Designer Properties data panel. The nested editors inherit the same keyboard policy rather than maintaining a second shortcut implementation.

## Persistence boundary

Keyboard navigation, focused options and editor-selection state are transient IDE state. They do not create Patch application state and do not appear in Change History.

Only an explicit source-backed editor action rewrites visible `.patch` source. Runtime application persistence still requires ordinary Patch semantic `change` operations.

## Scope and remaining accessibility work

This milestone is an automated engineering accessibility baseline for the structural Properties editors. It is not a WCAG conformance statement and does not replace manual assistive-technology testing.

Remaining work includes manual browser/screen-reader verification, broader accessibility review across all Studio dialogs/build surfaces and any refinements found through Narrator, VoiceOver, Orca or other assistive-technology testing.

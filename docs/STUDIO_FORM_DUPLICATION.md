# Patch Studio Form duplication

Patch Studio can duplicate the currently active source-backed Form without creating a second visual-designer document.

## User workflow

Use **Duplicate Form** beside the existing **+ Form** action. The command operates on the Form selected by the existing `#patchFormSelect` control. After the source rewrite, the copied Form becomes the active Form and its title receives keyboard focus.

## Source-backed contract

Duplication copies the complete selected `window` block directly after the original. This includes all supported top-level controls and all nested content inside Tabs, including multi-line Table rows and hierarchical TreeView nodes.

If the original Form is named, the copy receives the next globally unused `form_N` id. Every named control contained in the copied Form also receives a fresh globally unique type-based id. This remapping includes controls nested inside every Tabs page.

For every copied control id, matching `when <old-id> ...:` event blocks are duplicated with the new event target. Handler bodies are preserved verbatim. Patch Studio deliberately does **not** reinterpret or silently rewrite semantic references inside a handler body. For example, if an original handler explicitly executes `close main`, the copied handler still executes `close main` unless the author edits that source.

Handlers belonging to controls outside the duplicated Form are not copied.

The rewritten source is reparsed before it is accepted. Invalid Form selection, unsafe id rewrite, or invalid generated source fails closed.

## State boundary

The command uses the existing Form selector and normal editor input/change signals. It does not create a second active-Form state, hidden Form model, persistent clipboard, or Change History side channel.

The new Form and its controls exist only because ordinary visible Patch source was added.

## Packaging

`web/designer-form-duplicate-model.js` owns the deterministic source transformation. `web/designer-form-duplicate.js` provides the Studio command and active-Form handoff. Both modules are included in the content-addressed public Patch Studio build and offline PWA cache.

This authoring feature does not change Patch syntax, Change IR **0.10**, Native GUI IR **1.2**, sealed payload **v12**, native runtime **v1.3**, or the beta.32 formal runtime-correspondence boundary.

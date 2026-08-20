# Patch Studio Form deletion

Patch Studio can delete the currently active Form as an ordinary source-backed `window` edit.

## User workflow

**Delete Form** is shown beside the existing Form lifecycle controls. The command is disabled when only one Form remains. For two or more Forms, Patch Studio asks for confirmation before changing source.

After deletion, the next surviving Form at the same index becomes active. If the final Form was deleted, the previous surviving Form becomes active instead. Activation uses the existing `#patchFormSelect` path; there is no second active-Form state.

## Source-backed contract

Deleting a Form removes the complete selected `window` block, including all supported top-level controls and every nested control inside Tabs pages. Multi-line Table rows and hierarchical TreeView nodes disappear with their parent controls because the complete Form block is removed atomically.

Patch Studio collects all named controls inside the selected Form, including nested controls in Tabs. Matching `when <control-id> ...:` event blocks are removed with those controls so the resulting project is not left with orphan handlers.

Handlers targeting controls belonging to other Forms are preserved unchanged. The source is reparsed before the edit is accepted.

The model refuses invalid Form indices and refuses to delete the last remaining Form in a Window project.

## Destructive-action boundary

Deletion requires an explicit browser confirmation in the Studio UI. The operation does not maintain a hidden Form model, persistent clipboard, or separate deletion history. The resulting application changes only because visible Patch source changed.

Normal project recovery/autosave remains independent from this command.

## Packaging

`web/designer-form-delete-model.js` owns the deterministic source transformation. `web/designer-form-delete.js` provides confirmation, command availability and active-Form handoff. Both modules are included in the content-addressed public Patch Studio build and offline PWA cache.

This authoring feature does not change Patch syntax, Change IR **0.10**, Native GUI IR **1.2**, sealed payload **v12**, native runtime **v1.3**, or the beta.32 formal runtime-correspondence boundary.

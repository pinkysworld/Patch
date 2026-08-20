# Patch Studio Tabs page duplication

Patch Studio can duplicate the currently selected Tabs page as a complete source-backed sibling.

## What is copied

**Duplicate page** copies:

- the page title expression;
- every supported nested Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView control;
- complete multi-line Table rows;
- complete TreeView node hierarchies;
- matching `when <control-id> ...:` event blocks for named controls on that page.

The duplicate is inserted directly after the original and becomes the selected page after the Designer re-renders.

## Unique ids

Named controls are never copied with the same id. Studio scans all control ids in the current source and assigns each copied control a fresh globally unique type-based id. For example, if `button_1` already exists, a copied Button may become `button_2`.

Input uses its normal `input <id>` syntax; controls with `as <id>` keep their normal syntax. Matching event headers are rewritten to the new ids while handler bodies are preserved.

## Source-backed boundary

Page duplication works on the visible `.patch` source block and reparses the result before it is accepted. It does not create a hidden Tabs/Page document, does not mutate Patch application state and does not write IDE selection state into Change History.

The original page and its original event handlers remain unchanged. The duplicate is independent source, so later edits do not mutate the original through shared JavaScript objects.

## Compatibility

This is a Patch Studio authoring feature. It does not change Patch syntax, Change IR 0.10, Native GUI IR 1.2, sealed payload v12, native runtime v1.3 or the beta.32 formal-assurance boundary.

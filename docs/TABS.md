# Tabs Stage 1

Patch Tabs are a nested Window UI container. Stage 1 deliberately treats page selection as transient interface state rather than persistent Patch state.

## Syntax

```patch
window "Settings" as main size 620, 380:
  tabs as settings at 24, 24 size 540, 280:
    tab "General":
      text "General settings"
      input name

    tab "Advanced":
      checkbox "Notifications" as notifications
```

A `tabs` block needs a Patch id and at least two `tab` pages. The Tabs container can use the same source-backed `at x, y size width, height` geometry as other top-level Window controls.

Controls inside a tab page use flow layout in Stage 1. Their event ids are still ordinary Patch control ids, so a nested input, checkbox, button, ComboBox or ListBox can use the normal `when ...` handlers.

## Mutation semantics

Selecting a page does not create or modify Patch state and does not create a Change History entry. The selected page lives only in the active UI renderer.

Persistent application state still changes only through explicit semantic `change` blocks. For example, an input nested in a page behaves exactly like an input outside Tabs:

```patch
when name changed:
  change name:
    set = value
```

Tabs itself does not expose `when settings changed:` in Stage 1. A later feature can add a page-selection event only if it has a clear semantic contract that does not accidentally turn UI navigation into hidden persistent mutation.

## Runtime support

Stage 1 is implemented in:

- Patch Studio Run preview
- source-backed Patch Studio Designer for Tabs container id and geometry
- Standalone Window Web runtime 0.8
- explicit Electron compatibility desktop renderer

The compatibility desktop renderer stores its active page only in renderer-local memory. It does not add a hidden Patch variable.

## Native boundary

Native GUI IR remains version 0.3 in this stage. Direct native Win32, AppKit and GTK3 lowering fails closed when it sees a Tabs container instead of dropping it or automatically switching to Electron.

Native Tabs parity is a separate versioned stage. The intended mappings are native tab/container widgets on each platform while preserving the same transient page-selection semantics.

## Current limitations

- at least two pages are required;
- only ordinary Window controls may appear directly inside a tab page;
- page controls use flow layout rather than individual `at/size` geometry;
- Tabs cannot be nested inside Tabs;
- page selection has no Patch event in Stage 1;
- direct native Tabs are not yet implemented.

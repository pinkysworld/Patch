# Tabs

Patch Tabs are a nested Window UI container. Page selection is transient interface state rather than persistent Patch state.

## Syntax

```patch
window "Settings" as main size 620, 420:
  tabs as settings at 24, 24 size 540, 320:
    tab "General":
      text "General settings"
      input name
      table "Name", "Value" as preferences:
        row "Theme", "System"

    tab "Advanced":
      checkbox "Notifications" as notifications
      tree as sections:
        node "Security"
          node "Keys"
        node "Network"
```

A `tabs` block needs a Patch id and at least two `tab` pages. The Tabs container can use the same source-backed `at x, y size width, height` geometry as other top-level Window controls.

Controls inside a tab page use flow layout and therefore do not carry their own `at/size` geometry. Ordinary nested controls include Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView. Their ids remain ordinary Patch control ids, so nested controls use the same `when ...` event contracts as their top-level counterparts.

Tabs cannot currently be nested inside Tabs.

## Patch Studio Designer

Tabs structure remains ordinary visible Patch source. Selecting a Tabs control in Patch Studio exposes its page list in Properties. Pages can be added, renamed, moved up/down and removed. Reordering preserves each page's complete nested control body, and deleting a page removes handlers belonging to controls deleted with that page.

For the selected page, Patch Studio can add or remove source-backed Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView controls. Generated named controls receive ids that are unique across top-level and nested controls. Nested Table and TreeView are inserted with small valid source-backed starter structures and no hidden geometry.

Nested Table and TreeView now have dedicated structural editing directly inside Tabs Properties as well. A nested Table exposes the same source-backed column/cell grid actions as a top-level Table: edit expressions, apply data, add/remove columns and add/remove rows. A nested TreeView exposes the same hierarchy actions as a top-level TreeView: add root/child, rename, move up/down, indent/outdent and delete nodes. Every action rewrites only that nested `table`/`row` or `tree`/`node` block and reparses the resulting Patch source before it is accepted.

The nested structural inspector is UI convenience over the same visible source, not a second Designer document. A Table still needs at least one column and every row must match the column count. A TreeView still needs at least one node.

The Designer refuses to leave a tab page empty and still enforces the language requirement of at least two pages.

## Mutation semantics

Selecting a page does not create or modify Patch state and does not create a Change History entry. The selected page lives only in the active UI renderer or native toolkit.

Persistent application state still changes only through explicit semantic `change` blocks. For example:

```patch
when name changed:
  change name:
    set = value
```

Tabs itself does not expose `when settings changed:`. A future page-selection event would need a separate semantic contract rather than silently turning UI navigation into persistent mutation.

Nested Table row selection exposes the selected row as transient text-list `value`. Nested TreeView selection exposes the selected root-to-node display path as transient text-list `value`. These are the same contracts as top-level Table and TreeView and persist only when source explicitly executes `change`.

## Current runtime support

The current product line keeps Change IR at **0.10** and uses Native GUI IR **1.2**, sealed native GUI payload **v12** and native runtime **v1.3** for token-free Ready/offline Windows, macOS and Linux Window apps.

Tabs and their nested ordinary controls are implemented in:

- Patch Studio Run/App Preview;
- the source-backed Patch Studio Designer and Properties editors;
- Standalone Window Web;
- the explicitly labelled compatibility desktop renderer;
- direct native Win32 AOT;
- direct native AppKit AOT;
- direct native GTK3 AOT;
- current token-free sealed Ready apps and ordinary offline `patch link` on Windows/macOS/Linux.

Table, multi-select ListBox, Menu state and TreeView capabilities that were added after the original Tabs release keep their own versioned native contracts. Current payload v12/runtime v1.3 carries the full TreeView-capable surface rather than redefining the earlier payloads in place.

## Native mappings

The native representation preserves the real page hierarchy. Backends may use internal parent-tab/page indices when a flat native handle table is useful, but selected-page state is never added to Patch state or serialized as persistent application state.

Platform mappings remain:

- **Windows:** `WC_TABCONTROLW` with page changes observed through the normal tab-control notification path;
- **macOS:** `NSTabView` containing `NSTabViewItem` page views;
- **Linux:** `GtkNotebook` containing native page views.

Nested controls remain real platform controls and preserve their ordinary Patch event semantics. Native and offline CI exercise canonical Window applications before those paths are claimed supported.

## Version history

Tabs first shipped on an older Native GUI IR/payload line. Those formats remain historical compatibility contracts. The current relevant native compatibility chain is:

```text
Native GUI IR 0.7   base controls/dialogs
Native GUI IR 0.8   Table
Native GUI IR 1.0   Menu enabled/checked state
Native GUI IR 1.1   persistent text-list state + multi-select ListBox
Native GUI IR 1.2   hierarchical TreeView

payload v9  / runtime v1.0   frozen Table line
payload v10 / runtime v1.1   frozen list-state line
payload v11 / runtime v1.2   frozen Menu+list line
payload v12 / runtime v1.3   current TreeView-capable Ready/offline line
```

Older payloads are not silently upgraded or reinterpreted when newer nested controls are used. Unsupported version/feature combinations fail closed.

## Current limitations

- at least two pages are required;
- at least one control must remain on each page;
- page controls use flow layout rather than individual source `at/size` geometry;
- Tabs cannot currently be nested inside Tabs;
- page selection has no Patch event;
- real credentialed Windows signing evidence and macOS Developer ID/notarization evidence remain separate production-readiness work;
- FreeBSD remains Console-only and Linux native distribution still relies on normal GTK3/system libraries.

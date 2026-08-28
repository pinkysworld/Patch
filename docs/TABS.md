# Tabs

Patch Tabs are a nested Window UI container. Page selection is transient interface state rather than persistent Patch state.

## Syntax

```patch
window "Settings" as main size 620, 420:
  tabs as settings at 24, 24 size 540, 320:
    tab "General":
      text "General settings"
      input name
      slider 0..100 as zoom step 5
      table "Name", "Value" as preferences:
        row "Theme", "System"

    tab "Advanced":
      checkbox "Notifications" as notifications
      tree as sections:
        node "Security"
          node "Keys"
        node "Network"
```

A `tabs` block needs a Patch id and at least two `tab` pages. The Tabs container can use source-backed `at x, y size width, height` geometry. Controls inside a page use flow layout and therefore do not carry their own `at/size` geometry.

Ordinary nested controls include Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table and TreeView. Their ids remain normal Patch control ids and use the same `when ...` contracts as top-level controls. Tabs cannot currently be nested inside Tabs.

## Patch Studio Designer

Tabs structure remains ordinary visible Patch source. Selecting a Tabs control exposes its page list in Properties. Pages can be added, renamed, moved up/down, duplicated and removed while preserving complete nested control bodies.

For the selected page, Studio can add or remove source-backed Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table and TreeView controls. Generated named controls receive ids unique across top-level and nested controls.

Nested Table and TreeView have dedicated structural editing directly inside Tabs Properties. A nested Table exposes source-backed column/cell edits, row/column add/remove, reorder and duplicate. A nested TreeView exposes add root/child, rename, move, indent/outdent, delete and duplicate-subtree actions. Every action rewrites the selected nested source block and reparses the result before accepting it.

The nested structural inspector is UI convenience over the same visible source, not a second Designer document. A Table still needs at least one column and every row must match the column count. A TreeView still needs at least one node.

## Mutation semantics

Selecting a page does not create or modify Patch state and does not create a Change History entry. Persistent application state still changes only through explicit semantic `change` blocks.

Nested Slider interaction exposes bounded finite numeric transient `value`; nested Table row selection exposes transient text-list `value`; nested TreeView selection exposes the selected root-to-node display path as transient text-list `value`. These persist only when source explicitly executes `change`.

## Current runtime support

The current product line keeps Change IR at **0.10** and uses Native GUI IR **1.4**, sealed native GUI payload **v14** and native runtime **v1.5** for token-free Ready/offline Windows, macOS and Linux Window apps.

Tabs and their nested ordinary controls are implemented in:

- Patch Studio Run/App Preview;
- the source-backed Patch Studio Designer and Properties editors;
- Standalone Window Web;
- direct native Win32 AOT;
- direct native AppKit AOT;
- direct native GTK3 AOT;
- current token-free sealed Ready apps and ordinary offline `patch link` on Windows/macOS/Linux.

The current v1.4/v14/v1.5 line preserves the earlier Table, multi-select ListBox, Menu, TreeView and Slider contracts while adding Chrome Stage 1 Panel, Timer, Picture and StatusBar transport. Existing Tabs semantics are not redefined by that addition.

The frozen TreeView compatibility line remains Native GUI IR **1.2** / payload **v12** / runtime **v1.3**. The previous Slider-capable compatibility line remains Native GUI IR **1.3** / payload **v13** / runtime **v1.4**.

## Native mappings

The native representation preserves the real page hierarchy. Backends may use internal parent-tab/page indices when a flat native handle table is useful, but selected-page state is never added to Patch state or serialized as persistent application state.

Platform mappings remain:

- **Windows:** `WC_TABCONTROLW`;
- **macOS:** `NSTabView` containing `NSTabViewItem` page views;
- **Linux:** `GtkNotebook` containing native page views.

Nested controls remain real platform controls and preserve their ordinary Patch event semantics.

## Version history

Tabs first shipped on an older Native GUI IR/payload line. Relevant additive compatibility lines are:

```text
Native GUI IR 0.7   base controls/dialogs
Native GUI IR 0.8   Table
Native GUI IR 1.0   Menu enabled/checked state
Native GUI IR 1.1   persistent text-list state + multi-select ListBox
Native GUI IR 1.2   hierarchical TreeView
Native GUI IR 1.3   Slider range/step/numeric event contract
Native GUI IR 1.4   current Chrome Stage 1 line preserving Tabs/Tree/Slider

payload v9  / runtime v1.0   frozen Table line
payload v10 / runtime v1.1   frozen list-state line
payload v11 / runtime v1.2   frozen Menu+list line
payload v12 / runtime v1.3   frozen TreeView-capable line, Slider fail-closed
payload v13 / runtime v1.4   previous Slider-capable line
payload v14 / runtime v1.5   current Ready/offline line
```

Older payloads are not silently upgraded or reinterpreted when newer controls are used. Unsupported version/feature combinations fail closed.

## Current limitations

- at least two pages are required;
- at least one control must remain on each page;
- page controls use flow layout rather than individual source `at/size` geometry;
- Tabs cannot currently be nested inside Tabs;
- page selection has no Patch event;
- real credentialed Windows signing evidence and macOS Developer ID/notarization evidence remain separate production-readiness work;
- FreeBSD remains Console-only and Linux native distribution still relies on normal GTK3/system libraries.

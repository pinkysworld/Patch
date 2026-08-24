# Menus and informational dialogs

Patch has a language, Change IR and native-runtime contract for structural Window menus and informational dialogs. Direct native AOT and the current token-free Ready/offline desktop line support separators, portable keyboard shortcuts and source-backed MenuItem enabled/checked state.

## Syntax

```patch
create boolean can_use_advanced = false
create boolean pinned = false

window "Menu demo" as main size 620, 340:
  menu "Actions":
    item "Enable advanced" as enable_advanced
    item "Advanced" as advanced_item enabled can_use_advanced shortcut "Primary+E"
    separator
    item "Pinned" as pin_item checked pinned shortcut "Primary+P"

when enable_advanced clicked:
  change can_use_advanced:
    set = true

when pin_item clicked:
  change pinned:
    set = true
```

A `menu` is Window structure rather than a positioned Form control. A named `item` exposes `clicked` and carries no event value. `separator` is structural only and cannot be named or receive an event.

## Source-backed enabled and checked state

A MenuItem may bind its visual/interactive state to ordinary Patch Boolean state:

```patch
item "Save" as save_item enabled can_save
item "Pinned" as pin_item checked pinned
item "Advanced" as advanced_item enabled can_use_advanced checked selected shortcut "Primary+A"
```

When several modifiers are present, the readable order is:

1. `enabled <boolean-state>`
2. `checked <boolean-state>`
3. `shortcut "..."`

Both bindings must name a declared `create boolean` state. Missing, text, number or list state is rejected during Window preflight.

The binding is one-way from Patch state to toolkit state. It does not create a framework-owned variable and a checked item does not persistently toggle itself. A click fires the ordinary `clicked` event. If the application wants checked/enabled state to change, its handler must perform an explicit semantic `change` on the bound Boolean state. UI refresh then projects the new Patch state back into the native menu.

A disabled item also cannot bypass the binding through a keyboard shortcut. Native dispatch is guarded by the same Boolean Patch state.

## Portable shortcuts

A MenuItem may add `shortcut "..."`. Stage 1 accepts:

- `Primary`, mapped to **Ctrl** on Windows/Linux and **Command** on macOS;
- optional `Shift`;
- optional `Alt`, mapped to **Option** on macOS;
- exactly one key from `A` to `Z`, `0` to `9` or `F1` to `F12`.

Examples:

```patch
item "Save" as save_item shortcut "Primary+S"
item "Save As" as save_as_item shortcut "Primary+Shift+S"
item "Help" as help_item shortcut "F1"
```

Shortcut identities are application-wide. Patch rejects duplicate portable shortcuts across MenuItems to avoid platform-specific accelerator ambiguity.

A separator must occur between clickable items. Leading, trailing and adjacent separators are rejected by the parser.

`dialog "Title", "Message"` remains informational. It has no result value and therefore cannot create hidden Boolean/text state or a Change History entry. Persistent Patch state still changes only through explicit `change` blocks.

## Change IR 0.10

The existing Change IR version is retained. Menu structure is explicit through:

- `MENU`;
- `MENU_ITEM`, including optional `enabledState`, `checkedState` and `shortcutExpr`;
- `MENU_SEPARATOR`;
- `DIALOG`.

The compiler advertises `ui.menu`, `ui.menu-separator`, `ui.menu-shortcut`, `ui.menu-enabled-state`, `ui.menu-checked-state` and `ui.dialog` as appropriate. This product/runtime work does not widen the beta.32 formal-assurance boundary.

## Native GUI contract layering

Menu support advanced additively through the versioned native stack:

- Native GUI IR **0.7**: base MenuItems;
- Native GUI IR **0.8**: Table extension retained alongside menus;
- Native GUI IR **0.9**: Menu separators and portable shortcut metadata;
- Native GUI IR **1.0**: Boolean `enabledState` / `checkedState` references;
- Native GUI IR **1.1**: persistent list/ListBox extension while preserving Menu state;
- Native GUI IR **1.2**: current TreeView extension while preserving the complete Menu contract.

The matching sealed progression is:

- payload **v9** / runtime **v1.0**: frozen Table line, before sealed Menu decoration/state parity;
- payload **v10** / runtime **v1.1**: frozen persistent-list line;
- payload **v11** / runtime **v1.2**: frozen Menu+list line with separators, portable shortcuts and source-backed enabled/checked state;
- payload **v12** / runtime **v1.3**: current TreeView-capable Ready/offline line preserving the full v11 Menu contract.

Older formats remain reproducible compatibility contracts. Newer Menu or Tree requirements fail closed when explicitly linked against a payload version that predates them.

## Native mappings

### Windows

- menu: `HMENU` / popup menus;
- separator: `MF_SEPARATOR`;
- shortcut: native `ACCEL` table plus `TranslateAcceleratorW`;
- enabled state: `EnableMenuItem` with `MF_ENABLED` / `MF_GRAYED`;
- checked state: `CheckMenuItem` with `MF_CHECKED` / `MF_UNCHECKED`;
- refresh: `DrawMenuBar` after source state projection;
- `Primary`: `FCONTROL`.

### macOS

- menu: `NSMenu` / `NSMenuItem`;
- separator: `[NSMenuItem separatorItem]`;
- shortcut: `keyEquivalent` plus `keyEquivalentModifierMask`;
- enabled state: `setEnabled:`;
- checked state: `setState:` with `NSControlStateValueOn/Off`;
- `Primary`: `NSEventModifierFlagCommand`;
- `Alt`: `NSEventModifierFlagOption`.

### Linux

- menu: `GtkMenuBar` / `GtkMenuItem`;
- separator: `GtkSeparatorMenuItem`;
- shortcut: `GtkAccelGroup` plus `gtk_widget_add_accelerator`;
- checked item: `GtkCheckMenuItem`;
- enabled state: `gtk_widget_set_sensitive`;
- checked state: `gtk_check_menu_item_set_active`;
- `Primary`: `GDK_CONTROL_MASK`.

Direct-backend and sealed-runtime smoke matrices execute decorated/state-bound applications on Windows, macOS and Linux. Frozen payload v12/runtime v1.3 additionally proves that those Menu semantics compose with the later TreeView layer. Current payload v13/runtime v1.4 preserves that composition and adds Slider.

## Current Ready/offline boundary

The token-free Ready app and ordinary offline Window linker now use **Native GUI IR 1.3 / payload v13 / runtime v1.4**. They support:

- separators;
- portable shortcuts;
- source-backed MenuItem `enabled` state;
- source-backed MenuItem `checked` state;
- the persistent list/ListBox contract from the earlier list layer;
- hierarchical TreeView from the frozen 1.2/v12/v1.3 layer;
- native Slider through `TRACKBAR`, `NSSlider` and `GtkScale`.

The Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line remains independently tested as the frozen compatibility contract and is Slider fail-closed. The v11/runtime v1.2 Menu+list line remains independently tested below that. The current v13 runtime does not reinterpret v12; it adds Slider over the frozen TreeView prefix.

Patch Studio's browser Ready path verifies the v1.4 runtime assets through the deployment SHA-256 manifest before sealing. The downloadable offline compiler independently builds and smoke-runs responsive, Table, ListBox, Menu, TreeView and Slider apps on its supported desktop hosts.

## Result-bearing dialogs

Confirmation and Open/Save file pickers remain separate typed result flows rather than being overloaded onto the informational `dialog` action. Their results are transient event data; persistent state changes only through an explicit `change` block.

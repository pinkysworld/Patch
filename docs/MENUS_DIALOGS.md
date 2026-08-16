# Menus and informational dialogs

Patch has a language, Change IR and native-runtime contract for structural Window menus and informational dialogs. The direct native AOT path supports separators, portable keyboard shortcuts and source-backed MenuItem enabled/checked state.

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

The binding is one-way from Patch state to toolkit state. It does **not** create a framework-owned variable and a checked item does **not** persistently toggle itself. A click only fires the ordinary `clicked` event. If the application wants the check or enabled state to change, the handler must perform an explicit semantic `change` on the bound Boolean state. `RefreshUI()` then projects the new Patch state back into the native menu.

This also means a disabled item cannot bypass the binding through a keyboard shortcut. The native backend guards MenuItem dispatch from the same Boolean state.

## Portable shortcuts

A MenuItem may add `shortcut "..."`. Stage 1 accepts:

- `Primary`, mapped to **Ctrl** on Windows/Linux and **Command** on macOS;
- optional `Shift`;
- optional `Alt`, mapped to **Option** on macOS;
- exactly one key from `A`–`Z`, `0`–`9` or `F1`–`F12`.

Examples:

```patch
item "Save" as save_item shortcut "Primary+S"
item "Save As" as save_as_item shortcut "Primary+Shift+S"
item "Help" as help_item shortcut "F1"
```

Shortcut identities are application-wide. Patch rejects two MenuItems that declare the same portable shortcut, even if they belong to different Forms. This avoids platform-specific ambiguity in accelerator dispatch.

A separator must occur between clickable items. Leading, trailing and adjacent separators are rejected by the parser.

`dialog "Title", "Message"` remains informational. It has no result value and therefore cannot create hidden Boolean/text state or a Change History entry. Persistent Patch state still changes only through explicit `change` blocks.

## Change IR 0.10

The existing Change IR version is retained. Menu structure is explicit through:

- `MENU`
- `MENU_ITEM`, including optional `enabledState`, `checkedState` and `shortcutExpr`
- `MENU_SEPARATOR`
- `DIALOG`

The compiler advertises `ui.menu`, `ui.menu-separator`, `ui.menu-shortcut`, `ui.menu-enabled-state`, `ui.menu-checked-state` and `ui.dialog` as appropriate. This product/runtime work does not widen the beta.32 formal-assurance boundary.

## Native GUI contract layering

The existing contracts remain versioned rather than being redefined in place:

- Native GUI IR **0.7** remains the stable base for ordinary menus;
- Native GUI IR **0.8** remains the Table extension;
- Native GUI IR **0.9** adds Menu separators and portable shortcut metadata while preserving the 0.8 Table surface;
- direct AOT backend **1.0** consumes IR 0.9;
- Native GUI IR **1.0** adds Boolean `enabledState` / `checkedState` references;
- direct AOT backend **1.1** consumes IR 1.0 on Win32, AppKit and GTK3.

The native build scripts automatically choose the smallest contract that preserves the source. A normal GUI stays on the stable base, a Table needs the 0.8/0.9 Table path, a separator/shortcut Menu selects IR 0.9/backend 1.0, and a MenuItem state binding selects IR 1.0/backend 1.1. `--menu-v11` exists for explicit test/build selection but is not required for ordinary source-driven builds.

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

The direct backend smoke matrices compile the same decorated/state-bound applications with MSVC, AppKit/clang and GTK3/C++ and execute them under `--patch-smoke`.

## Ready/offline boundary

The token-free sealed Ready-app line remains the independently versioned payload **v9** / runtime **v1.0** contract that carries Native GUI IR 0.8 Table metadata. It does **not** silently reinterpret or discard IR 0.9/1.0 Menu additions.

Shared Ready-app preflight therefore fails closed for separators, shortcuts and source-backed MenuItem state until a future sealed payload/runtime revision independently encodes, validates and executes the same behavior on Windows, macOS and Linux.

This distinction is intentional: direct AOT backend 1.1 support is not presented as sealed-runtime support.

## Result-bearing dialogs

Confirmation and Open/Save file pickers remain separate typed result flows rather than being overloaded onto the informational `dialog` action. Their results are transient event data; persistent state changes only through an explicit `change` block.

# Menus and informational dialogs

Patch has a language, Change IR and native-runtime contract for structural Window menus and informational dialogs. The direct native AOT path now also supports separators and portable keyboard shortcuts.

## Syntax

```patch
window "Menu demo" as main size 560, 320:
  menu "Help":
    item "Guide" as guide_item shortcut "Primary+G"
    separator
    item "About" as about_item shortcut "F1"
  text "Choose Help or use a shortcut" at 24, 48 size 340, 30

when guide_item clicked:
  dialog "Guide", "Keyboard shortcuts use the same clicked event."

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

A `menu` is Window structure rather than a positioned Form control. A named `item` exposes `clicked` and carries no event value. `separator` is structural only and cannot be named or receive an event.

### Portable shortcuts

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
- `MENU_ITEM`, including optional `shortcutExpr`
- `MENU_SEPARATOR`
- `DIALOG`

The compiler advertises `ui.menu`, `ui.menu-separator`, `ui.menu-shortcut` and `ui.dialog` as appropriate. This product/runtime work does not widen the beta.32 formal-assurance boundary.

## Native GUI contract layering

The existing contracts remain versioned rather than being redefined in place:

- Native GUI IR **0.7** remains the stable base for ordinary menus;
- Native GUI IR **0.8** remains the Table extension;
- Native GUI IR **0.9** adds Menu separators and portable shortcut metadata while preserving the 0.8 Table surface;
- direct AOT backend **1.0** consumes IR 0.9 on Win32, AppKit and GTK3.

The native build scripts automatically choose the smallest contract that preserves the source. A normal GUI stays on the stable base, a Table needs the 0.8/0.9 Table path, and a decorated Menu automatically selects IR 0.9/backend 1.0. No special flag is required, although `--menu-v10` remains available for explicit test/build selection.

## Native mappings

### Windows

- menu: `HMENU` / popup menus;
- separator: `MF_SEPARATOR`;
- shortcut: native `ACCEL` table plus `TranslateAcceleratorW`;
- `Primary`: `FCONTROL`;
- event delivery: the same `WM_COMMAND` MenuItem command id as a pointer click.

### macOS

- menu: `NSMenu` / `NSMenuItem`;
- separator: `[NSMenuItem separatorItem]`;
- shortcut: `keyEquivalent` plus `keyEquivalentModifierMask`;
- `Primary`: `NSEventModifierFlagCommand`;
- `Alt`: `NSEventModifierFlagOption`;
- event delivery: the same target/action MenuItem path as a pointer click.

### Linux

- menu: `GtkMenuBar` / `GtkMenuItem`;
- separator: `GtkSeparatorMenuItem`;
- shortcut: `GtkAccelGroup` plus `gtk_widget_add_accelerator`;
- `Primary`: `GDK_CONTROL_MASK`;
- event delivery: the same `activate` signal as a pointer click.

The direct backend smoke matrix compiles the same decorated Menu application with MSVC, AppKit/clang and GTK3/C++ and executes the existing real MenuItem event path under `--patch-smoke`.

## Ready/offline boundary

The token-free sealed Ready-app line remains the independently versioned payload **v9** / runtime **v1.0** contract that already carries Native GUI IR 0.8 Table metadata. It does **not** silently reinterpret or discard IR 0.9 Menu decorations.

Shared Ready-app preflight therefore fails closed when a source uses a separator or shortcut and explains that direct AOT backend 1.0 is required. A future sealed payload/runtime revision can add the same semantics only after all three consumers independently encode, validate and execute them.

This distinction is intentional: direct AOT backend 1.0 support is not presented as sealed-runtime support.

## Result-bearing dialogs

Confirmation and Open/Save file pickers remain separate typed result flows rather than being overloaded onto the informational `dialog` action. Their results are transient event data; persistent state changes only through an explicit `change` block.

## Remaining Menu backlog

Source-backed **enabled/disabled** and **checked/unchecked** MenuItem state remains open. It needs an explicit state-binding and refresh contract across language, Native GUI IR, direct AOT and eventually the sealed runtime rather than framework-owned hidden Menu state.

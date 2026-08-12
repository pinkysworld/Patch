# Menus and informational dialogs

Patch now has a language, Change IR and native-runtime contract for structural Window menus and informational dialogs.

## Syntax

```patch
window "Menu demo" as main size 560, 320:
  menu "Help":
    item "About" as about_item
  text "Choose Help > About" at 24, 48 size 320, 30

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

A `menu` is Window structure rather than a positioned Form control. It contains one or more named `item` entries. A menu item exposes `clicked` and carries no event value.

`dialog "Title", "Message"` is deliberately informational. It has no result value and therefore cannot create hidden Boolean/text state or a Change History entry. Persistent Patch state still changes only through explicit `change` blocks.

## Change IR 0.10

The existing Change IR version is retained and contains explicit UI instructions:

- `MENU`
- `MENU_ITEM`
- `DIALOG`

The compiler advertises `ui.menu` and `ui.dialog` capabilities. This does not extend the beta.32 formal assurance boundary; Menu/Dialog remains product UI/runtime engineering.

## Native GUI IR 0.6

Menus are stored separately in each Form as `form.menus[]`, rather than pretending to be positioned controls. Menu items share the application UI-id namespace with controls and Tabs and are event sources with an owning Form.

Informational dialogs lower as event actions carrying:

- owning Form id;
- title;
- message.

There is intentionally no result field.

## Native mappings

- Windows: `HMENU`, popup menus, `WM_COMMAND`, `MessageBoxW`
- macOS: `NSMenu`, `NSMenuItem`, target/action, `NSAlert`
- Linux: `GtkMenuBar`, `GtkMenuItem`, `activate`, `GtkMessageDialog`

All three AOT backends generate these real platform primitives directly.

## Token-free payload v6

The sealed native `PCHGUI01` payload v6 adds a per-Form menu section after the existing flat control section. Each menu serializes its title and named item vector. Informational dialog is action kind 4 and serializes Form, title and message.

The generic Win32, GTK3 and AppKit runtime templates parse and validate the same structure, reconstruct real OS menus and execute MenuItem events. Under `--patch-smoke`, the event path remains real but a modal dialog is recorded rather than displayed so CI cannot block.

Runtime release tags for this stage are:

- `native-win32-runtime-v0.6`
- `native-linux-runtime-v0.6`
- `native-macos-runtime-v0.6`

Pages pins those exact releases after they publish from green `main` workflows.

## Result-bearing dialogs

Confirmation, Open/Save file pickers and input dialogs are intentionally not overloaded onto the informational `dialog` action. They need a separate typed result contract so results are explicit rather than framework-owned hidden state.

The intended next rule remains the same as other Patch event values: a dialog result is transient event data; persistent state changes only through an explicit `change` block.

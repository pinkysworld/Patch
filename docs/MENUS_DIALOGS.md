# Menus and informational dialogs

This stage introduces the Patch language and Change IR contract for menus and informational dialogs without claiming renderer support before the native backends implement it.

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

The existing Change IR version is retained and gains explicit instructions within the existing extensible UI surface:

- `MENU`
- `MENU_ITEM`
- `DIALOG`

The compiler also advertises `ui.menu` and `ui.dialog` capabilities.

This does not extend the beta.32 formal assurance boundary. Menu/dialog instructions remain product UI/runtime engineering.

## Current runtime boundary

At this language-contract stage, Window runtimes fail closed rather than silently omitting menu items or dialogs. Native GUI IR, sealed native payloads, Win32/AppKit/GTK emitters and token-free runtime templates remain on their previous versions until the dedicated native-parity stage lands.

That separation is intentional: parsing or lowering syntax is not treated as evidence that a target renderer implements it.

## Next native-parity stage

The following stage will map the contract to real platform primitives:

- Windows: `HMENU` / `WM_COMMAND` and `MessageBoxW`
- macOS: `NSMenu` / `NSMenuItem` and `NSAlert`
- Linux: `GtkMenuBar` / `GtkMenuItem` and `GtkMessageDialog`

It will also version Native GUI IR and the sealed native payload only when all AOT and token-free runtime paths can reconstruct and execute the same contract.

## Result-bearing dialogs

Confirmation, Open/Save file pickers and input dialogs are intentionally not overloaded onto the informational `dialog` action. They need a separate typed result contract so results are explicit rather than framework-owned hidden state.

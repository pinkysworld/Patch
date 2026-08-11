# Native menus and informational dialogs

Patch Native GUI 0.6 adds a deliberately small menu/dialog contract without introducing hidden persistent state.

## Syntax

```patch
window "Menu demo" as main size 560, 320:
  menu "Help":
    item "About" as about_item
  text "Choose Help > About" at 24, 48 size 320, 30

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

A `menu` is Window structure rather than a positioned Form control. It contains one or more named `item` entries. Menu item ids live in the same UI id namespace as ordinary named controls and Tabs.

A menu item exposes only `clicked` in Stage 1. It does not carry a value.

## Dialog semantics

`dialog "Title", "Message"` is an informational GUI action. It displays an OS-native message dialog and has no result value.

This is intentional. A simple informational dialog does not create a hidden Boolean, text value, Change History entry, or framework object. Persistent Patch state changes only through ordinary explicit `change` blocks.

Confirmation dialogs, file pickers, text-input dialogs and other result-bearing modal APIs are not overloaded onto this Stage-1 action. They require a separate language contract because their result must be represented explicitly and type-safely.

## Native GUI IR 0.6

Menus are stored separately from geometrical controls:

```text
Form
  controls[]   -> positioned Text/Button/Input/.../Tabs/Radio
  menus[]      -> Menu -> MenuItem[]
```

A menu item is still an event source. A `clicked` handler may contain the same checked native actions as other GUI events plus the new informational `dialog` action.

Dialog actions carry:

- owning Form id;
- quoted title text;
- quoted message text.

They do not carry an output/result field.

## Native mappings

### Windows

- `HMENU`
- `CreateMenu`
- `CreatePopupMenu`
- `AppendMenuW`
- `SetMenu`
- menu selection through `WM_COMMAND`
- informational dialog through `MessageBoxW`

### macOS

- `NSMenu`
- `NSMenuItem`
- target/action dispatch
- informational dialog through `NSAlert`

macOS exposes an application-wide menu bar, so Patch Form menu declarations are projected into the application menu structure while each MenuItem still retains its Patch event identity and owning Form for dialog parenting.

### Linux

- `GtkMenuBar`
- `GtkMenu`
- `GtkMenuItem`
- `activate` signal dispatch
- informational dialog through `GtkMessageDialog`

## CI and modal dialogs

The native smoke applications exercise the real menu-item event dispatch path. In `--patch-smoke` mode the dialog primitive records the requested title/message instead of opening a modal window, so unattended CI cannot deadlock waiting for a human click.

Normal application execution uses the real OS-native dialog primitive. The smoke-mode substitution is test infrastructure only and does not alter the language contract.

## Sealed native payload v6

The token-free runtime format adds:

- per-Form menu structures after the Form control list;
- Menu title and MenuItem id/text;
- action kind 4 for informational dialogs with Form/title/message.

Menus are not encoded as fake control kind 9 because they are not Form-layout controls. Existing control kinds remain unchanged, including Tabs kind 7 and Radio kind 8.

## Scope boundary

This work changes neither Change IR 0.10 nor the beta.32 research assurance claims. Native GUI work remains product/runtime engineering and does not expand the formal proof boundary.

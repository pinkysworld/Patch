# Result Dialogs

Patch result dialogs extend the Window language with explicit, named result sources while keeping persistent mutation inside ordinary semantic `change` blocks.

## Language contract

```patch
create text selected_path = ""

window "Files" as main:
  button "Reset" as reset_button
  button "Open" as open_button
  button "Save" as save_button

when reset_button clicked:
  confirm "Reset selection?", "Clear the selected path?" as reset_confirm

when reset_confirm confirmed:
  change selected_path:
    set = ""

when reset_confirm cancelled:
  show "reset cancelled"

when open_button clicked:
  open file "Open Patch file" as open_result

when open_result chosen:
  change selected_path:
    set = value

when open_result cancelled:
  show "open cancelled"

when save_button clicked:
  save file "Save Patch file" as save_result

when save_result chosen:
  change selected_path:
    set = value
```

The result contract is:

- `confirm ... as id` can emit `confirmed` or `cancelled`.
- `open file ... as id` can emit `chosen` or `cancelled`.
- `save file ... as id` can emit `chosen` or `cancelled`.
- `chosen` carries one transient text `value` supplied by the renderer/runtime.
- `cancelled` is a distinct event. It is not represented by an empty path.
- Dialog result ids share the application UI event-source namespace with controls, Tabs and menu items.

## Mutation boundary

A result dialog does not create a Patch variable and does not write persistent state. Choosing a file therefore does not assign a path automatically.

To retain a selected path, source must use an explicit semantic change:

```patch
when open_result chosen:
  change selected_path:
    set = value
```

That keeps the same Change History, provenance and capability model used by other Patch mutations.

## Change IR and Native GUI IR

Result dialogs keep Change IR at **0.10** and lower explicitly as:

- `CONFIRM_DIALOG`
- `OPEN_FILE_DIALOG`
- `SAVE_FILE_DIALOG`

Native GUI IR **0.7** carries the named result sources and their transient result events. The feature adds runtime capability markers for result dialogs but does not expand the formal-verification claim.

## Native implementation

Result-dialog parity is implemented on both direct-native paths.

### AOT backends

- Windows: `MessageBoxW` confirmation plus `GetOpenFileNameW` / `GetSaveFileNameW`.
- macOS: `NSAlert`, `NSOpenPanel` and `NSSavePanel`.
- Linux: GTK confirmation and file chooser dialogs.

The current AOT toolkit backend is **0.8**. The 0.8 accessibility layer does not change the result-dialog event contract introduced by backend 0.7.

### Token-free sealed runtimes

Sealed payload **v7** and runtime release **v0.8** carry the same result-dialog actions/events in the `PCHGUI01` envelope:

- `native-win32-runtime-v0.8`
- `native-macos-runtime-v0.8`
- `native-linux-runtime-v0.8`

Runtime v0.8 retains the proven v0.7 result-dialog implementation and adds native accessibility naming/readback around the same decoded payload. Each runtime workflow seals and executes `examples/result-dialog-window.patch` and continues to verify payload version 7.

## Smoke behavior

Normal applications show the operating-system dialog. `--patch-smoke` avoids blocking CI by returning deterministic confirmation/file results while still dispatching the actual Patch result event path. Tests verify that a `chosen` event value reaches an explicit `change` when the example asks it to, rather than being persisted implicitly by the dialog itself.

The v0.8 sealed-runtime smoke executes the ordinary result-dialog semantic checks first and only then performs native accessibility readback. Accessibility therefore cannot hide a regression in the result-dialog behavior it overlays.

## Current boundary

The current result contract is intentionally small:

- one confirmation result with confirmed/cancelled;
- one selected file path for Open/Save with chosen/cancelled;
- no multi-file result;
- no folder chooser contract;
- no filter/type schema yet;
- no hidden persistent dialog state.

Targets must fail closed when they cannot implement this contract. They must not invent a result, collapse cancellation into an empty string or mutate Patch state on behalf of a dialog.

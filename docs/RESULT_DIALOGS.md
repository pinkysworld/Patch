# Result Dialogs

Patch result dialogs extend the Window language with explicit, named result sources while keeping persistent mutation inside ordinary semantic `change` blocks.

## Stage 1 language contract

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
- `chosen` carries one transient text `value`, which will be supplied by a renderer/runtime in the native-parity stage.
- `cancelled` is a distinct event. It is not represented by an empty path.
- Dialog result ids share the application UI event-source namespace with controls, Tabs and menu items.

## Mutation boundary

A result dialog does not create a Patch variable and does not write persistent state. In particular, choosing a file does not assign a path automatically.

To retain a selected path, source must use an explicit semantic change:

```patch
when open_result chosen:
  change selected_path:
    set = value
```

That keeps the same change history, provenance and capability model used by other Patch mutations.

## Change IR

Stage 1 keeps Change IR at **0.10** and lowers dialog invocations explicitly as:

- `CONFIRM_DIALOG`
- `OPEN_FILE_DIALOG`
- `SAVE_FILE_DIALOG`

The feature adds runtime capability markers for result dialogs but does not expand the beta.32 formal-verification claim.

## Current implementation boundary

This stage defines and validates the source/AST/Change-IR event contract only. It does **not** yet claim renderer or desktop parity.

The follow-up Native GUI 0.7 stage is responsible for producing real result events from platform dialogs:

- Windows: confirmation plus native Open/Save common dialogs.
- macOS: `NSAlert`, `NSOpenPanel` and `NSSavePanel`.
- Linux: GTK confirmation and file chooser dialogs.

Until that native stage lands, targets must not silently invent a result or mutate state on behalf of a dialog.

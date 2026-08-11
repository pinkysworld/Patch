# Radio controls

Patch Radio is a grouped single-choice Window control with a text-valued selection contract.

## Syntax

```patch
create text mode = "Basic"

window "Preferences" as main size 480, 280:
  radio "Basic", "Advanced", "Expert" as mode at 24, 72 size 240, 90

when mode changed:
  change mode:
    set = value
```

A Radio group needs at least two quoted text options and a simple Patch id after `as`. The id binds to text state with the same name in direct-native builds.

## Mutation semantics

Choosing a native Radio item exposes the selected option only as transient event-local text `value`. The GUI adapter does not persist the choice by itself. Persistent application state and Change History change only when source executes an ordinary semantic `change` block.

A handler may inspect `value` without storing it. The Window event adapter 0.5 rejects non-text payloads for Radio, including when the Radio control is nested inside Tabs.

## Native GUI contract

Native GUI IR 0.5 represents the logical Radio group once with its id, text-state binding, option vector and source-backed geometry. Backend-specific item handles are not part of Patch state or Native GUI IR.

Native mappings are:

- Windows: a mutually exclusive group of `BS_AUTORADIOBUTTON` Win32 buttons;
- macOS: `NSButton` items using `NSButtonTypeRadio`;
- Linux: a native `GtkRadioButton` group.

All native implementations send the selected item's label into the same Patch `changed` event and refresh their checked item from the bound Patch text state.

## Token-free native builds

Sealed native GUI payload v5 adds control kind 8 for Radio and reuses the existing checked text-option vector contract. The three generic native runtimes reconstruct real platform Radio groups without Electron, Chromium or a sidecar project source file.

The v0.5 native runtime releases are:

- `native-win32-runtime-v0.5`
- `native-linux-runtime-v0.5`
- `native-macos-runtime-v0.5`

They are published only after their platform workflow compiles, seals and executes the Radio smoke application on `main`.

## Scope boundary

This stage does not change Change IR 0.10 or beta.32 research assurance claims. It also does not add multi-selection or a special Radio mutation primitive. Radio remains ordinary UI input feeding explicit Patch changes.

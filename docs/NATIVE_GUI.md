# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Build paths

The beginner-facing native command remains:

```bash
patch-app myapp.patch
```

It selects the host backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into precompiled native runtime templates. Project-specific AOT through GitHub Actions remains available as a separate route.

## Native GUI IR 0.5

```text
.patch source
     |
Patch compiler
     |
Native GUI IR 0.5
     |
 +---+----------------+---+
 |                    |   |
Win32               AppKit GTK3
```

Native GUI IR 0.5 supports:

- literal `number`, `text` and `boolean` state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox;
- grouped Radio controls;
- real Tabs containers with page-owned child controls;
- Button `clicked` and typed `changed` events;
- explicit scalar `change` operations;
- named Form `open` / `close` lifecycle;
- simple state interpolation in supported labels.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Selection semantics

ComboBox, ListBox and Radio share one rule:

```text
native selection -> transient text value -> when <id> changed -> explicit Patch change
```

For example:

```patch
create text mode = "Basic"

window "Preferences" as main:
  radio "Basic", "Advanced", "Expert" as mode

when mode changed:
  change mode:
    set = value
```

Selecting a Radio item does not itself mutate persistent Patch state. The selected option becomes event-local text `value`. Only an ordinary Patch `change` persists it and creates Change History.

Radio mappings are:

| Platform | Native control |
|---|---|
| Windows | grouped `BS_AUTORADIOBUTTON` buttons |
| macOS | `NSButton` with `NSButtonTypeRadio` |
| Linux | native `GtkRadioButton` group |

A Radio group is one logical Patch control even when a backend uses several native widget handles internally. Those handles never become Patch state or Native GUI IR objects.

## Tabs

Tabs remains a real native container introduced in Native GUI IR 0.4. Native GUI IR 0.5 preserves that contract.

- Windows: `WC_TABCONTROLW` + `TCN_SELCHANGE`
- macOS: `NSTabView` + `NSTabViewItem`
- Linux: `GtkNotebook`

The selected page is transient renderer state. It is absent from Patch state and Change History. Child controls, including Radio, retain their normal event semantics inside a page.

## Token-free sealed runtime v5

All three token-free native builds use the `PCHGUI01` envelope. Payload **v5** carries Forms, state, events, controls, selection option vectors and Tabs parent/page metadata. Radio is native control kind **8**; Tabs remains kind **7**.

The runtime releases for this stage are:

- `native-win32-runtime-v0.5`
- `native-linux-runtime-v0.5`
- `native-macos-runtime-v0.5`

They are published from `main` only after their native runtime workflows compile, seal and execute the Radio example successfully. Patch Pages pins the exact release versions so a payload-v5 browser build cannot be paired with an older runtime.

The macOS token-free app remains unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Signing/notarization is a separate packaging stage.

## Executable evidence

Each supported platform has two independent native paths:

1. project-specific AOT native code generation;
2. generic sealed native runtime reconstruction.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox, Tabs and Radio on Windows, macOS and Linux. Each sealed runtime workflow also creates and executes a platform-native Radio application and verifies payload v5.

The native artifacts do not use Electron, Chromium or Node.js as their GUI runtime.

## Current boundary

Native GUI 0.5 does not yet include menus, dialogs, table/grid or every Patch feature. Those are separate versioned stages. Linux still depends on GTK3 system libraries, and the browser-sealed macOS app is unsigned.

None of this work changes Change IR 0.10 or the beta.32 research assurance claims. See `docs/RADIO.md` for the Radio-specific contract.

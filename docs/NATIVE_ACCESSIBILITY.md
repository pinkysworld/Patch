# Native Window accessibility baseline

Patch native Window applications use real Win32, AppKit and GTK3 controls. Native implementation version 0.8 adds an explicit accessibility naming layer for controls whose platform default often lacks enough context, without changing Patch source syntax, Native GUI IR 0.7 or sealed payload v7.

This document describes an **implementation baseline**, not a WCAG conformance statement and not a substitute for manual testing with Narrator, VoiceOver, Orca or other assistive technologies.

## Naming contract

Both direct-native paths use the same deterministic naming rule:

- Input
- ComboBox
- ListBox
- Tabs
- Radio items

A static visible control text is preferred when one exists. Otherwise the Patch control id/binding is humanized, for example:

- `user_name` → `User name`
- `accountType` → `Account Type`
- `settings` → `Settings`

Radio items retain their visible option while gaining group context, for example `mode` + `Advanced` becomes `Mode: Advanced`.

Buttons and Checkboxes continue to use their standard native visible titles. Patch does not replace those with a static accessibility label because their displayed text may be state-backed and change at runtime.

For the AOT code generators, `src/native-accessibility.js` centralizes this derivation. The sealed runtimes implement the same rule natively from the id/text/binding/options metadata already present in payload v7. Accessibility therefore requires **no new payload field and no payload-version bump**.

## Direct AOT backend v0.8

### Windows

The Win32 AOT backend uses Microsoft Active Accessibility dynamic annotation on the final HWND controls:

- COM is initialized for the generated application's GUI thread.
- `IAccPropServices::SetHwndPropStr` assigns `PROPID_ACC_NAME` to the control's `OBJID_CLIENT` / `CHILDID_SELF` object.
- annotations are cleared before the main Window destroys its annotated controls.
- the native smoke path reads names back through `AccessibleObjectFromWindow` + `IAccessible::get_accName(CHILDID_SELF)` and fails if the exposed name differs from the generated contract.

### macOS

The AppKit AOT backend calls `setAccessibilityLabel:` for the explicit-name control set. The smoke path reads each control's `accessibilityLabel` back and fails on a mismatch.

### Linux / GTK3

The GTK AOT backend obtains the native widget's `AtkObject` through `gtk_widget_get_accessible()` and sets its name with `atk_object_set_name()`. The smoke path reads the name with `atk_object_get_name()`.

## Token-free sealed runtime v0.8

The browser-sealed native path retains the **`PCHGUI01` payload v7** contract and moves only the generic OS runtime implementation to v0.8:

- `native-win32-runtime-v0.8`
- `native-macos-runtime-v0.8`
- `native-linux-runtime-v0.8`

The v0.8 runtime source is deliberately a thin overlay over the proven v0.7 payload/runtime implementation. It reuses v0.7 parsing, event dispatch, Forms, controls, menus and result dialogs, then adds accessibility after native controls have been created.

### Windows sealed runtime

The runtime sets MSAA Name properties with `IAccPropServices` and reads them back through `IAccessible::get_accName` during `--patch-smoke`.

### macOS sealed runtime

The runtime applies AppKit accessibility labels to the decoded controls and reads those labels back during `--patch-smoke`.

### Linux sealed runtime

The runtime sets and reads GTK3/ATK accessible names during `--patch-smoke`.

Because the accessible name is derived entirely from existing payload-v7 control metadata, the browser sealer and Native GUI IR format stay unchanged.

## Keyboard and focus behavior

The baseline intentionally keeps platform-native controls and their existing focus behavior:

- Win32 interactive controls remain native tab-stop controls.
- AppKit uses standard focusable `NSControl` subclasses.
- GTK3 uses standard GTK widgets and notebook/radio semantics.

Version 0.8 does not introduce a custom focus manager or custom-painted control tree.

## Dialogs

Informational, confirmation and open/save dialogs continue to use platform-native dialog APIs. Patch does not replace their native accessibility implementation. Result-dialog semantics remain Native GUI IR 0.7 / sealed payload v7 under the v0.8 implementation layer.

## Automated verification boundary

The engineering audit requires evidence from **both** native paths:

1. deterministic name derivation;
2. the intended platform accessibility APIs are present;
3. AOT Win32/AppKit/GTK backends compile and execute their readback smokes;
4. sealed Win32/AppKit/GTK v0.8 runtimes compile, seal real payload-v7 applications and execute accessibility readback after the ordinary semantic smoke passes;
5. the runtime workflows continue to assert `PCHGUI01` payload version 7.

Only after all three sealed-runtime workflows pass on the exact v0.8 head can the engineering-level **generated native Window app accessibility audit** be marked complete.

It is **not** enough to close the separate manual assistive-technology audit. Before a stable release, Patch still needs real interaction testing with keyboard-only navigation and representative screen readers, including focus order, announcement quality, dialogs, tabs, dynamic state changes, high-contrast/forced-colors behavior where applicable, and localization effects.

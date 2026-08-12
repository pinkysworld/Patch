# Native Window accessibility baseline

Patch native Window applications use real Win32, AppKit and GTK3 controls. Backend v0.8 adds an explicit accessibility naming layer for controls whose platform default often lacks enough context, without changing Patch source syntax or Native GUI IR 0.7.

This document describes an **implementation baseline**, not a WCAG conformance statement and not a substitute for manual testing with Narrator, VoiceOver, Orca or other assistive technologies.

## Naming contract

`src/native-accessibility.js` centralizes deterministic names used by all three native AOT backends.

Patch explicitly names:

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

## Windows

Win32 backend v0.8 uses Microsoft Active Accessibility dynamic annotation on the final native HWND controls:

- COM is initialized for the generated application's GUI thread.
- `IAccPropServices::SetHwndPropStr` assigns `PROPID_ACC_NAME` to the control's `OBJID_CLIENT` / `CHILDID_SELF` object.
- annotations are cleared before the main Window destroys its annotated controls.
- the native smoke path reads names back through `AccessibleObjectFromWindow` + `IAccessible::get_accName(CHILDID_SELF)` and fails if the exposed name differs from the generated contract.

The implementation follows Microsoft's documented direct-annotation model for correctly naming existing HWND UI elements.

## macOS

AppKit backend v0.8 keeps the standard AppKit controls and calls `setAccessibilityLabel:` for the explicit-name control set. The smoke path reads each control's `accessibilityLabel` back and fails on a mismatch.

Buttons, checkboxes, standard dialogs and menu items continue to use AppKit's native control/title behavior rather than being replaced by custom accessibility objects.

## Linux / GTK3

GTK backend v0.8 obtains the native widget's `AtkObject` through `gtk_widget_get_accessible()` and sets its name with `atk_object_set_name()`.

The GTK smoke path reads the resulting name with `atk_object_get_name()` and fails if it does not match the Patch accessibility contract. Radio item names include group context.

## Keyboard and focus behavior

The baseline intentionally keeps platform-native controls and their existing focus behavior:

- Win32 interactive controls remain `WS_TABSTOP` controls.
- AppKit uses standard focusable `NSControl` subclasses.
- GTK3 uses standard GTK widgets and notebook/radio semantics.

Backend v0.8 does not introduce a custom focus manager or custom-painted control tree.

## Dialogs

Informational, confirmation and open/save dialogs continue to use platform-native dialog APIs. Patch does not replace their native accessibility implementation. Result-dialog semantics remain the v0.7 layer under the v0.8 accessibility overlay.

## Verification boundary

Automated evidence now covers:

1. deterministic name derivation;
2. generated source contains the intended platform accessibility APIs;
3. all three native backends compile through their normal platform build paths;
4. `--patch-smoke` reads the accessibility name back from the native accessibility layer and fails on mismatch.

This is enough to close the engineering-level **generated native Window app accessibility audit** once the Windows/macOS/Linux native CI matrix is green on the v0.8 backend.

It is **not** enough to close the separate manual assistive-technology audit. Before a stable release, Patch still needs real interaction testing with keyboard-only navigation and representative screen readers, including focus order, announcement quality, dialogs, tabs, dynamic state changes, high-contrast/forced-colors behavior where applicable, and localization effects.

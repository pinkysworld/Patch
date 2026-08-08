# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its design goal is the immediacy of QuickBASIC and Visual Basic, but with one project format and one language across desktop, mobile and the web.

## Product goal

A beginner should be able to:

1. open Patch Studio;
2. create a Console or Window project;
3. type a few lines of Patch or use the visual Designer;
4. press **Run**;
5. press **Build** and choose the desired operating system.

No build files, SDK selection or platform-specific source code should be required for ordinary Patch projects.

## What works in 0.2 beta.17

Patch Studio includes:

- source editor and local project autosave;
- Run for console and GUI programs;
- live Patch UI preview;
- Change IR and Change Contract views;
- portable `.patchapp` builds;
- direct and bootstrap Wasm targets;
- standalone single-file Web App builds;
- first visual Designer toolbox with Text, Button and Input;
- responsive phone/tablet layout and installable PWA;
- Windows, macOS and Linux builds initiated directly from the Studio;
- both Console and Window / GUI desktop package paths.

## Build for Windows, macOS and Linux

Patch Studio's Build menu contains:

```text
Windows App (.exe)
macOS App (.app)
Linux App
```

The selected **Project Type** determines the desktop package kind:

```text
Console -> direct Patch Wasm + native host
Window  -> standalone Patch desktop GUI player
```

When a desktop target is selected, Studio shows a GitHub build-token field. The token needs Actions read/write access to `pinkysworld/Patch`. It remains only in the current page and is not saved in the project or local storage.

Pressing Build performs the following flow:

```text
current Studio source
        |
        v
browser preflight
        |
        v
GitHub Actions workflow_dispatch
        |
        +-- Windows runner
        +-- macOS runner
        `-- Linux runner
        |
        v
source check + package + smoke run
        |
        v
GitHub Actions artifact
        |
        v
Patch Studio download
```

The editor source is transmitted as a base64 workflow input. It does not need to be committed first.

## Console desktop path

For Console projects Studio retains the direct compiler path. The browser performs a direct-Wasm preflight before dispatching the build. The target runner packages that program through the current native console host and smoke-runs it before uploading the artifact.

This path is restricted to the documented direct-backend subset. Unsupported constructs fail explicitly.

## Window / GUI desktop path

Window projects are validated through the Patch compiler, then packaged using a generated minimal Electron desktop player.

The player currently supports the same early Patch UI model used in Studio:

- `window`;
- `text`;
- `button`;
- `input`;
- supported button click events;
- semantic `change` execution through the Patch runtime.

This means a Patch Window project can now become a standalone desktop GUI package on Windows, macOS or Linux without changing the Patch source.

The current package is **not** native-widget code generation. AppKit, Win32 and Unix-native GUI backends remain future compiler/runtime work.

## Platform packages

Development builds currently produce:

```text
Console
  Windows -> .exe
  macOS   -> .app
  Linux   -> native executable

Window / GUI
  Windows -> packaged GUI directory containing .exe
  macOS   -> .app inside a universal Electron package
  Linux   -> packaged GUI directory
```

The GitHub workflow independently builds and smoke-checks Console and Window projects on all three operating systems whenever the native build subsystem changes.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share -> Add to Home Screen**.

On iPhone/iPad the browser can locally:

```text
edit Patch
use the first Designer tools
run/preview projects
inspect Changes and IR
build .patchapp
build direct Wasm
build a standalone Web App
```

With network access and the GitHub build token, the same iPhone Studio can also request Windows, macOS or Linux desktop packages. The desktop toolchains run remotely on GitHub-hosted runners, not on iOS.

## Source-preserving design

The visual Designer must keep Patch source understandable. Adding a button should produce ordinary Patch such as:

```patch
window "My App":
  button "Button" as button_1
```

The source remains the truth and can always be edited manually.

## Example Window project

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

Set Project Type to **Window**, select Windows, macOS or Linux in Build, and Studio submits that source to the appropriate desktop runner.

## Remaining product work

- drag positioning and resizing in Designer;
- control selection and properties;
- richer input binding;
- native GUI lowering rather than the current packaged player;
- Windows signing and macOS Developer ID/notarization;
- installer formats;
- optional organization-level build service so end users do not need to supply their own GitHub token.

# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its product goal is the immediacy of QuickBASIC and Visual Basic with one Patch source format across browser and desktop targets.

## Product goal

A beginner should be able to:

1. open Patch Studio;
2. create a Console or Window project;
3. type a few lines of Patch or use the visual Designer;
4. press **Run**;
5. press **Build** and choose the desired platform.

No build file, SDK selection or platform-specific Patch source should be required for ordinary projects.

## What works in 0.2 beta.18

Patch Studio includes:

- source editor and local project autosave;
- Run for Console and GUI programs;
- live Patch UI preview;
- Change IR and Change Contract views;
- portable `.patchapp` builds;
- direct and bootstrap Wasm targets;
- standalone single-file Web App builds;
- first visual Designer toolbox with Text, Button and Input;
- responsive phone/tablet layout and installable PWA;
- Windows, macOS and Linux builds initiated directly from the Studio;
- both Console and Window / GUI desktop package paths on those three systems;
- **FreeBSD Console builds through the portable C99 backend**.

## Desktop Build menu

The current remote targets are:

```text
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
```

The editor source is transmitted as a workflow input. It does not need to be committed first.

When a remote target is selected, Studio shows a GitHub build-token field. The token needs Actions read/write access to `pinkysworld/Patch`. It remains only in the current page and is not saved in the project or `localStorage`.

## Windows, macOS and Linux

For a **Console** project, Studio performs a direct-Wasm preflight and the target runner packages the program through Patch's native Console host.

For a **Window** project, Studio validates the Patch UI source and the target runner packages it with the current generated desktop GUI player.

```text
current Studio source
        |
        v
browser preflight
        |
        v
Patch Native Apps workflow
        |
        +-- Windows
        +-- macOS
        `-- Linux
        |
        v
source check + package + smoke run
        |
        v
artifact downloaded by Studio
```

Window packages currently support the first Patch UI model:

- `window`;
- `text`;
- `button`;
- `input`;
- supported button click events;
- semantic `change` execution through the Patch runtime.

They are standalone desktop applications, but are **not yet native-widget code generation** to AppKit, Win32 or GTK.

## FreeBSD Console path

FreeBSD uses a deliberately different portability route:

```text
Patch source
    |
    v
portable C99 backend
    |
    v
FreeBSD 15.1 VM
    |
    v
base-system cc -std=c99
    |
    v
native FreeBSD executable
```

The browser preflight generates the C99 representation before dispatch. GitHub Actions then compiles and smoke-runs that C source inside a real FreeBSD environment before returning the executable artifact.

The C99 backend currently shares the conservative numeric Console language boundary of the direct Wasm path: numeric state/change/show, supported arithmetic and conditions, literal repeat/count, acyclic numeric recipes and ranged parameter guards.

**FreeBSD Window/GUI packaging is not implemented in beta.18.** Studio reports that boundary instead of silently building a different program.

## Platform package summary

```text
Console
  Windows -> .exe
  macOS   -> .app
  Linux   -> native executable
  FreeBSD -> native executable via C99 + FreeBSD cc

Window / GUI
  Windows -> packaged GUI application containing .exe
  macOS   -> .app inside the desktop package
  Linux   -> packaged GUI application
  FreeBSD -> not yet supported
```

CI compiles and runs portable C99 on Linux, macOS and FreeBSD 15.1. The native application workflow separately smoke-checks Windows/macOS/Linux Console and Window packages.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share -> Add to Home Screen**.

The iPhone/iPad browser can locally edit, use the first Designer tools, run/preview projects, inspect Changes/IR, and build `.patchapp`, direct Wasm and Standalone Web App artifacts.

With network access and the GitHub build token, the same Studio can request Windows, macOS, Linux or FreeBSD Console packages. Platform toolchains run remotely rather than on iOS.

## Source-preserving design

The Designer must keep Patch source understandable. Adding a button should produce ordinary Patch:

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

Set Project Type to **Window** and choose Windows, macOS or Linux. For FreeBSD in beta.18, choose a **Console** project.

## Remaining product work

- Designer control selection, properties, drag positioning and resizing;
- richer controls and two-way input binding;
- native GUI lowering instead of the current desktop player;
- portable Unix GUI backend and FreeBSD Window packages;
- OpenBSD/NetBSD testing before advertising those targets;
- Windows signing and macOS Developer ID/notarization;
- installer formats;
- optional build service so end users do not need a personal GitHub token.

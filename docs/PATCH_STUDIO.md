# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its product goal is the immediacy of QuickBASIC and Visual Basic with one Patch source format across browser and desktop targets.

## Product goal

A beginner should be able to open Studio, create a Console or Window project, type Patch or use the Designer, press **Run**, then press **Build** and choose the desired platform. Build files, SDK selection and platform-specific Patch source should remain unnecessary for ordinary projects.

## What works in 0.2 beta.19

Patch Studio includes:

- source editor and local autosave;
- Run for Console and GUI programs;
- live Patch UI preview and first Designer toolbox;
- Change IR and Change Contract views;
- portable `.patchapp`, direct/bootstrap Wasm and standalone Web App builds;
- Windows, macOS and Linux builds initiated directly from the Studio;
- Console and Window / GUI desktop packages on those three systems;
- **FreeBSD Console builds through the portable C99 backend**;
- responsive phone/tablet layout and installable PWA.

Change IR 0.8 also carries the beta.19 source-validation artifact. `patch formal` can report whether the independent raw-source validator reconstructed the same formal SourceStmt/range claims as the production AST path. This is advanced research information and does not complicate normal Studio use.

## Desktop Build menu

```text
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
```

The current editor source is sent as a workflow input and does not have to be committed. Remote targets require a fine-grained GitHub token with Actions read/write access to `pinkysworld/Patch`; the token stays only in the current page and is not saved in the project or `localStorage`.

## Windows, macOS and Linux

Console projects receive a direct-Wasm preflight and are packaged through the native Console host. Window projects are compiler-checked and packaged with the current generated desktop GUI player.

```text
current Studio source
        ↓
browser preflight
        ↓
Patch Native Apps
        ↓
Windows / macOS / Linux runner
        ↓
check + package + smoke run
        ↓
artifact downloaded by Studio
```

The Window player currently covers `window`, `text`, `button`, `input`, supported button clicks and semantic `change` execution. The packages are standalone, but are **not yet native-widget code generation** to AppKit, Win32 or GTK.

## FreeBSD Console path

```text
Patch source
    ↓
portable C99 backend
    ↓
FreeBSD 15.1 VM
    ↓
base-system cc -std=c99
    ↓
native FreeBSD executable
```

The C99 path covers the conservative numeric Console subset: numeric state/change/show, supported arithmetic and conditions, literal repeat/count, acyclic numeric recipes and ranged parameter guards.

**FreeBSD Window/GUI packaging is not implemented in beta.19.** Studio reports that boundary rather than silently changing execution strategy.

## Platform package summary

```text
Console
  Windows -> .exe
  macOS   -> .app
  Linux   -> native executable
  FreeBSD -> native executable via C99 + FreeBSD cc

Window / GUI
  Windows -> packaged GUI application containing .exe
  macOS   -> .app inside desktop package
  Linux   -> packaged GUI application
  FreeBSD -> not yet supported
```

CI compiles/runs portable C99 on Linux, macOS and FreeBSD 15.1 and independently smoke-checks Windows/macOS/Linux Console and Window packages.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. Locally it can edit, run/preview, use the first Designer tools, inspect Changes/IR, and build `.patchapp`, direct Wasm and Standalone Web App artifacts. With network access and the GitHub build token it can request the supported desktop artifacts remotely.

## Source-preserving design

The Designer must keep Patch source understandable. Adding a button should produce ordinary source such as:

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

Set Project Type to **Window** and choose Windows, macOS or Linux. FreeBSD remains Console-only in beta.19.

## Remaining product work

- Designer selection, properties, drag positioning/resizing and richer controls;
- two-way input binding and event editing;
- native GUI lowering instead of the current desktop player;
- portable Unix GUI backend and FreeBSD Window packages;
- OpenBSD/NetBSD testing before advertising those targets;
- Windows signing, macOS Developer ID/notarization and installers;
- optional build service so end users do not need a personal GitHub token.

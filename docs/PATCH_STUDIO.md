# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its design goal is the immediacy of QuickBASIC and Visual Basic, but with one project format and one language across desktop, Unix-like systems, mobile devices and the web.

## Product goal

A beginner should be able to:

1. open Patch Studio;
2. create a console or window project;
3. type a few lines of Patch or use the visual Designer;
4. press **Run**;
5. inspect what the program is allowed to change when desired;
6. press **Build** to produce an application artifact.

No build files, compiler setup, SDK selection or package-manager knowledge should be required for ordinary programs.

## What works in 0.2 beta.17

Patch Studio includes:

- source editor and local project autosave;
- Run for console and GUI programs;
- live Patch UI preview;
- Change IR viewer;
- **Change Contract** viewer for inferred semantic Change Signatures and declared Change Capabilities;
- portable `.patchapp` builds;
- direct `.wasm` builds and the advanced bootstrap Wasm carrier;
- standalone single-file Web App builds;
- first visual Designer toolbox with **+ Text**, **+ Button** and **+ Input**;
- source-preserving Designer edits;
- responsive phone/tablet layout;
- installable PWA/offline cache;
- **Studio cloud builds for Windows, macOS and Linux** from the Patch source currently open in the editor.

The Designer is intentionally an early RAD slice, not yet a finished drag-and-drop form editor. Positioning, resizing, control selection, a property inspector and richer widgets remain future milestones.

## Build for Windows, macOS and Linux from Studio

Choose **Windows / macOS / Linux desktop** in the Build selector and press **Build**.

Patch Studio opens a small desktop-build dialog where the user chooses:

- Windows, macOS, Linux or all three;
- Console or Window / GUI application.

Because a browser or iPhone cannot execute every desktop toolchain locally, Studio sends the Patch source currently in the editor to the repository's **Patch Native Apps** GitHub Actions workflow. The source is sent as a base64 workflow input, so it does not have to be committed first.

A GitHub token is required to dispatch and monitor the workflow. Patch Studio keeps that token only in memory in the current browser tab and does not put it in `localStorage` or the Patch project. The token is sent only to `api.github.com` for the workflow API calls.

Studio then:

1. dispatches the build;
2. finds the workflow run by a unique request ID;
3. follows queued/running/completed status;
4. lists the produced artifacts;
5. downloads the selected artifact ZIP when the browser permits the authenticated artifact redirect;
6. otherwise offers the corresponding GitHub Actions run as a fallback download location.

### Console desktop applications

Console projects use the direct Patch Wasm backend and the small Rust/Wasmtime native host already used by the CLI native target.

The cloud runner builds the host on the target operating system and smoke-runs it before uploading the artifact.

### Window / GUI desktop applications

Window projects are packaged as desktop GUI applications using a minimal generated Electron host. The generated player includes the current Patch source and Patch runtime, renders Patch `window`, `text`, `button` and `input` controls, and forwards supported button events back to the Patch runtime.

The current GUI package is therefore a **standalone desktop build**, but it is not yet native-widget lowering of Patch UI to AppKit/Win32/GTK. That remains a later compiler/runtime target.

For macOS, the GUI packager requests a universal Electron bundle. Windows and Linux currently package the architecture supplied by their GitHub-hosted runner.

## Change Contract view

Patch Studio can show advanced users what semantic changes the compiler infers from recipes without forcing that information into normal beginner code.

Example source:

```patch
allow reward:
  player.score may increase up to 10

make reward(player):
  change player:
    add 5 to score
```

The Change Contract view reports approximately:

```text
reward(player)
  produces: player.score -> increase by 5
  allowed:
    player.score may increase up to 10
  proof: produced changes are inside the declared policy
```

If the recipe changes to `set score = 999`, compilation and the contract view report that the policy does not permit the semantic change.

This is an advanced opt-in safety feature. A beginner can write ordinary Patch programs without declaring `allow` blocks.

## Browser-first IDE

Patch Studio is a Progressive Web App. The same IDE is intended to work in modern browsers on:

- Windows;
- macOS;
- Linux;
- iPhone and iPad;
- Android;
- ChromeOS;
- FreeBSD/OpenBSD/NetBSD and other Unix-like systems with a modern browser.

The PWA caches the compiler/interpreter/change-analysis/Designer assets for offline use and stores the current project locally in the browser. Cloud desktop builds naturally require network access.

### iPhone and iPad

On iPhone/iPad, open Patch Studio in Safari and choose **Share -> Add to Home Screen**.

The phone can locally:

```text
edit Patch
add basic GUI controls in Designer
run console programs
run/preview window programs
inspect semantic Change Contracts
inspect Change IR
build .patchapp
build direct/bootstrap Wasm
build a standalone Web App
```

And, with GitHub Actions access, it can now request desktop builds without owning those desktop machines:

```text
Patch Studio on iPhone
        |
        +-- edit / design / run locally
        +-- Build for desktop
                |
                +-- Windows -> native console .exe or packaged GUI app
                +-- macOS   -> .app / native console host
                `-- Linux   -> executable / packaged GUI app
```

This makes the iPhone a usable development front end even when the final application targets a desktop operating system.

## Studio layout

Desktop direction:

```text
+----------------------------------------------------------------+
| Patch Studio                    Run   Target   Build            |
+-------------+---------------------------+----------------------+
| Project     |                           | Properties           |
| Toolbox     |       Window Designer     | (next stage)         |
|             |                           |                      |
| + Text      |       Hello               |                      |
| + Button    |       [ Button ]          |                      |
| + Input     |                           |                      |
+-------------+---------------------------+----------------------+
| Designer | App | Output | Changes | IR                         |
+----------------------------------------------------------------+
```

On phones, the areas collapse vertically and tabs switch between the relevant views instead of shrinking a desktop UI to unreadable size.

## Source-preserving visual design

Patch Studio must not introduce a hidden UI-description language. If the user adds a Button, the source changes to something like:

```patch
window "My App":
  button "Button" as button_1
```

The source remains the truth and can always be edited manually. Future drag/resize/property operations should likewise produce predictable Patch source or project metadata with a documented textual representation.

## Project types

### Console

```patch
show "Hello world"
```

### Window

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

The same `change` semantics and Change Signature analysis can apply to console recipes and GUI event handlers.

## Build UX

The Studio build selector now offers:

- **Standalone Web App (.html)**;
- **Windows / macOS / Linux desktop**;
- **Portable .patchapp**;
- **Direct WebAssembly (.wasm)**;
- **Bootstrap Wasm (advanced)**.

Compilation validates declared Change Capability policies before producing local compiler artifacts. Desktop cloud builds also run `patch check` before packaging.

Architecture selection, signing, notarization and installer formats remain advanced/future release concerns.

## Immediate mode

Patch Studio should next allow expressions and semantic changes to be sent to a running application:

```patch
show score
```

or:

```patch
change score:
  add 10
```

The application updates live and the same change can appear in history or be undone. Future immediate-mode changes should also be checked against active semantic capability boundaries where appropriate.

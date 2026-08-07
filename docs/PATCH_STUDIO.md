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

## What works in 0.2 beta.2

Patch Studio now includes:

- source editor and local project autosave;
- Run for console and GUI programs;
- live Patch UI preview;
- Change IR viewer;
- **Change Contract** viewer for inferred semantic Change Signatures and declared Change Capabilities;
- portable `.patchapp` builds;
- bootstrap `.wasm` builds;
- first visual Designer toolbox with **+ Text**, **+ Button** and **+ Input**;
- source-preserving Designer edits;
- responsive phone/tablet layout;
- installable PWA/offline cache.

The Designer is intentionally an early RAD slice, not yet a finished drag-and-drop form editor. Positioning, resizing, control selection, a property inspector and richer widgets are next milestones.

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

The PWA caches the compiler/interpreter/change-analysis/Designer assets for offline use and stores the current project locally in the browser.

### iPhone and iPad

On iPhone/iPad, open Patch Studio in Safari and choose **Share -> Add to Home Screen**.

Today the phone can locally:

```text
edit Patch
add basic GUI controls in Designer
run console programs
run/preview window programs
inspect semantic Change Contracts
inspect Change IR
build .patchapp
build bootstrap .wasm
```

Native Windows/macOS/Linux application builds require platform toolchains and signing facilities that iOS cannot host. The intended later design is:

```text
Patch Studio on iPhone
        |
        +-- edit / design / run locally
        +-- inspect Change Contracts locally
        +-- Build portable .patchapp locally
        +-- Build bootstrap/direct Wasm locally
        `-- Build for... through remote platform runner
                |
                +-- Windows -> .exe
                +-- macOS   -> .app / CLI universal binary
                +-- Linux   -> executable / packages
                `-- BSD/Unix -> runtime package or C fallback
```

This lets the iPhone be the development computer even when the final binary targets a desktop OS.

## Studio layout

Desktop direction:

```text
+----------------------------------------------------------------+
| Patch Studio                    Run   Target   Build   Build... |
+-------------+---------------------------+----------------------+
| Project     |                           | Properties           |
| Toolbox     |       Window Designer     | (next stage)         |
|             |                           |                      |
| + Text      |       Hello               |                      |
| + Button    |       [ Button ]          |                      |
| + Input     |                           |                      |
+-------------+---------------------------+----------------------+
| Designer | App | Output | Change Contract | Change IR         |
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

0.2 currently offers:

- **Run**;
- **Build Portable .patchapp**;
- **Build WebAssembly .wasm** (bootstrap backend).

Compilation validates any declared Change Capability policies before producing the artifact.

The longer-term simple UI remains:

- **Run**: execute immediately;
- **Build**: build the selected target;
- **Build for...**: Windows, macOS, Linux, Unix/BSD, Web or portable.

Architecture selection, signing and packaging details remain optional advanced settings.

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

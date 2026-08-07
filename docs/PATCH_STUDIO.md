# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its design goal is the immediacy of QuickBASIC and Visual Basic, but with one project format and one language across desktop, Unix-like systems, and the web.

## Product goal

A beginner should be able to:

1. open Patch Studio;
2. create a console or window project;
3. type a few lines of Patch or use the visual window designer;
4. press **Run**;
5. press **Build** to produce an application.

No build files, compiler setup, SDK selection, or package manager knowledge should be required for ordinary programs.

## Browser-first IDE

Patch Studio is implemented as a Progressive Web App (PWA). This makes the same IDE available in modern browsers on:

- Windows;
- macOS;
- Linux;
- iPhone and iPad;
- Android;
- ChromeOS;
- FreeBSD/OpenBSD/NetBSD and other Unix-like systems with a modern browser.

The PWA caches its core files for offline use and stores the current project locally in the browser.

### iPhone and iPad

On iPhone/iPad, Patch Studio can be opened in Safari and added to the Home Screen. The editor, interpreter, compiler front end, Change IR viewer, and portable `.patchapp` builder can run locally in the browser.

Native Windows/macOS/Linux application builds require platform toolchains and signing facilities that iOS cannot host. The intended design is therefore:

```text
Patch Studio on iPhone
        |
        +-- Run locally in browser
        +-- Build portable .patchapp locally
        +-- Build Web/Wasm locally when backend is available
        `-- Request native build through GitHub Actions / Patch Build service
                |
                +-- Windows runner -> .exe
                +-- macOS runner   -> .app / CLI universal binary
                +-- Linux runner   -> executable / packages
                `-- BSD/Unix       -> runtime package or C fallback
```

This means a Patch application can be developed from an iPhone even though an iPhone cannot itself run Microsoft's or Apple's desktop linker toolchains.

## Studio layout

The long-term desktop layout is intentionally reminiscent of classic RAD IDEs:

```text
+----------------------------------------------------------------+
| Patch Studio                         Run   Stop   Build   Build… |
+-------------+---------------------------+----------------------+
| Project     |                           | Properties           |
| Toolbox     |       Window Designer     |                      |
|             |                           |                      |
| Button      |       [Hello world]       |                      |
| Text        |       [ Click me ]        |                      |
| Input       |                           |                      |
+-------------+---------------------------+----------------------+
| Code | Output | Problems | Changes | History | Change IR       |
+----------------------------------------------------------------+
```

On phones the same areas collapse vertically rather than trying to reproduce a desktop layout at tiny scale.

## Project types

### Console

```patch
show "Hello world"
```

Build targets eventually include Windows `.exe`, macOS/Linux/BSD command-line executables, WebAssembly, and a portable `.patchapp`.

### Window

Planned source syntax:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

Patch Studio's visual designer will generate/edit this same readable Patch source. The visual representation is not a separate hidden language.

## Immediate mode

Patch Studio should eventually allow expressions and changes to be sent to a running application:

```patch
show score
```

or:

```patch
change score:
  add 10
```

The running application updates, and `undo` can reverse the live state change. This is a natural consequence of Patch's semantic-change model.

## Build UX

Ordinary users should see only three main actions:

- **Run**: execute immediately;
- **Build**: build for the current platform/profile;
- **Build for…**: select Windows, macOS, Linux, Unix/BSD, Web, or portable `.patchapp`.

Advanced signing, architecture selection, and packaging remain optional settings.

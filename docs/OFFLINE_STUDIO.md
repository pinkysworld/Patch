# Patch Studio Offline IDE

Status: **Stage 1 implementation in progress**

Patch Studio should be usable as a real offline IDE, not merely as a website that happens to remain in a browser cache. The offline product keeps Patch's local-first model and uses the same source-backed Studio modules as the public site.

## Product contract

The offline IDE must eventually support this workflow with no GitHub account, token or network connection:

1. launch Patch Studio from a local executable;
2. create/import/export Patch projects and resources;
3. edit source and use the Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and WebAssembly locally;
6. build Windows/macOS/Linux applications locally from the embedded offline compiler/runtime set;
7. keep project data and diagnostics local unless the user explicitly exports or chooses an online action.

Online services are optional accelerators for updates, remote builds and publishing. They are not part of the core IDE execution contract.

## Stage 1: self-contained Offline Studio executable

The Stage 1 implementation adds:

- `npm run build:offline-studio`;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 for every embedded Studio file and a closure hash;
- a Node SEA executable containing the complete generated Patch Studio site;
- an ephemeral loopback server bound only to `127.0.0.1`;
- a random per-launch URL prefix so unrelated local pages cannot guess the Studio endpoint;
- GET/HEAD-only serving with traversal rejection and restrictive security headers;
- CSP `connect-src 'self'` so this offline executable does not silently depend on remote network resources;
- automatic browser launch with a printed local URL as fallback;
- fail-closed build validation if critical Studio assets are missing.

Stage 1 is useful offline for Studio authoring, Designer/Run, Standalone Web, portable bundle and browser-side targets already implemented by Patch Studio.

The executable deliberately uses the same generated site closure as the hosted Studio. The offline IDE is therefore not a forked second IDE implementation.

## Stage 2: fully local native build path

Stage 2 closes the remaining distinction between the browser IDE and a Delphi/VB-style installed development environment:

- embed or install the current Patch offline compiler beside the Studio runtime;
- embed the sealed Win32/AppKit/GTK runtime templates for the host platform;
- expose a localhost-only authenticated build bridge;
- Windows host builds Windows apps locally;
- macOS host builds macOS apps locally;
- Linux host builds Linux apps locally;
- no GitHub token or Actions workflow is required;
- native output, diagnostics and SHA-256 evidence appear in the Studio artifact pane;
- remote/fresh CI build remains an optional separate target.

Cross-compiling every desktop platform from every host is not required for Stage 2. Patch should first provide a predictable host-native local build contract.

## Stage 3: installed IDE integration

After the local build bridge is stable:

- native file-open/save/project-folder integration instead of browser download/upload as the primary workflow;
- recent projects and workspace persistence;
- OS file associations for Patch project formats;
- packaged Windows/macOS/Linux IDE distributions;
- application icon and installer integration;
- optional update checks that are disabled or harmless when offline;
- signing/notarization for official releases when credentials are available.

A custom shell such as Tauri/Electron should only be introduced if it materially improves filesystem/window integration. The core Studio must remain browser-module compatible and testable as the same application.

## Security boundary

The installed IDE will eventually have more authority than the hosted Studio because local native builds require filesystem/process access. Therefore:

- the browser UI must never receive a general shell-execution API;
- local build endpoints must accept only versioned Patch build requests;
- a per-launch secret/token must protect any privileged localhost endpoint;
- project paths must be canonicalized and restricted to explicitly opened workspaces;
- native runtime/compiler binaries must be versioned and integrity checked;
- online URLs must never be required to run an existing local project.

## Current commands

```text
npm run build:offline-studio
npm run check:offline-studio
```

`check:offline-studio` performs the deterministic site/manifest closure step without requiring Node SEA support. Building the executable requires a Node release with `--build-sea` support, matching the existing offline compiler release approach.

## Definition of Offline IDE Ready

Patch Studio can advertise a fully offline IDE only when the installed product can be launched after network disconnection and complete authoring, Run and host-native Build for an already installed toolchain without fetching code, modules, compiler files or runtime templates.

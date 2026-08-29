# Patch Studio Offline IDE

Patch Studio can be packaged as a local IDE that keeps the same source-backed RAD workflow as the hosted Studio without requiring the public website after download.

## Architecture

The offline IDE keeps the browser-based Studio and serves the packaged files on the local machine. This preserves the existing browser module and service-worker behavior without adding Electron or another bundled Chromium copy. The launcher opens the user's installed browser.

A future native shell can use an operating-system WebView, but the Patch compiler, project format and Studio frontend do not depend on such a shell.

## Build

Run `npm run build:offline-ide`.

The default output is `dist-offline-ide/patch-studio-offline/` and contains the packaged Studio site, a local launcher server, Windows and Unix launchers, and a short README.

Use `Patch Studio.cmd` on Windows or `./patch-studio` on macOS/Linux. A developer build can use an installed Node.js 22+ runtime.

## Rolling release

`.github/workflows/offline-ide.yml` builds and smoke-tests three rolling platform packages:

- `patch-studio-offline-windows-x64.zip`
- `patch-studio-offline-macos-arm64.tar.gz`
- `patch-studio-offline-linux-x64.tar.gz`

Those release packages include their own platform Node runtime, so Node does not need to be installed separately. The workflow starts the packaged loopback server, fetches the local Studio shell and verifies the current beta.36 / Native GUI IR 1.8 / runtime v1.9 surface before an artifact can be published. A successful main build updates the rolling `offline-ide-v0.2` release and `SHA256SUMS`.

## Native build templates

The builder accepts `--runtime-dir <directory>`. Verified native runtime assets from that directory are copied into the offline Studio bundle, so the browser no-token native build path can work while disconnected.

The initial rolling Offline IDE release guarantees the self-contained local IDE and bundled Node runtime. Native runtime-template bundling stays separately versioned and must fail closed when the required verified runtime files are absent. The standalone Offline Compiler remains the guaranteed fully local native linking path while this packaging slice is completed.

Runtime versions follow `src/native-current-contract.js`. The offline IDE does not maintain a separate current-contract version.

## Local-first behavior

Projects, resources, recovery snapshots and diagnostics keep the same local-first behavior as the hosted Studio. Export and build actions remain explicit user actions.

The hosted Studio and offline IDE are two delivery forms of the same compiler and source-backed RAD surface, not separate IDE implementations.

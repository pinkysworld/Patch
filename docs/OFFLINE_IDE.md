# Patch Studio Offline IDE

Patch Studio can be packaged as a local IDE that keeps the same source-backed RAD workflow as the hosted Studio without requiring the public website after download.

## Architecture

The first offline IDE keeps the browser-based Studio and serves the packaged files on the local machine. This preserves the existing browser module and service-worker behavior without adding Electron or another bundled Chromium copy. The launcher opens the user's installed browser.

A future native shell can use an operating-system WebView, but the Patch compiler, project format and Studio frontend do not depend on such a shell.

## Build

Run `npm run build:offline-ide`.

The default output is `dist-offline-ide/patch-studio-offline/` and contains the packaged Studio site, a local launcher server, Windows and Unix launchers, and a short README.

Use `Patch Studio.cmd` on Windows or `./patch-studio` on macOS/Linux. Release packages can include a Node runtime in the bundle, while developer bundles can use an installed Node.js 22+ runtime.

## Native build templates

The builder accepts `--runtime-dir <directory>`. Verified native runtime assets from that directory are copied into the offline Studio bundle, so the no-token native build path can work while disconnected.

Runtime versions follow `src/native-current-contract.js`. The offline IDE does not maintain a separate current-contract version.

## Local-first behavior

Projects, resources, recovery snapshots and diagnostics keep the same local-first behavior as the hosted Studio. Export and build actions remain explicit user actions.

The hosted Studio and offline IDE are two delivery forms of the same compiler and source-backed RAD surface, not separate IDE implementations.

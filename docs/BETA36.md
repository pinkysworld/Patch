# Patch 0.2.0-beta.36

Patch beta.36 is an integration and RAD-authoring release. It aligns the product surface with the already-versioned Native GUI 1.4 contract and makes Patch Studio more like a conventional Delphi/Visual Basic visual development environment without introducing a hidden form resource format.

## Compiler and native contract

The current compiler version is `0.2.0-beta.36`.

The current native Window contract is:

- Native GUI IR `1.4`
- sealed payload `v14`
- desktop runtime `v1.5`
- Win32 release `native-win32-runtime-v1.5`
- AppKit release `native-macos-runtime-v1.5`
- GTK release `native-linux-runtime-v1.5`

The previous contracts remain versioned compatibility lines. They are not silently rewritten.

## Offline compiler v0.2

The offline release line moves to `offline-compiler-v0.2`.

Windows x64, Linux x64, macOS Apple Silicon and the macOS Intel kit now build/link against runtime v1.5 and assert payload v14 in smoke tests. The FreeBSD kit remains console-only.

The offline compiler test matrix now also links `examples/chrome-window.patch`, so Panel, Timer, PictureBox and StatusBar Stage 1 cannot be added to the compiler facade without exercising the current native sealing path.

## Patch Studio RAD authoring

Multi-selection now includes the common form-designer arrangement operations expected from classic RAD IDEs:

- align left / right
- align top / bottom
- align horizontal / vertical centers
- make same width / height
- distribute horizontally / vertically with equal gaps

These operations rewrite visible Patch source through the existing source-backed Designer API. There is no `.dfm`-style hidden layout state.

## Website and cache refresh

The generated public site is normalized to the current beta.36 product contract. The Studio P is rendered on a native 22 by 22 SVG coordinate grid with only horizontal and vertical edges and `crispEdges`, avoiding the fractional resampling that could make the old mark look tilted.

The service worker release id is also bumped to beta.36 so older cached Studio shells are replaced.

## Review boundary

Beta.36 does not claim that every Chrome Stage 1 control is complete. In particular, the native PictureBox source field is transported through IR/payload v14 but the v1.5 desktop runtimes do not yet load that source into an actual image on all platforms. See `docs/GROK_REVIEW_2026-08-25.md`.

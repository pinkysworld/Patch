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

The shared Window validator now understands Panel child controls and the Chrome Stage 1 event contracts used by the current native facade: Timer exposes `ticked` and PictureBox exposes `clicked`. The token-free/offline linker defaults to the current payload v14 contract. Payload v12 remains the explicit frozen TreeView compatibility selection.

## Offline compiler v0.2

The offline release line moves to `offline-compiler-v0.2`.

Windows x64, Linux x64, macOS Apple Silicon and the macOS Intel kit now build/link against runtime v1.5 and assert payload v14 in smoke tests. The FreeBSD kit remains console-only.

The offline compiler test matrix also links `examples/chrome-window.patch`, so Panel, Timer, PictureBox and StatusBar Stage 1 cannot be added to the compiler facade without exercising the current native sealing path.

## Patch Studio RAD authoring

### Arrange and sizing

Multi-selection includes common form-designer arrangement operations expected from classic RAD IDEs:

- align left / right
- align top / bottom
- align horizontal / vertical centers
- make same width / height
- distribute horizontally / vertically with equal gaps

These operations rewrite visible Patch source through the existing source-backed Designer API. There is no `.dfm`-style hidden layout state.

### Object Inspector

The existing source-backed Properties pane is extended into an **Object Inspector** rather than replaced by a second designer model.

It provides:

- an Object selector for named Designer controls;
- **Properties** and **Events** views;
- Delphi/VB-style event names such as `OnClick`, `OnChange` and `OnTick`;
- **Create handler**, which inserts an ordinary visible `when ...:` block into Patch source;
- **Open handler**, which moves the source editor directly to an existing handler;
- default-handler double-click for safe core controls such as Button, Input, Checkbox, Radio, ComboBox, ListBox and Slider.

Generated handlers are compiled before the edit is accepted. The Events view does not store a hidden callback table or parallel project model.

### Searchable Component Palette

The existing categorized component catalog now has a search field. Search matches component label, source type and category, shows a result count, and keeps the existing source-backed add-control buttons as the sole mutation path.

`Ctrl/Cmd+Shift+A` focuses the component search. When the search has exactly one result, Enter adds that control directly.

The catalog intentionally still exposes only the authoring controls whose full Designer path is implemented. Panel, Timer, PictureBox and StatusBar are not advertised as finished drag-and-drop components merely because Native GUI IR 1.4 can transport them.

### Focus Order Stage 1

Patch Studio now includes a **Focus Order · Stage 1** dialog for the active Form. It lists named focusable controls in current visible source order and can move an item earlier or later by rewriting the existing source block.

This stage is intentionally not presented as independent Delphi `TabOrder` parity. Current Patch desktop/web control creation order follows source order, and the existing block-reorder operation can also affect z-order. A future independent TabOrder contract therefore needs explicit source/runtime metadata rather than a hidden IDE-only integer.

## Website and cache refresh

The generated public site is normalized to the current beta.36 product contract. The Studio P is rendered on a native 22 by 22 SVG coordinate grid with only horizontal and vertical edges and `crispEdges`, avoiding the fractional resampling that could make the old mark look tilted.

The service worker release id is also bumped to beta.36 so older cached Studio shells are replaced. New Object Inspector and Focus Order modules are part of the content-addressed public module graph and offline cache.

## Review boundary

Beta.36 does not claim that every Chrome Stage 1 control is complete. In particular, the native PictureBox source field is transported through IR/payload v14 but the v1.5 desktop runtimes do not yet load that source into an actual image on all platforms. Panel remains visual grouping rather than complete Delphi-style container semantics, and AppKit StatusBar representation is not identical to the Win32/GTK status-specific widget path. See `docs/GROK_REVIEW_2026-08-25.md`.

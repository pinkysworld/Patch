# Patch 0.2.0-beta.36

Patch beta.36 is an integration and RAD-authoring release. It aligns the product surface with the already-versioned Native GUI 1.4 contract and makes Patch Studio more like a conventional Delphi/Visual Basic visual development environment without introducing a hidden form resource format.

## Post-beta.36 integration update, 2026-08-26

The beta.36 contract remains Native GUI IR `1.4`, sealed payload `v14` and desktop runtime `v1.5`, but the Picture follow-up described by the original release boundary has now been implemented.

- Patch Studio exposes Picture through the source-backed component and Resource Manager flow.
- Logical image resources are resolved into deterministic embedded data before current native sealing.
- Windows uses Windows Imaging Component, macOS uses `NSImage`, and Linux uses `GdkPixbuf` for the current embedded Picture path.
- PNG and JPEG are the guaranteed portable current native Picture formats.
- WebP and SVG remain supported Studio/Web project-resource formats but fail closed for current native Picture sealing instead of depending on platform decoder differences.
- The shared native data-URI decoder uses the same 2 MiB per-resource ceiling as the Studio resource model.
- The Chrome runtime smoke fixture now contains an actual embedded PNG and asserts a native image object/bitmap in addition to Picture event dispatch.

The Stage 1 limits that remain are deliberate: Panel is source-order visual grouping rather than complete Delphi-style native containment, and AppKit StatusBar is semantically equivalent but not the same widget class as the Win32/GTK status controls.

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

The shared Window validator understands Panel child controls and the Chrome Stage 1 event contracts used by the current native facade: Timer exposes `ticked` and Picture exposes `clicked`. The token-free/offline linker defaults to the current payload v14 contract. Payload v12 remains the explicit frozen TreeView compatibility selection.

## Offline compiler v0.2

The offline release line moves to `offline-compiler-v0.2`.

Windows x64, Linux x64, macOS Apple Silicon and the macOS Intel kit now build/link against runtime v1.5 and assert payload v14 in smoke tests. The FreeBSD kit remains console-only.

The offline compiler test matrix also links `examples/chrome-window.patch`, so Panel, Timer, Picture and StatusBar Stage 1 cannot be added to the compiler facade without exercising the current native sealing path.

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

### Anchors and Docking

The Object Inspector exposes the existing responsive Window layout contract as Delphi-style **Layout** properties instead of requiring source comments to be typed manually.

For ordinary visual top-level controls, including Panel, the Layout section provides:

- **Mode**: Fixed, Anchors or Dock;
- independent Left, Right, Top and Bottom anchor edges;
- Dock Top, Bottom, Left, Right and Fill;
- quick presets for Top Left, Stretch Width, Stretch Both and Fill;
- the canonical source directive currently represented by the UI.

Every change still writes the existing adjacent source directive, for example:

```patch
# @layout anchor left right top
input search at 24, 24 size 220, 36

# @layout dock fill
panel as workspace at 0, 0 size 640, 420:
  text "Workspace"
```

The compact Resize selector in the Designer toolbar remains as a multi-selection shortcut and uses the same policy functions. Object Inspector and toolbar therefore cannot diverge into separate layout models.

Timer is excluded because it is nonvisual. StatusBar reports its component-owned `dock bottom` contract read-only. The existing responsive Web, Win32, AppKit and GTK paths consume the same policy manifest; this is an authoring improvement rather than a new Native GUI IR version.

### Searchable Component Palette

The existing categorized component catalog has a search field. Search matches component label, source type and category, shows a result count, and keeps source-backed control creation as the mutation boundary.

`Ctrl/Cmd+Shift+A` focuses the component search. When the search has exactly one result, Enter adds that control directly.

The catalog includes **Panel** under **Containers**, **Picture** under **Graphics**, **StatusBar** under **Chrome**, and **Timer** in a dedicated **Nonvisual** category. Each authoring path creates or rewrites ordinary Patch source. Picture can use a quoted source or a logical project resource selected through the Resource Manager.

### Picture and Resource Manager Stage 1

Picture authoring is now source-backed end to end:

- the Component Palette adds Picture controls through the canonical Designer API;
- the Object Inspector exposes Picture identity/source information and resource selection;
- the Resource Manager stores logical image IDs, project-relative paths, media types, deterministic SHA-256 hashes and bounded base64 data;
- missing logical resources fail closed before Web or native output is treated as valid;
- current native sealing resolves logical PNG/JPEG resources into the same payload source field already defined by Native GUI IR 1.4;
- source-less Picture remains a compatibility placeholder instead of being reinterpreted silently.

Studio/Web resources support PNG, JPEG, WebP and SVG. Current portable native embedded Picture decoding guarantees PNG/JPEG.

### Nonvisual component tray and Timer

Patch Studio has a Delphi/VB-style **Nonvisual** component tray beneath the Form canvas. Timer components live in this tray rather than pretending to be visible widgets on the Form.

Timer authoring is source-backed end to end:

- adding a Timer creates a unique Timer id with a default interval of `1000` ms;
- the Object Inspector exposes **Interval (ms)** with a supported range from `1` to `3600000`;
- the Events view exposes **OnTick**, backed by an ordinary `when ... ticked:` source block;
- renaming a Timer updates its `ticked` handler header;
- deleting a Timer removes its matching handler;
- Timer does not consume visual auto-layout space or shift later visible controls.

The tray is a projection of Patch source and the shared Designer selection model. It is not a second component store.

### Panel Stage 1 authoring

Panel Stage 1 has a complete source-backed Studio authoring path for the semantics accepted by the parser and Native GUI 1.4 facade.

A Panel is a normal top-level Designer control: it can be selected, named, moved, resized, duplicated and deleted through the same source-backed control pipeline as other Form controls. New Panels start with a small visible flow-layout group and can be added from **Containers → Panel** in the Component Palette.

The Object Inspector adds a **Panel children** structural editor for the selected Panel. It supports:

- Text;
- Button;
- Input;
- Checkbox;
- Radio group;
- ComboBox;
- ListBox;
- Slider.

Children can be added, edited, reordered, duplicated, removed and revealed in source. Named child duplication allocates fresh ids and duplicates matching source-visible handlers. Renaming a child rewrites its matching `when ... clicked:` or `when ... changed:` header. Deleting a child, deleting the whole Panel or duplicating the Panel performs matching handler cleanup/remapping so the visual operation cannot leave stale callbacks behind.

Panel Stage 1 intentionally keeps child layout as source order / flow layout. It does not invent independent child coordinates, anchors or native containment metadata that the current language/runtime contract does not yet guarantee. That stronger Delphi-style container contract remains a later additive stage.

### Focus Order Stage 1

Patch Studio includes a **Focus Order · Stage 1** dialog for the active Form. It lists named focusable controls in current visible source order and can move an item earlier or later by rewriting the existing source block.

This stage is intentionally not presented as independent Delphi `TabOrder` parity. Current Patch desktop/web control creation order follows source order, and the existing block-reorder operation can also affect z-order. A future independent TabOrder contract therefore needs explicit source/runtime metadata rather than a hidden IDE-only integer.

## Website and cache refresh

The generated public site is normalized to the beta.36+ product contract. The Studio P uses a square geometric SVG coordinate grid with horizontal and vertical edges, avoiding fractional resampling artifacts.

Object Inspector, Anchors/Docking, Focus Order, Menu Designer, Panel authoring, Picture/Resource Manager, StatusBar and Timer authoring belong to the content-addressed public module graph and offline cache.

## Review boundary

The post-beta.36 Picture follow-up is now implemented for the current portable embedded contract. Native runtime v1.5 decodes PNG/JPEG Picture data on Windows, macOS and Linux rather than merely transporting the source field.

Patch still does not claim complete Delphi-style component parity. Panel remains flow-layout visual grouping rather than a complete native child-container contract with independent nested geometry. AppKit StatusBar representation is also not identical to the Win32/GTK status-specific widget path. WebP/SVG are not advertised as portable native Picture formats. See `docs/GROK_REVIEW_2026-08-25.md` for the original review and its post-review status notes.

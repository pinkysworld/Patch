# Patch

A small **change-oriented** language with a browser IDE and versioned desktop runtimes.

**Existing persistent state does not mutate invisibly.** Ordinary post-creation mutation is a semantic `change`.

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Patch Studio](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Development beta `0.2.0-beta.36`** · **Change IR `0.10`** · **Native GUI IR `1.4`** · **payload `v14`** · **desktop runtime `v1.5`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Paper](https://minh.systems/Patch/paper.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html)

```patch
create number score = 0
change score:
  add 1
show score
```

Values are numbers, text, booleans, lists and prototype-free Things. Thing fields are application data: `__proto__`, `prototype` and `constructor` are rejected, runtime records stay prototype-free, and equality compares own fields. Direct Wasm and portable C99 remain the numeric Console subset and fail closed on Things; that stays outside the beta.32 formal claim.

## Patch Studio

The IDE keeps Forms, geometry and control structure in ordinary `.patch` source. There is no hidden `.frm` / `.dfm`.

- Multi-file project bundle v3, Project Tree, recovery and diagnostics that name owning `file:line`
- Source-backed Designer: Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs
- RAD layout tools: Left/Right, Top/Bottom, horizontal/vertical center, Same Width/Height, equal horizontal/vertical spacing, Center, Default size, Auto place, Bring to front / Send to back and the 8 px grid
- **Ctrl/Cmd+K Command Palette** with files, Thing fields as `player.score` and recipe parameters as `reward.bonus`

Open **Workshop desk** in Example for Harbor Desk, a repair-counter app that uses the current Designer control set, two Forms, Things, recipes and `change`. It compiles and builds as a Standalone Window Web App.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md), [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) and [`docs/BETA36.md`](docs/BETA36.md).

## GUI events

Toolkit interaction stays transient until source commits it through `change`:

- Input, ComboBox, Radio and text-backed ListBox expose text `value`
- Checkbox exposes Boolean `value`
- Slider exposes a bounded finite numeric `value`
- list-backed ListBox exposes a transient text-list
- Table exposes the selected row as a transient text-list
- TreeView exposes the selected root-to-node path as a transient text-list
- Timer Stage 1 exposes native `ticked` delivery on the current v1.5 desktop line

## Native desktop

The product-facing current contract is Native GUI IR 1.4 / sealed payload v14 / runtime v1.5. Versioned older contracts remain compatibility evidence and are not silently reinterpreted.

| Line | IR / payload / runtime | Role |
|---|---|---|
| Current Ready/offline | Native GUI IR 1.4 / sealed payload v14 / runtime v1.5 | Previous Table, menus, TreeView, multi-select ListBox and Slider support plus Chrome Stage 1 Panel, Timer, PictureBox transport and StatusBar |
| Slider compatibility | Native GUI IR 1.3 / sealed payload v13 / runtime v1.4 | Previous Slider-capable compatibility line via Win32 `TRACKBAR`, AppKit `NSSlider`, GTK3 `GtkScale` |
| Frozen TreeView | Native GUI IR 1.2 / payload v12 / runtime v1.3 | Frozen TreeView compatibility line, Slider fail-closed |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Ready/offline Windows, macOS and Linux paths are token-free. See [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md).

Chrome Stage 1 is deliberately scoped. PictureBox `source` is transported through IR/payload v14 but complete portable image decoding/loading is not yet claimed. Panel currently provides visual grouping rather than full Delphi-style native child-container semantics. See [`docs/GROK_REVIEW_2026-08-25.md`](docs/GROK_REVIEW_2026-08-25.md).

Public Studio deployments also run a real Chrome responsiveness gate before the site is marked healthy.

## Offline compiler

The rolling offline release is `offline-compiler-v0.2`. Windows x64, Linux x64, macOS Apple Silicon and the macOS Intel kit use the current runtime v1.5 Window path and assert sealed payload v14 in the cross-platform smoke matrix. FreeBSD remains Console-only through the portable C99 path.

See [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) and the public [Downloads](https://minh.systems/Patch/downloads.html) page.

## Formal boundary

beta.32 is invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment. Patch does **not** claim full compiler/runtime verification. Native GUI and Studio work do not widen that claim.

## Quick commands

```bash
npm test
npm run check:site
npm run check:project
npm run build:site
```

```bash
patch check app.patch --json
patch build app.patch --target web
patch link app.patch --out App
patch doctor --json
```

`patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset, including that Things fail closed on those backends. On Unix hosts with a C compiler it also compiles and runs the numeric C99 program.

## Documentation

| Doc | What |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Language |
| [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) | IDE and builds |
| [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) | Designer inventory |
| [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) | Native contracts |
| [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) | Current + frozen lines |
| [`docs/BETA36.md`](docs/BETA36.md) | beta.36 integration milestone |
| [`docs/GROK_REVIEW_2026-08-25.md`](docs/GROK_REVIEW_2026-08-25.md) | implementation audit and open gaps |
| [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) | Assurance scope |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Backlog and evidence gates |
| [`paper/README.md`](paper/README.md) | Paper sources |

Patch is an active research/prototype language and IDE. Version labels are explicit so product work does not silently broaden older runtime or formal claims.
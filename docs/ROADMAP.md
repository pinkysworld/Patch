# Roadmap

## 0.1 beta: language feel

- [x] `create`
- [x] `change`
- [x] `set` / `add` / `remove` / `clear`
- [x] `show`
- [x] `if` / `else`
- [x] `repeat`
- [x] simple things
- [x] recipes (`make` / `do`)
- [x] change history
- [x] inverse generation
- [x] undo / redo
- [x] preview
- [x] watch
- [x] conservative conflict helper
- [x] browser playground
- [x] Windows/macOS/Linux CI
- [x] paper draft

## 0.2 beta: compiler + Patch Studio

- [x] first compiler front end
- [x] Change IR
- [x] portable `.patchapp` manifest/bundle
- [x] `patch run`
- [x] `patch check`
- [x] `patch build ... --target portable`
- [x] browser-first Patch Studio shell
- [x] local project autosave
- [x] Change IR viewer
- [x] installable PWA metadata/offline cache
- [x] responsive iPhone/iPad layout
- [x] `window` syntax
- [x] `text`, `button`, `input`
- [x] `when ... clicked`
- [x] virtual Patch UI model
- [x] browser GUI preview
- [x] deterministic GitHub Pages site build
- [x] deployed-site integrity check in CI
- [ ] typed AST
- [ ] expression IR instead of expression strings
- [ ] serialized `.patchlog` history
- [ ] `replay` command
- [ ] source locations inside every runtime change record
- [ ] property-based inverse/composition tests
- [ ] Studio timeline visualization

## 0.3: Patch UI + visual application model

- [ ] `list`, `image`, `checkbox`, `slider`, `menu`, `tabs`, `canvas`
- [ ] `when ... changed/closed` events
- [ ] two-way `input` binding
- [ ] visual form/window designer
- [ ] property inspector
- [ ] project file import/export
- [ ] immediate mode against a running application
- [ ] GUI change history / visual rewind
- [ ] keyboard-oriented desktop layout and touch-first mobile layout

## 0.4: portable execution backend

- [ ] Rust compiler implementation
- [ ] WebAssembly code generation
- [ ] WASI console runtime
- [ ] runnable `.patchapp` host
- [ ] browser Wasm runner
- [ ] runtime capability model
- [ ] compiler benchmark harness

## 0.5: native application packaging

- [ ] Windows console `.exe`
- [ ] Windows GUI-subsystem `.exe`
- [ ] macOS CLI executable
- [ ] macOS `.app` bundle
- [ ] macOS Universal packaging where practical
- [ ] Linux CLI executable
- [ ] Linux graphical executable
- [ ] FreeBSD/OpenBSD/NetBSD runtime targets
- [ ] generic Unix C99 fallback for console applications
- [ ] Patch UI native Windows backend
- [ ] Patch UI native macOS backend
- [ ] SDL3 portable GUI backend for Linux/BSD/other supported Unix

## 0.6: build service

- [ ] **Build for…** dialog in Patch Studio
- [ ] GitHub Actions remote build integration
- [ ] Windows/macOS/Linux artifact matrix
- [ ] iPhone/iPad can request native desktop builds
- [ ] signing/notarization hooks
- [ ] release artifact download back into Patch Studio

## 0.7: collaboration semantics

- [ ] branchable state histories
- [ ] explicit merge operation
- [ ] semantic conflict explanations
- [ ] safe commuting changes
- [ ] optional CRDT-backed types for well-understood cases
- [ ] offline/local persistence

## Research artifact

- [ ] systematic related-work review including ChEOPS/COPE/Edit Transactions
- [ ] formal State-Change Factorization calculus
- [ ] machine-checked core properties
- [ ] benchmark suite
- [ ] novice study with ethics/consent as required
- [ ] cross-platform application case studies
- [ ] reproducibility bundle

## Design constraints

1. Every new language feature must answer: **Can a beginner ignore this feature and still understand ordinary Patch code?**
2. Platform complexity belongs in the compiler/runtime, not in Patch source.
3. Patch Studio should remain usable from a phone, tablet, desktop browser, or native shell.
4. Console and GUI applications use the same language, variables, change semantics, functions, and compiler.
5. High-venue research claims must come from formal semantics and measured evidence, not from product polish alone.

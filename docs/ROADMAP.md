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

## 0.2 beta: compiler + Patch Studio + semantic contracts

- [x] first compiler front end
- [x] Change IR
- [x] portable `.patchapp` manifest/bundle
- [x] bootstrap WebAssembly `.wasm` module carrying source + Change IR
- [x] WebAssembly validation/instantiation tests
- [x] `patch run`
- [x] `patch check`
- [x] `patch changes`
- [x] `patch build ... --target portable`
- [x] `patch build ... --target wasm`
- [x] browser-first Patch Studio shell
- [x] local project autosave
- [x] Change IR viewer
- [x] Change Contract viewer
- [x] installable PWA metadata/offline cache
- [x] responsive iPhone/iPad layout
- [x] `window` syntax
- [x] `text`, `button`, `input`
- [x] `when ... clicked`
- [x] virtual Patch UI model
- [x] browser GUI preview
- [x] first visual Designer toolbox
- [x] semantic Change Signature inference for recipes
- [x] semantic operation classes (`increase`, `decrease`, `add`, `remove`, `set`, `clear`)
- [x] `allow` Change Capability policies
- [x] optional `up to` numeric bounds
- [x] conservative bound checking
- [x] transitive signature substitution for simple recipe calls
- [x] deterministic GitHub Pages site build
- [x] deployed-site integrity check in CI
- [ ] typed AST
- [ ] expression IR instead of expression strings
- [ ] serialized `.patchlog` history
- [ ] `replay` command
- [ ] source locations inside every runtime change record
- [ ] property-based inverse/composition tests
- [ ] Studio timeline visualization

## 0.3: richer semantic analysis + Patch UI RAD designer

- [ ] typed/range-aware Change Signature inference
- [ ] prove bounded dynamic expressions, e.g. `bonus <= 10`
- [ ] fixed-point analysis for recursive call graphs
- [ ] richer parameter/path substitution
- [ ] capability aliases/groups for larger programs
- [ ] explain why a capability proof failed in Patch Studio
- [ ] causal `why value` / `why condition` prototype
- [ ] control selection in Designer
- [ ] drag positioning/resizing with deterministic source/project representation
- [ ] property inspector
- [ ] create/edit event handlers from Designer
- [ ] `list`, `image`, `checkbox`, `slider`, `menu`, `tabs`, `canvas`
- [ ] `when ... changed/closed` events
- [ ] two-way `input` binding
- [ ] project file import/export
- [ ] immediate mode against a running application
- [ ] GUI change history / visual rewind
- [ ] keyboard-oriented desktop layout and touch-first mobile layout

## 0.4: direct portable execution backend

- [ ] typed core suitable for formalization
- [ ] direct Change IR-to-WebAssembly lowering for deterministic core
- [ ] preserve semantic Change Signature evidence across lowering
- [ ] WASI console runtime
- [ ] runnable `.patchapp` host
- [ ] browser Wasm runner executing lowered code
- [ ] Patch UI host-call interface for compiled GUI apps
- [ ] runtime capability model
- [ ] compiler benchmark harness
- [ ] Rust compiler migration where it materially improves the toolchain

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
- [ ] capability-aware collaboration/merge policies

## Research artifact

- [ ] systematic related-work review including Plaid, Worlds, effect systems, capability/effect systems, ChEOPS/COPE/Edit Transactions, reducer architectures and behavioral permissions
- [x] design-stage State-Change Factorization calculus
- [x] design-stage Change Signature / Change Capability formalization
- [ ] machine-checked State-Change Factorization
- [ ] machine-checked Change Signature soundness
- [ ] machine-checked Change Capability soundness
- [ ] benchmark suite
- [ ] semantic-security case-study corpus
- [ ] novice study with ethics/consent as required
- [ ] cross-platform application case studies
- [ ] reproducibility bundle

## Design constraints

1. Every new language feature must answer: **Can a beginner ignore this feature and still understand ordinary Patch code?**
2. Platform complexity belongs in the compiler/runtime, not in Patch source.
3. Patch Studio should remain usable from a phone, tablet, desktop browser, or native shell.
4. Console and GUI applications use the same language, variables, change semantics, functions and compiler.
5. High-venue research claims must come from formal semantics and measured evidence, not from product polish alone.
6. Bootstrap infrastructure must be described honestly: embedding Change IR in Wasm is not the same as direct Wasm lowering.
7. Semantic capability analysis must be conservative: when Patch cannot prove a bounded change safe, it must reject/mark it unproven rather than guess.

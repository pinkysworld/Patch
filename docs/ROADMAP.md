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

## 0.2 beta: research artifact

- [ ] serialized `.patchlog` history
- [ ] `replay` command
- [ ] source locations inside every change record
- [ ] first-class advanced change values without complicating beginner syntax
- [ ] richer lists/maps
- [ ] user-defined schemas
- [ ] property-based inverse/composition tests
- [ ] mutation-transparency test generator
- [ ] playground timeline visualization

## 0.3 beta: collaboration semantics

- [ ] branchable state histories
- [ ] explicit merge operation
- [ ] semantic conflict explanations
- [ ] safe commuting changes
- [ ] optional CRDT-backed types for well-understood cases
- [ ] offline/local persistence

## 0.4 compiler

- [ ] Rust front end
- [ ] typed AST
- [ ] Change IR
- [ ] WebAssembly/WASI backend
- [ ] standalone Windows/macOS/Linux builds
- [ ] browser Wasm bundle

## 0.5 paper artifact

- [ ] complete systematic related-work review
- [ ] mechanized or machine-checked core properties
- [ ] benchmark suite
- [ ] novice study with ethics/consent as required
- [ ] reproducibility bundle

## Design constraint

Every new feature must answer: **Can a beginner ignore this feature and still understand ordinary Patch code?** If not, the feature should live behind an advanced layer or outside the language core.

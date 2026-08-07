# Patch

> **A tiny change-oriented programming language with one IDE for everywhere.**
>
> Create things, change them, run them, and build applications.

Patch is an experimental general-purpose language built around one deliberately simple idea:

**state does not mutate invisibly. Every persistent mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The language is intended to stay easy enough for a beginner while the compiler/runtime derives history, undo/redo, preview, replay foundations and conflict analysis from the same semantic change representation.

## Patch Studio

Public Patch Studio / project site:

**https://pinkysworld.github.io/Patch/**

Patch Studio is browser-first and installable as a PWA. It is designed for Windows, macOS, Linux, iPhone/iPad, Android, ChromeOS and browser-capable BSD/Unix systems.

On iPhone/iPad, open Patch Studio in Safari and use **Share → Add to Home Screen**. The Studio can edit Patch, add basic GUI controls through the visual Designer, run console/window programs locally, inspect Change IR, and build portable `.patchapp` or bootstrap `.wasm` artifacts. Future native Windows/macOS/Linux builds requested from iOS will use remote platform build runners.

## Current status

Current development beta: **0.2.0-beta.1**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR that keeps `change` explicit;
- portable `.patchapp` bundles;
- valid bootstrap WebAssembly `.wasm` modules containing Patch source + Change IR;
- console programs;
- GUI language: `window`, `text`, `button`, `input`, and `when ... clicked`;
- live GUI preview in Patch Studio;
- first visual form-Designer toolbox that edits normal Patch source;
- history, watch, preview, undo and redo;
- browser/PWA Studio with local autosave and offline core assets;
- automated CI on Windows, macOS and Linux;
- deterministic static-site build and deployment validation.

The compiler path is:

```text
Patch source
   -> AST / typed AST evolution
   -> Change IR
   -> portable .patchapp            [implemented]
   -> bootstrap WebAssembly .wasm   [implemented]
   -> direct Change IR -> Wasm      [next]
   -> native host packaging         [roadmap]
```

The bootstrap `.wasm` is a genuine instantiable WebAssembly module and portable compiler artifact. It currently embeds the compiled Patch payload for a Patch host. It does **not** yet execute every Patch operation as directly lowered Wasm instructions. Native `.exe`, `.app`, ELF and BSD/Unix executables are also not claimed as finished yet.

## One language for console and GUI applications

Console:

```patch
show "Hello world"
```

Window application:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

The long-term output matrix is:

| Target | Console | GUI |
| --- | --- | --- |
| Windows | `.exe` | GUI-subsystem `.exe` |
| macOS | CLI executable | `.app` |
| Linux | native executable | native graphical executable |
| FreeBSD/OpenBSD/NetBSD/Unix | native or C99 fallback | Patch UI / SDL3 fallback |
| Browser | WebAssembly | Web/Patch UI |
| Portable | `.patchapp` | `.patchapp` |

Patch UI hides Cocoa/AppKit, Windows APIs and Unix/SDL details from ordinary Patch source.

## CLI

The JavaScript beta toolchain requires Node.js 22+.

Run:

```bash
patch run examples/score.patch
```

Compile/check to Change IR:

```bash
patch check examples/score.patch
```

Build a portable app:

```bash
patch build examples/score.patch --kind console --target portable
```

Build bootstrap WebAssembly:

```bash
patch build examples/score.patch --kind console --target wasm
```

Build and validate the public Patch Studio site:

```bash
npm run build:site
npm run check:site
```

## Visual Designer

Patch Studio's current Designer can insert text, buttons and inputs into the first window while modifying the same readable `.patch` source you can edit by hand.

For example, choosing **+ Button** creates source such as:

```patch
window "My App":
  button "Button" as button_1
```

The next Designer stages add selection, drag positioning/resizing, properties, more controls and event creation. Patch will not hide GUI definitions in an opaque second language.

## Language tour

```patch
create number lives = 3
create text hero = "Mia"
create list fruits = apple, banana

change lives:
  remove 1

change fruits:
  add orange
  remove banana

if lives > 0:
  show "keep playing"
else:
  show "game over"

repeat 3:
  change lives:
    add 1
```

Things are simple records:

```patch
create thing player:
  name = "Sam"
  score = 0
  lives = 3

change player:
  add 10 to score
  remove 1 from lives
  set name = "Alex"
```

Patch can inspect semantic changes:

```patch
watch score
change score called bonus:
  add 10
history score
undo bonus
redo
```

## Research identity

Patch does **not** claim that patches, first-class changes, first-class state change, undo, reified program state, event logs, reversible computation, lenses, CRDTs, incremental computation or earlier change-oriented programming environments are new.

The current PL contribution candidate is stronger and more precise:

> **State-Change Factorization:** every supported post-creation persistent mutation must compile/execute through a semantic change `delta` such that `apply(delta, S) = S'`; the semantic change is the mutation mechanism rather than a log generated after hidden assignment.

Supporting research properties include:

1. **Mutation Transparency**: every committed post-creation persistent mutation has an inspectable semantic change.
2. **Inverse correctness** for the invertible change fragment.
3. **Preview equivalence** without committing history.
4. **Replay consistency** for the deterministic fragment.
5. **Commutation/conflict soundness** for cases Patch classifies as independent.
6. **Uniform derived tooling**: history, inversion, preview, replay foundations, conflict reasoning and GUI state evolution reuse one Change IR.
7. **Progressive disclosure**: beginners see `create`, `change`, `add`, `remove`, `window` and `when`; the algebra remains underneath.

The novelty review now explicitly compares Patch against Plaid's first-class state change, Worlds' reified program-state model, XMF first-class undo, ChEOPS/COPE, Edit Transactions, reducer/event architectures, lenses and patch theory.

Patch is therefore a **credible high-venue research direction, but not yet a high-venue result**. A serious top PL submission requires systematic prior-art analysis, formal/machine-checked core properties, direct compiled execution, benchmark evidence and preferably controlled novice-comprehension data.

See `docs/NOVELTY.md`, `docs/FORMAL_MODEL.md`, `docs/SEMANTICS.md`, `docs/RESEARCH_PLAN.md` and `paper/main.tex`.

## Repository map

```text
src/                    parser, interpreter, change algebra, compiler, Wasm bootstrap, Designer helpers, bundler
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, compiler, UI, Designer and Wasm tests
examples/               runnable .patch programs
docs/SPEC.md             language specification
docs/FORMAL_MODEL.md     State-Change Factorization calculus and Lean proof plan
docs/SEMANTICS.md        implementation-oriented semantic notes
docs/NOVELTY.md          prior-art boundary and novelty claim
docs/RESEARCH_PLAN.md    evaluation and publication plan
docs/COMPILER.md         Change IR and compiler architecture
docs/PATCH_STUDIO.md     IDE and mobile development design
docs/TARGETS.md          platform/output targets
docs/ROADMAP.md          implementation milestones
paper/                   manuscript draft
.github/workflows/       cross-platform CI and Pages deployment
```

## CI quality gate

Every CI matrix entry must pass:

```text
JavaScript syntax checks
language/compiler/UI/Designer/Wasm tests
example smoke tests
portable .patchapp build
WebAssembly build
public-site build
public-site integrity validation
```

The matrix runs on Windows, macOS and Linux with supported Node.js release lines.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

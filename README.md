# Patch

> **A tiny change-oriented programming language with one IDE for everywhere.**
>
> Create things, change them, inspect them, run them, and build applications.

Patch is an experimental general-purpose language built around one deliberately simple idea:

**state does not mutate invisibly. Every persistent mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The language is intended to stay easy enough for a beginner while the compiler/runtime derives history, undo/redo, preview, replay foundations, conflict analysis, semantic Change Signatures, and optional Change Capabilities from the same structured change model.

## Patch Studio

Public Patch Studio / project site:

**https://pinkysworld.github.io/Patch/**

Patch Studio is browser-first and installable as a PWA. It is designed for Windows, macOS, Linux, iPhone/iPad, Android, ChromeOS and browser-capable BSD/Unix systems.

On iPhone/iPad, open Patch Studio in Safari and use **Share → Add to Home Screen**. The Studio can edit Patch, add basic GUI controls through the visual Designer, run console/window programs locally, inspect Change IR and the new **Change Contract** view, and build portable `.patchapp` or bootstrap `.wasm` artifacts. Future native Windows/macOS/Linux builds requested from iOS will use remote platform build runners.

## Current status

Current development beta: **0.2.0-beta.2**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR that keeps `change` explicit;
- automatically inferred semantic **Change Signatures** for recipes;
- compile-time **Change Capabilities** with path/operation rules and optional numeric bounds;
- conservative transitive analysis through simple recipe calls;
- `patch changes` CLI inspection;
- Patch Studio **Change Contract** tab;
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
   -> AST
   -> semantic Change Signature analysis
   -> Change Capability validation
   -> Change IR
   -> portable .patchapp            [implemented]
   -> bootstrap WebAssembly .wasm   [implemented]
   -> direct Change IR -> Wasm      [next]
   -> native host packaging         [roadmap]
```

The bootstrap `.wasm` is a genuine instantiable WebAssembly module and portable compiler artifact. It currently embeds the compiled Patch payload for a Patch host. It does **not** yet execute every Patch operation as directly lowered Wasm instructions. Native `.exe`, `.app`, ELF and BSD/Unix executables are also not claimed as finished yet.

## Semantic Change Signatures

Patch can infer what kinds of persistent changes a recipe may produce.

```patch
make reward(player):
  change player:
    add 5 to score
```

The compiler derives conceptually:

```text
reward(player)
  player.score -> increase by 5
```

This is not extra syntax the programmer has to maintain. It is derived from the same semantic operations used by Patch execution.

Use:

```bash
patch changes examples/change-capabilities.patch
```

to inspect inferred recipe effects from the CLI.

## Change Capabilities

A recipe can optionally declare the semantic changes it is allowed to produce:

```patch
allow reward:
  player.score may increase up to 10

make reward(player):
  change player:
    add 5 to score
```

This compiles because the inferred change is inside the declared policy.

This does not:

```patch
make reward(player):
  change player:
    set score = 999
```

Even though both operations write `player.score`, `set` is not an allowed `increase`.

Likewise, a statically known `add 25 to score` violates the `up to 10` bound. If the current beta cannot prove a bounded dynamic amount safe, it rejects the proof rather than guessing.

Conceptually:

```text
ProducedChanges(recipe) subset-of AllowedChanges(recipe)
```

This is the new **Semantic Change Contract** layer built on top of State-Change Factorization.

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

Compile/check:

```bash
patch check examples/score.patch
```

Inspect semantic changes and policies:

```bash
patch changes examples/change-capabilities.patch
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

Patch does **not** claim that patches, first-class changes, first-class state change, effect systems, capabilities, typestate, undo, reified program state, event logs, reversible computation, lenses, CRDTs, incremental computation or earlier change-oriented programming environments are new.

The current PL contribution candidate has two layers:

> **State-Change Factorization:** every supported post-creation persistent mutation must compile/execute through a semantic change `delta` such that `apply(delta, S) = S'`; the semantic change is the mutation mechanism rather than a log generated after hidden assignment.

and:

> **Semantic Change Contracts:** Patch infers semantic Change Signatures from those mandatory deltas and can verify that the changes a recipe may produce stay inside an optional declared Change Capability policy.

Supporting research properties include:

1. **Mutation Transparency**: every committed post-creation persistent mutation has an inspectable semantic change.
2. **Change Signature soundness**: inferred signatures conservatively cover committed changes in the supported fragment.
3. **Change Capability soundness**: accepted protected recipes cannot commit changes outside their declared semantic policy.
4. **Inverse correctness** for the invertible change fragment.
5. **Preview equivalence/non-interference** without committing history.
6. **Replay consistency** for the deterministic fragment.
7. **Commutation/conflict soundness** for cases Patch classifies as independent.
8. **Progressive disclosure**: beginners can ignore the algebra and optional policy layer.

The novelty review explicitly compares Patch against Plaid's first-class state change, Worlds' reified program-state model, classical effect systems, Effects as Capabilities/Effekt, XMF first-class undo, ChEOPS/COPE, Edit Transactions, reducer/event architectures, lenses and patch theory.

Patch remains a **credible high-venue research direction, but not yet a high-venue result**. A serious top PL submission still requires systematic prior-art analysis, formal/machine-checked core properties, direct compiled execution, benchmark/security evidence and preferably controlled novice-comprehension data.

See `docs/NOVELTY.md`, `docs/FORMAL_MODEL.md`, `docs/SEMANTICS.md`, `docs/RESEARCH_PLAN.md` and `paper/main.tex`.

## Repository map

```text
src/                    parser, interpreter, change algebra, change analysis, compiler, Wasm bootstrap, Designer helpers, bundler
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, compiler, Change Capability, UI, Designer and Wasm tests
examples/               runnable .patch programs
docs/SPEC.md             language specification
docs/FORMAL_MODEL.md     factorization + semantic capability proof targets
docs/SEMANTICS.md        implementation-oriented semantic notes
docs/NOVELTY.md          prior-art boundary and novelty claim
docs/RESEARCH_PLAN.md    evaluation and publication plan
docs/COMPILER.md         Change IR and compiler architecture
docs/PATCH_STUDIO.md     IDE and mobile development design
docs/TARGETS.md          platform/output targets
docs/ROADMAP.md          implementation milestones
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI and Pages deployment
```

## CI quality gate

Every CI matrix entry must pass:

```text
JavaScript syntax checks
language/compiler/Change-Capability/UI/Designer/Wasm tests
compile + execute example smoke tests
portable .patchapp build
WebAssembly build
public-site build
public-site integrity validation
```

The matrix runs on Windows, macOS and Linux with supported Node.js release lines.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

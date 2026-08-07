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

The public Patch Studio site and browser IDE is intended to live at:

**https://pinkysworld.github.io/Patch/**

Patch Studio is browser-first and installable as a PWA. It is designed for Windows, macOS, Linux, iPhone/iPad, Android, ChromeOS and browser-capable BSD/Unix systems.

On iPhone/iPad, open Patch Studio in Safari and use **Share → Add to Home Screen**. The Studio can edit and run Patch locally, preview GUI applications, inspect Change IR and build portable `.patchapp` bundles. Future native Windows/macOS/Linux builds requested from iOS will use remote platform build runners.

## Current status

Current development beta: **0.2.0-beta.1**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR that keeps `change` explicit;
- portable `.patchapp` bundles;
- console programs;
- first GUI language slice: `window`, `text`, `button`, `input`, and `when ... clicked`;
- live GUI preview in Patch Studio;
- history, watch, preview, undo and redo;
- browser/PWA Studio with local autosave;
- automated CI on Windows, macOS and Linux;
- deterministic static-site build and deployment validation.

The compiler path is:

```text
Patch source
   -> AST / typed AST evolution
   -> Change IR
   -> portable .patchapp       [implemented]
   -> WebAssembly              [next backend]
   -> native host packaging    [roadmap]
```

Native `.exe`, `.app`, ELF and BSD/Unix executables are not claimed as finished yet.

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
| Browser | WebAssembly/WASI-style target | Web/Patch UI |
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

Build and validate the public site:

```bash
npm run build:site
npm run check:site
```

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

Patch does **not** claim that patches, first-class changes, undo, event logs, reversible computation, lenses, CRDTs, incremental computation or change-oriented programming environments are new.

The research hypothesis is narrower:

> **What happens if explicit semantic change is the exclusive primitive for ordinary mutable application state in a deliberately low-complexity general-purpose language?**

The current contribution candidate combines:

1. **Mutation Transparency**: every post-creation persistent state mutation corresponds to an inspectable semantic change.
2. **Change-as-execution**: mutation is executed through the normalized change representation rather than logged after ordinary assignment.
3. **Uniform derived tooling**: inversion, preview, history, replay foundations, conflict reasoning and GUI state evolution reuse the same Change IR.
4. **Progressive disclosure**: beginners use `create`, `change`, `add`, `remove`, `window` and `when`; the algebra stays underneath.
5. **Integrated environment**: the same language and Studio span console, GUI, browser and planned native targets.

For a high-venue paper, the repository treats novelty as a hypothesis to test, not a finished priority claim. The submission path requires a systematic related-work review, formal or machine-checked core properties, a larger compiler/runtime artifact, benchmark evaluation and preferably a controlled novice-comprehension study.

See `docs/NOVELTY.md`, `docs/SEMANTICS.md`, `docs/RESEARCH_PLAN.md` and `paper/main.tex`.

## Repository map

```text
src/                    parser, interpreter, change algebra, compiler, bundler
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, compiler and UI tests
examples/               runnable .patch programs
docs/SPEC.md             language specification
docs/SEMANTICS.md        formal core and research properties
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
syntax checks
language tests
example smoke tests
portable application build
public-site build
public-site integrity validation
```

The matrix runs on Windows, macOS and Linux with supported Node.js release lines.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

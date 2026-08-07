# Patch

> **A tiny change-oriented programming language with one IDE for everywhere.**
>
> You create things, change them, run them, and build applications.

Patch is an experimental general-purpose language built around one deliberately simple idea:

**state does not mutate invisibly. Every mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The language is intended to stay easy enough for a beginner while the compiler/runtime derives history, undo/redo, preview, replay foundations, and conflict analysis from the same semantic change representation.

## Development status

Current stable beta on `main`: **0.1.0-beta.1**

Current development line: **0.2 compiler + Patch Studio**

Patch 0.2 introduces a real compiler front end alongside the interpreter:

```text
Patch source
   -> AST
   -> Change IR
   -> portable .patchapp       [implemented in 0.2 dev]
   -> WebAssembly              [next backend]
   -> Windows/macOS/Linux/BSD  [native packaging roadmap]
```

`change` is preserved explicitly in the compiler IR. It is not merely ordinary assignment plus logging.

## Patch Studio

Patch Studio is the universal IDE for Patch. It is browser-first and installable as a Progressive Web App.

That means the same development environment is designed to work on:

- Windows
- macOS
- Linux
- iPhone and iPad
- Android
- ChromeOS
- FreeBSD/OpenBSD/NetBSD and other Unix-like systems with a modern browser

### Developing from iPhone

Yes. The 0.2 Studio development version is responsive for iPhone/iPad, autosaves the current project in the browser, runs Patch programs locally, exposes the compiler Change IR, and can build the current portable `.patchapp` format locally.

Native `.exe` and `.app` generation will use remote platform build runners because iOS cannot host Windows/macOS desktop compiler and signing toolchains. The intended flow is:

```text
iPhone Patch Studio
    |
    +-- edit
    +-- run locally
    +-- inspect Change IR
    +-- build .patchapp locally
    `-- Build for…
           |
           +-- Windows runner -> .exe
           +-- macOS runner   -> .app / CLI
           +-- Linux runner   -> executable
           `-- Web/Wasm       -> web package
```

See `docs/PATCH_STUDIO.md`.

## Application types

Patch uses one language for console and GUI/window applications.

### Console

```patch
show "Hello world"
```

Long-term build targets:

- Windows `.exe`
- macOS command-line executable
- Linux command-line executable
- BSD/Unix command-line executable
- WebAssembly/WASI
- portable `.patchapp`

### Window application

Planned Patch UI syntax:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

The visual Patch Studio form designer will generate/edit the same readable Patch source rather than hiding a second UI language.

Planned native outputs:

- Windows GUI-subsystem `.exe`
- macOS `.app`
- Linux/BSD graphical executable
- browser/WebAssembly application
- portable `.patchapp`

Patch UI will abstract the host platform. Native Windows and macOS backends are planned, with SDL3 as the broad portable GUI fallback for Linux/BSD/other supported Unix systems.

## Try the current beta

### Patch Studio / browser

```bash
npm run serve
```

Then open `http://localhost:4173`.

The `web/` directory is static-hosting friendly and intended for GitHub Pages.

### Command line

Node.js 20+ is currently the only requirement for the JavaScript beta toolchain.

Run:

```bash
patch examples/score.patch
patch run examples/score.patch
```

Check/compile to Change IR:

```bash
patch check examples/score.patch
```

Build a portable application bundle:

```bash
patch build examples/score.patch --kind console --target portable
```

This produces a `.patchapp` file containing the manifest, Patch source, and compiler IR. Native `.exe`, `.app`, ELF and Wasm backends are roadmap items, not yet implemented.

## Language tour

### Create

```patch
create number lives = 3
create text hero = "Mia"
create list fruits = apple, banana
```

### Change

```patch
change lives:
  remove 1

change fruits:
  add orange
  remove banana
```

### Things

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

### Inspect changes

```patch
watch score

change score called bonus:
  add 10

history score
undo bonus
redo
```

### Preview before committing

```patch
preview:
  change score:
    add 100

show score
```

### Conditions

```patch
if age < 10:
  show "You are a child"
else:
  show "You are older"
```

### Repetition

```patch
repeat 5:
  change score:
    add 1
```

### Tiny recipes

```patch
make greet(name):
  show "Hello " + name

do greet("Ada")
```

## Research identity

Patch does **not** claim that patches, undo, event logs, reversible computation, lenses, CRDTs, or change propagation are new.

The research hypothesis is narrower:

> **What happens if explicit semantic change is the exclusive primitive for ordinary mutable application state in a deliberately low-complexity general-purpose language?**

Patch explores whether one mutation model can simultaneously provide:

1. **Mutation transparency**: every post-creation state mutation corresponds to an inspectable semantic change.
2. **Uniform reversibility**: invertible primitive changes generate inverse changes automatically.
3. **Replayability**: state evolution is represented as an ordered semantic history.
4. **Conflict reasoning**: changes can be compared at semantic operation/path level instead of only as snapshots.
5. **Low conceptual distance**: beginners see `create`, `change`, `add`, and `remove`, not command logs or inverse functions.
6. **Tool unification**: execution, GUI state, history, preview, debugging, and eventually synchronization use the same Change IR.

See `docs/NOVELTY.md` and `paper/main.tex`.

## Repository map

```text
src/                    parser, interpreter, change algebra, compiler, .patchapp bundler
web/                    Patch Studio PWA
tests/                  language + compiler tests
examples/               runnable .patch programs
docs/SPEC.md             language specification
docs/SEMANTICS.md        formal core and research properties
docs/NOVELTY.md          prior-art boundary and novelty claim
docs/RESEARCH_PLAN.md    evaluation and publication plan
docs/COMPILER.md         compiler / Change IR / native target architecture
docs/PATCH_STUDIO.md     universal IDE and iPhone development design
docs/ROADMAP.md          implementation milestones
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI and Pages workflow
```

## Tests

```bash
npm test
npm run check
```

CI runs the JavaScript beta toolchain on Windows, macOS, and Linux.

## Long-term portability

The target architecture is:

```text
                    Patch source
                         |
                     Change IR
                    /    |     \
                   /     |      \
                Wasm   native    C99 fallback
                  |      host       |
               browser  Win/Mac/   unusual Unix
                        Linux/BSD
```

The canonical portable application format is `.patchapp`. Native packages should embed or accompany the Patch runtime so end users do not need to install Patch separately.

## Research paper

The repository includes the manuscript draft:

**Patch: Change-Oriented Programming with Transparent State Evolution**

The paper remains an artifact/design manuscript until the planned benchmark and novice-study results exist. Results will not be invented or backfilled.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

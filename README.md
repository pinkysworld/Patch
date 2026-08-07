# Patch

> **A tiny change-oriented programming language.**
>
> You create things, change them, and see what happened.

Patch is an experimental general-purpose language built around one deliberately simple idea:

**state does not mutate invisibly. Every mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The source language stays small enough for a beginner, while the runtime records a structured change for every mutation. That one design choice gives Patch automatic history, undo/redo, preview, deterministic replay foundations, and conflict analysis without exposing those mechanisms to beginners.

## Beta status

Current version: **0.1.0-beta.1**

The beta is a real interpreter, not a syntax mock-up. It currently supports:

- `create` for numbers, text, booleans, lists, and simple things/records;
- `change` with `set`, `add`, `remove`, and `clear`;
- semantic change records with before/after state and structural inverse operations;
- named changes;
- `undo` and `redo`;
- `preview` without committing state;
- `history` and `watch`;
- `if` / `else`;
- `repeat`;
- tiny reusable recipes with `make` and `do`;
- browser playground;
- command-line runner;
- automated tests on Windows, macOS, and Linux through CI.

## Try it

### Browser playground

```bash
npm run serve
```

Then open `http://localhost:4173`.

The `web/` directory is also static-hosting friendly and intended for GitHub Pages.

### Command line

Node.js 20+ is currently the only requirement for the beta runtime.

```bash
node src/cli.js examples/score.patch
```

or after `npm link`:

```bash
patch examples/score.patch
```

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

The preview reports the proposed state transition and leaves the real state untouched.

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

## What makes Patch a research language?

Patch does **not** claim that patches, undo, change propagation, lenses, or event logs are new. They are not.

The research hypothesis is narrower:

> **What happens if explicit semantic change is the exclusive primitive for ordinary mutable state in a deliberately low-complexity general-purpose language?**

Patch explores whether one simple mutation model can simultaneously provide:

1. **Mutation transparency**: every post-creation state mutation corresponds to an inspectable change record.
2. **Uniform reversibility**: invertible primitive changes generate inverse changes automatically.
3. **Replayability**: state evolution is represented as an ordered semantic history.
4. **Conflict reasoning**: concurrent changes can be compared at the semantic operation/path level instead of only as snapshots.
5. **Low conceptual distance**: the source says `create`, `change`, `add`, and `remove` rather than exposing logs, commands, inverse functions, or synchronization machinery.

See `docs/NOVELTY.md` and `paper/main.tex`.

## Current semantic model

Each committed change contains at least:

```text
id
name (optional)
target
base version
new version
semantic operations
inverse operations
before state
after state
```

For example:

```patch
change score:
  add 5
```

is represented internally as an operation equivalent to:

```text
AddNumber(target=score, value=5)
```

with an automatically derived inverse:

```text
AddNumber(target=score, value=-5)
```

The beginner never has to manipulate those structures directly.

## Repository map

```text
src/                    parser, expression evaluator, interpreter, change algebra
web/                    Patch Play browser playground
examples/               runnable .patch programs
tests/                  beta conformance and semantic-change tests
docs/SPEC.md             beta language specification
docs/SEMANTICS.md        formal core and research properties
docs/NOVELTY.md          prior-art boundary and novelty claim
docs/RESEARCH_PLAN.md    evaluation and publication plan
docs/ROADMAP.md          beta -> compiler/Wasm roadmap
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI and Pages workflow
```

## Tests

```bash
npm test
npm run check
```

The beta test suite covers language execution plus change composition, inversion, mutation transparency, and conflict detection.

## Portability

The beta uses standards-based JavaScript so that the same interpreter runs in browsers and Node.js on Windows, macOS, and Linux. CI tests all three desktop OS families.

The planned compiler path is:

```text
Patch source
   -> parser / typed AST
   -> Change IR
   -> WebAssembly Component / WASI
```

The interpreter is intentional for beta: it lets the language semantics stabilize before compiler infrastructure hardens the wrong design.

## Research paper

The repository includes a substantial draft:

**Patch: Change-Oriented Programming with Transparent State Evolution**

The current paper is a design/artifact manuscript. It deliberately does **not** fabricate user-study results. The next publication milestone is to add a controlled novice study and benchmark evaluation described in `docs/RESEARCH_PLAN.md`.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

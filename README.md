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

The beginner-facing language stays deliberately small while the compiler/runtime derives history, undo/redo, preview, replay foundations, conflict analysis, semantic Change Signatures, optional Change Capabilities, bounded range proofs, and causal provenance from the same structured change model.

## Patch Studio

Public Patch Studio / project site:

**https://pinkysworld.github.io/Patch/**

GitHub Pages is configured to deploy this site through the repository's GitHub Actions workflow.

Patch Studio is browser-first and installable as a PWA. It is designed for Windows, macOS, Linux, iPhone/iPad, Android, ChromeOS and browser-capable BSD/Unix systems.

## Current status

Current development beta: **0.2.0-beta.5**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR that keeps `change` explicit;
- automatically inferred semantic **Change Signatures**;
- compile-time **Change Capabilities**;
- numeric parameter ranges and interval analysis for bounded change proofs;
- conservative transitive analysis through simple recipe calls;
- runtime guards for declared numeric parameter ranges;
- causal provenance on committed changes;
- `why value` and `why condition` explanations;
- a **Lean 4 formalization** of State-Change Factorization, Mutation Transparency, Change Signature Soundness for a structured control-flow core, and end-to-end Semantic Change Contract soundness for that core;
- a conservative **production-to-formal validation bridge** for the currently supported correspondence subset;
- `patch formal` CLI coverage reporting;
- dedicated Lean CI with no `sorry`/`admit` placeholders allowed;
- `patch changes` CLI inspection;
- Patch Studio Change Contract view;
- portable `.patchapp` bundles;
- bootstrap WebAssembly `.wasm` output;
- console and first GUI programs;
- browser/PWA Studio with visual Designer, local autosave and offline core assets;
- Windows/macOS/Linux JavaScript CI plus formal verification CI.

## State-Change Factorization

Patch does not perform an ordinary write and then log what happened. The semantic change is the route through which persistent state changes:

```text
construct delta
      ↓
apply delta
      ↓
new persistent state
```

There is no ordinary persistent reassignment escape hatch.

## Semantic Change Signatures and Capabilities

Patch can infer what a recipe may change:

```patch
make reward(player):
  change player:
    add 5 to score
```

Conceptually:

```text
reward(player)
  player.score -> increase by 5
```

A policy can restrict this:

```patch
allow reward:
  player.score may increase up to 10
```

A `set score = 999` is not accepted as an `increase`, even though both technically write the same location.

## Bounded range proofs

Patch supports simple numeric range declarations on recipe parameters:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

The compiler can reason that `bonus` lies in `[0,10]` and prove that the resulting increase stays inside the declared Change Capability.

Simple arithmetic is propagated too:

```patch
make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The inferred amount is `0..10`. If the possible result exceeds the capability bound, compilation fails conservatively. Declared ranges are also checked at runtime.

## Causal `why`

Committed Patch changes retain source and causal context such as recipe calls and GUI events.

```patch
create number score = 0

make reward():
  change score:
    add 5

do reward()
why score
```

Patch can explain that the current value came from a change inside `reward`.

Conditions can also be queried:

```patch
why score > 100
```

Patch replays semantic history and reports the first recorded change that made the condition true when it can isolate one. This is historical provenance, not a claim of general causal inference.

## Lean 4 formalization

The `formal/` directory is a real Lean 4 project pinned to Lean 4.30.0 with no unfinished proof placeholders.

Current machine-checked results include:

- **State-Change Factorization** for the formal machine step;
- **Mutation Transparency** as a corollary;
- interval-containment transitivity used by bounded change reasoning;
- Semantic Change Contract composition;
- **Change Signature Soundness** for a formal structured core containing sequencing, branching and bounded repetition;
- **end-to-end Capability Soundness** for that core.

For the formal core, Lean proves:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and consequently:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

## Production-to-formal bridge

Beta 5 begins the next important step: connecting the real JavaScript compiler to the mechanized model.

`src/formal-bridge.js` independently reconstructs a Lean-like structured control-flow representation from the production Patch AST for the currently supported subset. It then derives that representation's static signature and compares it with the normal production Change Signature.

For a supported entry:

```text
production AST
     |                         production analyzer
     |                                |
     v                                v
formal-bridge core              Change Signature
     |
     v
independent formal-style signature
     |_______________________________|
                     |
                  compare
                     |
            mismatch -> compiler error
```

The current bridge covers direct supported semantic changes, sequencing, branch alternatives, literal bounded repetition and ranged numeric amounts that fall inside the formal effect vocabulary. Unsupported constructs such as recipe calls, dynamic repeat counts, undo/redo and GUI/event execution are **reported explicitly** instead of silently receiving a verification claim.

Use:

```bash
patch formal examples/score.patch
```

A typical report tells you which program/recipe entries match the current formal subset and why other entries are not yet covered.

This is **translation-validation/conformance evidence**, not yet a machine-checked proof that the JavaScript compiler implements the Lean semantics. A verified checker or stronger compiler-correspondence theorem remains a research goal.

## Compiler path

```text
Patch source
   -> AST + numeric range annotations
   -> semantic Change Signature analysis
   -> Change Capability validation
   -> production/formal bridge evidence
   -> Change IR
   -> portable .patchapp            [implemented]
   -> bootstrap WebAssembly .wasm   [implemented]
   -> direct Change IR -> Wasm      [next]
   -> native host packaging         [roadmap]
```

The bootstrap `.wasm` is a genuine instantiable WebAssembly module containing the compiled Patch payload for a Patch host. Direct Change IR-to-Wasm execution and native `.exe`, `.app`, ELF and BSD packages are not yet claimed as finished.

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

## CLI

The JavaScript beta toolchain requires Node.js 22+.

```bash
patch run examples/score.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/score.patch
patch build examples/score.patch --kind console --target portable
patch build examples/score.patch --kind console --target wasm
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, ranges, provenance, undo, event logs, lenses, CRDTs or reversible computation are individually new.

The research program has three connected layers:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: Patch infers semantic Change Signatures and checks them against optional semantic Change Capabilities.
3. **Change-native analysis**: the same mandatory representation supports bounded amount reasoning, provenance and runtime/tooling services.

Beta 5 adds a fourth engineering/formal layer: a visible correspondence boundary between production compiler output and the mechanized signature model. That makes the remaining proof gap measurable rather than vague.

A high-venue submission still requires broader production-to-formal correspondence or a verified checker, systematic prior-art review, direct compiled execution, convincing security/engineering case studies and benchmarks. Controlled novice evidence is needed only if beginner simplicity remains a headline empirical claim.

## Repository map

```text
src/                    parser, interpreter, analyses, formal bridge, compiler, Wasm bootstrap, Designer, bundler
formal/                 Lean 4 formal model, signature semantics and machine-checked theorems
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, formal bridge, range/provenance, compiler, capability, UI, Designer and Wasm tests
examples/               runnable .patch programs
docs/                   specification, semantics, formal model, novelty, research, compiler, Studio and targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal verification and Pages deployment
```

## CI quality gate

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, tests, examples, the `patch formal` bridge report, `.patchapp`, Wasm and the public site. A separate Ubuntu job installs the pinned Lean toolchain, runs `lake build`, and rejects `sorry` or `admit` in the formal proof source.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

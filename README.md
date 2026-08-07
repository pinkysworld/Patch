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

Patch Studio is browser-first and installable as a PWA. It is designed for Windows, macOS, Linux, iPhone/iPad, Android, ChromeOS and browser-capable BSD/Unix systems.

## Current status

Current development beta: **0.2.0-beta.3**

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
- an initial **Lean 4 formalization** of State-Change Factorization and Semantic Change Contract composition;
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

Beta 3 adds simple numeric range declarations to recipe parameters:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

Patch no longer has to reject `bonus` merely because it is dynamic. The compiler knows:

```text
bonus ∈ [0, 10]
```

and can prove that the resulting increase stays inside the declared Change Capability.

The interval analyzer also handles simple arithmetic:

```patch
make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The inferred amount is `0..10`. If the possible result exceeds the capability bound, compilation fails conservatively.

Declared ranges are also checked at runtime so a recipe cannot be called with an out-of-range value and invalidate its inferred Change Signature.

## Causal `why`

Committed Patch changes now retain source and causal context such as recipe calls and GUI events.

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

Patch replays the semantic history and reports the first recorded change that made the condition true, when it can isolate one.

For GUI programs, provenance can include a chain such as:

```text
event bonus_button clicked -> recipe reward -> change score
```

This is a first causal-provenance prototype, not yet a full causal-inference system.

## Lean 4 formalization

The `formal/` directory is now a real Lean 4 project pinned to Lean 4.30.0. It mechanizes an initial core model with no unfinished proof placeholders.

Current proved results include:

- a **State-Change Factorization** theorem for the formal machine step;
- Mutation Transparency as a corollary;
- interval-containment transitivity used by bounded change reasoning;
- Semantic Change Contract composition: if runtime effects are covered by an inferred signature, and the signature is admitted by a capability policy, then runtime effects are admitted by the policy.

The formal model is intentionally smaller than the full implementation. The next proof work is to connect the executable analyzer more directly to the Lean definitions and extend the model to richer values, calls and GUI events.

## Compiler path

```text
Patch source
   -> AST + numeric range annotations
   -> semantic Change Signature analysis
   -> Change Capability validation
   -> Change IR
   -> portable .patchapp            [implemented]
   -> bootstrap WebAssembly .wasm   [implemented]
   -> direct Change IR -> Wasm      [next]
   -> native host packaging         [roadmap]
```

The bootstrap `.wasm` is a genuine instantiable WebAssembly module containing the compiled Patch payload for a Patch host. Direct Change IR-to-Wasm execution and native `.exe`/`.app`/ELF/BSD packages are not yet claimed as finished.

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
patch build examples/score.patch --kind console --target portable
patch build examples/score.patch --kind console --target wasm
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, ranges, provenance, undo, event logs, lenses, CRDTs or reversible computation are individually new.

The research program now has three connected layers:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: Patch infers semantic Change Signatures and checks them against optional semantic Change Capabilities.
3. **Change-native analysis**: because the same representation is mandatory, Patch can derive bounded amount proofs and causal explanations without a second application-specific mutation model.

The central prospective soundness chain is:

```text
RuntimeChanges(f) ⊆ Signature(f) ⊆ Capability(f)
```

and therefore:

```text
RuntimeChanges(f) ⊆ Capability(f)
```

The repository now contains an initial machine-checked proof of the composition step in Lean 4. A high-venue submission still requires a stronger correspondence proof between the executable compiler and the formal model, systematic prior-art review, direct compiled execution, benchmarks/security evaluation and controlled user evidence if the novice-comprehension claim is retained.

## Repository map

```text
src/                    parser, interpreter, change/range analysis, compiler, Wasm bootstrap, Designer, bundler
formal/                 Lean 4 formal model and machine-checked theorems
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, range/provenance, compiler, capability, UI, Designer and Wasm tests
examples/               runnable .patch programs
docs/                   specification, semantics, formal model, novelty, research, compiler, Studio and targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal verification and Pages deployment
```

## CI quality gate

JavaScript CI runs on Windows, macOS and Linux with Node 22/24 and checks syntax, tests, examples, `.patchapp`, Wasm and the public site. A separate Ubuntu job installs the pinned Lean toolchain, runs `lake build`, and rejects `sorry` or `admit` in the formal proof source.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

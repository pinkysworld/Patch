# Patch

> **A tiny change-oriented programming language with one IDE for everywhere.**

Patch is an experimental general-purpose language built around one deliberately simple idea:

**persistent state does not mutate invisibly. Every ordinary post-creation mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The beginner-facing language stays small while the compiler/runtime derives history, undo/redo, preview, semantic Change Signatures, optional Change Capabilities, range evidence, provenance and formal evidence from the same structured change model.

## Patch Studio

Public Patch Studio / project website:

**https://pinkysworld.github.io/Patch/**

The site is deployed through GitHub Actions. Patch Studio is browser-first and installable as a PWA, with desktop and iPhone/iPad layouts.

## Current status

Current development beta: **0.2.0-beta.6**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR preserving semantic `change` operations;
- automatically inferred semantic **Change Signatures**;
- compile-time operation- and magnitude-aware **Change Capabilities**;
- ranged numeric parameters, interval analysis and runtime range guards;
- causal source/recipe/event provenance and `why` queries;
- Lean 4 formal core with State-Change Factorization, Mutation Transparency, Change Signature Soundness and end-to-end capability containment;
- conservative production-to-formal translation-validation bridge;
- **Lean-verified executable semantic policy checker**;
- **`patch certify` production-generated Lean certificates** for protected bridge-supported recipes;
- portable `.patchapp` bundles and bootstrap WebAssembly;
- console programs and first GUI/Designer slice;
- browser/PWA Patch Studio with local autosave and offline core assets;
- Windows/macOS/Linux JavaScript CI plus explicit Lean proof/certificate CI.

## The core research idea

Patch does not perform an ordinary write and then record what happened. The semantic change is the route through which persistent state changes:

```text
construct delta
      ↓
apply delta
      ↓
new persistent state
```

There is no ordinary persistent reassignment escape hatch for an existing Patch binding.

This is the basis of **State-Change Factorization**.

## Semantic Change Contracts

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

A policy can restrict that semantic authority:

```patch
allow reward:
  player.score may increase up to 10
```

A `set score = 999` is not accepted as an `increase`, even though both technically write the same location.

Dynamic bounded changes can also be proven:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production analyzer infers `bonus * 2` as `0..10`. If the possible amount exceeds the capability bound, compilation fails conservatively.

## Causal `why`

Committed Patch changes retain source and causal context such as recipe calls and GUI events.

```patch
why score
why score > 100
```

Patch can explain recorded transitions behind a value and identify the first recorded false-to-true transition for a predicate when possible. This is historical provenance, not a claim of general causal inference.

## Lean 4 formalization

The `formal/` directory is pinned to Lean 4.30.0.

The current formal core machine-checks:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and therefore:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

The key modules are:

```text
PatchFormal.lean      factorization, intervals, effects, policies
PatchSignature.lean   structured execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
```

Formal CI explicitly builds all three modules and compiles a certificate generated from real Patch source.

## Production-to-formal bridge

`src/formal-bridge.js` independently reconstructs a Lean-like structured core from the production AST for a conservative subset and compares its signature with the normal production analyzer.

```text
production AST ----------------------> production signature
      |
      v
formal bridge CoreStmt
      |
      v
formal-style signature
      |
      +------------------------------> compare
                                      |
                               mismatch = error
```

Use:

```bash
patch formal examples/score.patch
```

Unsupported constructs are reported explicitly instead of silently receiving a verification claim. Recipe calls, dynamic repeat counts, undo/redo and GUI/event execution are among the constructs still outside the current formal correspondence subset.

## Beta 6 verified checker and certificates

The production compiler is no longer the final authority for semantic policy safety inside the certifiable subset.

Use:

```bash
patch certify examples/change-capabilities.patch \
  --out Reward.patchcert.lean
```

The generated certificate contains the bridge-produced formal statement, policy rules, Patch IR version and a SHA-256 hash of the exact source bytes. It asks Lean to establish:

```text
checkProtected(stmt, policy) = true
```

`PatchChecker.lean` proves that a successful executable checker result implies the relational policy judgment. Combined with Change Signature Soundness:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

The certificate generator refuses protected recipes outside the formal bridge subset.

### Important boundary

This is a real verified checker boundary, **not full compiler verification**.

Still trusted/unproved:

```text
Patch source -> JavaScript parser -> formal bridge CoreStmt
```

Lean-checked after that boundary:

```text
CoreStmt + policy
   -> inferSignature
   -> verified checker
   -> policy judgment
   -> runtime containment for formal executions
```

The next major research obligation is proving the source/Change-IR-to-formal correspondence for a useful subset.

## Compiler path

```text
Patch source
   -> AST + range annotations
   -> semantic Change Signature analysis
   -> production capability validation
   -> production/formal bridge evidence
   -> Change IR 0.5
   -> Lean certificate / verified checker    [implemented]
   -> portable .patchapp                     [implemented]
   -> bootstrap WebAssembly .wasm            [implemented]
   -> direct Change IR -> Wasm               [next]
   -> native host packaging                  [roadmap]
```

Bootstrap Wasm is a genuine instantiable WebAssembly module containing the compiled Patch payload for a Patch host. It is **not yet direct Change IR-to-Wasm execution**.

## Console and GUI use the same language

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

## CLI

Node.js 22+ for the current JavaScript beta toolchain:

```bash
patch run examples/score.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/score.patch
patch certify examples/change-capabilities.patch --out Reward.patchcert.lean
patch build examples/score.patch --kind console --target portable
patch build examples/score.patch --kind console --target wasm
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, range analysis, provenance, translation validation, verified checkers, Proof-Carrying Code, undo, event logs, lenses, CRDTs or reversible computation are individually new.

The candidate contribution is the combination:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: operation- and magnitude-aware signatures/policies are derived from that mandatory mutation representation.
3. **Formal runtime containment**: Lean proves the runtime-signature-policy chain for a structured core.
4. **Production assurance boundary**: translation validation plus a small verified checker connects real compiler artifacts to the formal model without pretending the remaining translation gap is solved.

A high-venue submission still needs stronger source/formal correspondence, systematic related work, production interval-analysis soundness, direct compiled execution, compelling security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, formal bridge, certificate generator, compiler, Wasm, Designer
formal/                 Lean formal model, signature semantics, verified checker
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, formal bridge, certificate, range, compiler, capability, UI, Designer, Wasm
examples/               runnable .patch programs
docs/                   specification, semantics, formal model, novelty, research, compiler, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal certificate verification, Pages deployment
```

## CI quality gate

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, tests, examples, formal bridge output, certificate generation, `.patchapp`, Wasm and the public site.

Formal CI generates a certificate from production Patch source, explicitly compiles `PatchFormal`, `PatchSignature`, and `PatchChecker`, compiles the generated certificate, and rejects actual unfinished proof placeholders. Beta 6 strengthened this gate after discovering that the previous bare Lake invocation could report success without compiling the proof libraries.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

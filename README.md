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

Current development beta: **0.2.0-beta.8**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR 0.6 preserving semantic `change` operations;
- automatically inferred semantic **Change Signatures**;
- compile-time operation- and magnitude-aware **Change Capabilities**;
- ranged numeric parameters, interval analysis and runtime range guards;
- causal source/recipe/event provenance and `why` queries;
- Lean 4 formal core with State-Change Factorization, Mutation Transparency, Change Signature Soundness and end-to-end capability containment;
- conservative production semantic bridge;
- Lean-verified executable semantic policy checker;
- proof-free semantic evidence validated and decoded by Lean;
- **formal Source core preserving source-level `add` / `remove` / `set` / `clear` before semantic normalization**;
- **machine-checked SourceStmt → EvidenceStmt → CoreStmt → Change Signature correspondence for generated certificates**;
- `patch certify` Lean certificates for protected source/bridge-supported recipes;
- portable `.patchapp` bundles and bootstrap WebAssembly;
- console programs and first GUI/Designer slice;
- browser/PWA Patch Studio with local autosave and offline core assets;
- Windows/macOS/Linux JavaScript CI plus explicit Lean source/evidence/certificate CI.

## The core research idea

Patch does not perform an ordinary write and then record what happened. The semantic change is the route through which persistent state changes:

```text
construct delta
      ↓
apply delta
      ↓
new persistent state
```

There is no ordinary persistent reassignment escape hatch for an existing Patch binding. This is the basis of **State-Change Factorization**.

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

Dynamic bounded changes can also be proven by the production analyzer:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The analyzer infers `bonus * 2` as `0..10`. If the possible amount exceeds the capability bound, compilation fails conservatively.

## Causal `why`

Committed Patch changes retain source and causal context such as recipe calls and GUI events.

```patch
why score
why score > 100
```

Patch can explain recorded transitions behind a value and identify the first recorded false-to-true transition for a predicate when possible. This is historical provenance, not a claim of general causal inference.

## Lean 4 formalization

The `formal/` directory is pinned to Lean 4.30.0. For the structured formal core, Lean machine-checks:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and consequently:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

The key modules are:

```text
PatchFormal.lean      factorization, intervals, effects, policies
PatchSignature.lean   structured execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free evidence decoder + correspondence theorems
PatchSource.lean      source verbs, Lean normalization + source-level containment
```

Formal CI explicitly builds all five modules and compiles a certificate generated from real Patch source.

## Beta 8 formal Source core

Beta 7 already stopped trusting a JavaScript-generated `CoreStmt`: the producer emitted proof-free `EvidenceStmt`, and Lean decoded it and independently reconstructed the semantic signature.

Beta 8 moves the boundary one step closer to the language surface. Generated certificates now also carry a proof-free `SourceStmt` whose mutation nodes still preserve the source vocabulary:

```text
add
remove
set
clear
```

The producer separately emits semantic `EvidenceStmt`. Lean then performs the semantic normalization itself:

```text
formal SourceStmt
      ↓
validate raw amount bounds
      ↓
normalize source verb
      ↓
EvidenceStmt
      ↓
decode to CoreStmt
      ↓
infer formal Change Signature
      ↓
compare with separate production signature claim
      ↓
check semantic policy
```

For example, a source-level operation such as:

```patch
change player:
  add -5 to score
```

is preserved in `SourceStmt` as an `add` with range `[-5,-5]`. Lean's source normalizer converts that to a semantic `decrease` with magnitude `[5,5]`. The separately produced semantic evidence must match that Lean-computed result.

The relevant executable checks and theorems are in `PatchSource.lean`:

```text
checkSourceEvidence
checkSourceSignature
checkSourceProtected
checkSourceEvidence_sound
checkSourceSignature_sound
checkedSourceExecutionCannotEscape
checkedSourceSignatureAndPolicy
```

The resulting formal guarantee is now phrased over the formal source core:

```text
SourceExecutes(source, runtime)
checkSourceProtected(source, policy) = true
------------------------------------------------
every runtime semantic effect is allowed by policy
```

## Production correspondence boundary

The production compiler now emits two distinct formal views:

```text
src/formal-source.js
  AST -> SourceStmt preserving add/remove/set/clear

src/formal-bridge.js
  AST -> semantic Evidence/Core-style representation
```

and the production Change Signature analyzer remains a third claim path.

`patch formal` reports both source-core and semantic-bridge coverage:

```bash
patch formal examples/score.patch
```

`patch certify` generates a Lean artifact containing:

```text
1. formal SourceStmt
2. separate semantic EvidenceStmt
3. separate production Change Signature claim
4. declared semantic policy
5. exact source SHA-256 + schema/IR versions
```

Lean checks SourceStmt → EvidenceStmt equality, evidence decoding, formal signature reconstruction and policy containment.

### Remaining trust boundary

Beta 8 still does **not** prove the complete production compiler.

Still trusted/unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> extraction of SourceStmt

production range analyzer
   -> amount intervals attached to SourceStmt
```

Lean-checked after that boundary:

```text
SourceStmt
   -> source-operation semantic normalization
   -> EvidenceStmt correspondence
   -> CoreStmt decoding
   -> formal Change Signature reconstruction
   -> production-signature correspondence
   -> semantic policy check
   -> runtime containment for formal SourceExecutes executions
```

The two highest-value next proof obligations are therefore:

1. production AST → formal `SourceStmt` extraction correspondence for a useful fragment;
2. production numeric interval-analysis soundness for the expression fragment used by magnitude-aware contracts.

## Compiler path

```text
Patch source
   -> AST + range annotations
   -> semantic Change Signature analysis
   -> production capability validation
   -> formal SourceStmt extraction             [implemented]
   -> conservative semantic bridge             [implemented]
   -> Change IR 0.6
   -> Lean SourceStmt/evidence/signature checks [implemented]
   -> portable .patchapp                       [implemented]
   -> bootstrap WebAssembly .wasm              [implemented]
   -> direct Change IR -> Wasm                 [next backend stage]
   -> native host packaging                    [roadmap]
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

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, range analysis, provenance, translation validation, verified checkers, Proof-Carrying Code, source calculi, undo, event logs, lenses, CRDTs or reversible computation are individually new.

The candidate contribution is the combination:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: operation- and magnitude-aware signatures/policies are derived from that mandatory mutation representation.
3. **Formal runtime containment**: Lean proves the runtime-signature-policy chain for a structured core.
4. **Source-to-semantic assurance boundary**: a formal source mutation vocabulary is normalized by Lean into semantic evidence before signature and policy checking, reducing trust in producer-side semantic classification.

A high-venue submission still needs stronger production AST/source correspondence, systematic related work, production interval-analysis soundness, direct compiled execution, compelling security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, source/semantic formal extractors, certificate generator, compiler, Wasm, Designer
formal/                 Lean state semantics, signature semantics, checker, evidence decoder, formal source core
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, formal source/bridge, certificate, range, compiler, capability, UI, Designer, Wasm
examples/               runnable .patch programs
docs/                   specification, semantics, formal model, novelty, research, compiler, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal source/evidence/certificate verification, Pages deployment
```

## CI quality gate

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, tests, examples, formal source/bridge output, source/evidence certificate generation, `.patchapp`, Wasm and the public site.

Formal CI generates a certificate from production Patch source, explicitly compiles `PatchFormal`, `PatchSignature`, `PatchChecker`, `PatchEvidence` and `PatchSource`, compiles the generated certificate, and rejects actual unfinished proof placeholders.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

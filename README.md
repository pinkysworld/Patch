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

Current development beta: **0.2.0-beta.7**

Implemented now:

- interpreter and compiler front end;
- normalized Change IR preserving semantic `change` operations;
- automatically inferred semantic **Change Signatures**;
- compile-time operation- and magnitude-aware **Change Capabilities**;
- ranged numeric parameters, interval analysis and runtime range guards;
- causal source/recipe/event provenance and `why` queries;
- Lean 4 formal core with State-Change Factorization, Mutation Transparency, Change Signature Soundness and end-to-end capability containment;
- conservative production-to-formal translation-validation bridge;
- Lean-verified executable semantic policy checker;
- **proof-free production evidence schema validated and decoded by Lean**;
- **machine-checked evidence → `CoreStmt` → Change Signature correspondence** for generated certificates;
- `patch certify` Lean certificates for protected bridge-supported recipes;
- portable `.patchapp` bundles and bootstrap WebAssembly;
- console programs and first GUI/Designer slice;
- browser/PWA Patch Studio with local autosave and offline core assets;
- Windows/macOS/Linux JavaScript CI plus explicit Lean proof/evidence/certificate CI.

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
```

Formal CI explicitly builds all four modules and compiles a certificate generated from real Patch source.

## Production-to-formal bridge

`src/formal-bridge.js` independently reconstructs a Lean-like structured core from the production AST for a conservative subset and compares its signature with the normal production analyzer.

Use:

```bash
patch formal examples/score.patch
```

Unsupported constructs are reported explicitly instead of silently receiving a verification claim. Recipe calls, dynamic repeat counts, undo/redo and GUI/event execution remain outside the current formal correspondence subset.

The JavaScript comparison remains useful translation-validation evidence, but Beta 7 no longer makes it the final authority for generated semantic certificates.

## Beta 7 verified evidence correspondence

Use:

```bash
patch certify examples/change-capabilities.patch \
  --out Reward.patchcert.lean
```

A generated certificate now contains three deliberately separate things:

```text
1. proof-free EvidenceStmt produced from the supported production bridge
2. a production Change Signature claim
3. the declared semantic Change Capability policy
```

The certificate does **not** directly inject a trusted generated `CoreStmt`. Instead `PatchEvidence.lean`:

```text
untrusted evidence
      ↓
validate raw interval bounds
      ↓
decodeEvidenceStmt
      ↓
formal CoreStmt
      ↓
inferSignature
      ↓
compare with separate production-signature claim
      ↓
check semantic policy
```

Lean proves that a successful evidence/signature check gives exact correspondence between the decoded formal core's canonical semantic signature and the separately emitted production claim:

```text
checkEvidenceSignature(evidence, claim) = true

decodeEvidenceStmt(evidence) = some stmt
------------------------------------------------
encodeSignature(inferSignature(stmt)) = claim
```

Lean also proves that accepted evidence-level policy checking composes with formal execution soundness:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceProtected(evidence, policy) = true
Executes(stmt, runtime)
------------------------------------------------
every runtime semantic effect is allowed by policy
```

Invalid raw evidence intervals fail decoding rather than being trusted. Duplicate semantic effects are canonicalized before the formal signature comparison.

### Remaining trust boundary

Beta 7 narrows the implementation-to-proof gap, but it does **not** prove the whole compiler.

Still trusted/unproved:

```text
Patch source
   -> JavaScript parser / analysis
   -> extraction of proof-free EvidenceStmt + production signature claim + policy
```

Lean-checked after that boundary:

```text
proof-free evidence
   -> evidence validation
   -> CoreStmt decoding
   -> formal Change Signature reconstruction
   -> production-signature correspondence check
   -> semantic policy check
   -> runtime containment for formal executions
```

The next major proof obligation is therefore no longer "does generated CoreStmt mean what we say?". It is the narrower frontend question: **does the JavaScript source/AST-to-evidence extraction faithfully represent the supported Patch program?**

## Compiler path

```text
Patch source
   -> AST + range annotations
   -> semantic Change Signature analysis
   -> production capability validation
   -> conservative formal bridge
   -> proof-free semantic evidence
   -> Lean evidence decoder + correspondence checker    [implemented]
   -> Change IR 0.5
   -> portable .patchapp                                [implemented]
   -> bootstrap WebAssembly .wasm                       [implemented]
   -> direct Change IR -> Wasm                          [next backend stage]
   -> native host packaging                             [roadmap]
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
4. **Verified production evidence boundary**: proof-free production evidence is validated, decoded and compared against a separately emitted production signature by a small machine-checked Lean component.

A high-venue submission still needs a stronger source/AST-to-evidence correspondence result, systematic related work, production interval-analysis soundness, direct compiled execution, compelling security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, formal bridge, certificate generator, compiler, Wasm, Designer
formal/                 Lean formal model, signature semantics, checker, proof-free evidence boundary
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, formal bridge, certificate, range, compiler, capability, UI, Designer, Wasm
examples/               runnable .patch programs
docs/                   specification, semantics, formal model, novelty, research, compiler, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal evidence/certificate verification, Pages deployment
```

## CI quality gate

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, tests, examples, formal bridge output, evidence certificate generation, `.patchapp`, Wasm and the public site.

Formal CI generates a certificate from production Patch source, explicitly compiles `PatchFormal`, `PatchSignature`, `PatchChecker` and `PatchEvidence`, compiles the generated evidence certificate, and rejects actual unfinished proof placeholders.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

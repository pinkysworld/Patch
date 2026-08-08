# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.22 / Change IR 0.8**. The manuscript is still working research text, not yet a submission-ready top-venue paper.

The paper story has four assurance layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean formal core** — factorization, Mutation Transparency, Change Signature Soundness, formal policy containment and integer range-analysis soundness for explicit fragments.
2. **Source translation validation** — an independent raw-source path reconstructs supported SourceStmt/range claims and compares them with the production formal-source artifact.
3. **Direct-runtime validation** — an independent Change-IR execution model reconstructs concrete semantic effects from observed direct-Wasm transitions and checks them against production contracts.
4. **Runtime → Lean composition** — proof-free concrete effects plus an untrusted `RuntimePath` are checked against `SourceExecutes`; beta.22 then composes `EffectRefines` with the verified semantic policy checker to establish concrete runtime capability containment.

None of these is described as complete compiler verification.

## Beta.22 runtime-capability milestone

For a protected recipe:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

the formal source permits an abstract effect such as:

```text
score increase [0,10]
```

while the concrete direct execution reconstructs:

```text
score increase [8,8]
```

`PatchRuntime.lean` checks that the concrete occurrence refines a real formal `SourceExecutes` trace. New `PatchRuntimeCapability.lean` then proves semantic authority is downward closed under refinement:

```text
EffectRefines actual expected
Allows rule expected
=> Allows rule actual
```

and lifts that property to traces. The main new composition theorem is:

```text
checkedConcreteRuntimeCannotEscape
```

Given successful runtime correspondence and successful `checkSourceProtected`, every decoded concrete runtime effect is admitted by a declared policy rule.

Generated runtime certificates therefore contain both the proof-free runtime occurrence/path evidence and the declared policy, with per-invocation theorems such as `runtime_reward_1_concrete_policy_safe` checked by Lean.

## RuntimePath remains proof-free evidence

The current path vocabulary is:

```text
leaf
seq
branchThen
branchElse
repeatZero
repeatSucc
```

`decodeCorePath_sound` proves an accepted path corresponds to an `Executes` trace. Multiple protected invocations can be checked separately, including branch/repeat paths.

An important limitation is now made explicit in the manuscript: `CoreStmt.branch` currently erases the original Boolean guard. Thus `branchThen` / `branchElse` validate structural branch execution but do not yet prove that the source guard evaluated to that Boolean. The next formal/compiler milestone is a typed, guard-aware execution core.

## Window artifact hardening

The product artifact is also stronger after code review. The Standalone Window Web runtime is now executed in differential regression tests against `PatchInterpreter`. Tests cover sequential operations within one semantic `change`, declared create types, Thing-field validity and real Counter button rerendering.

A shared Window runtime-support preflight rejects duplicate control ids, handlers for nonexistent controls and event forms not consistently wired across Web/Desktop targets. The current portable event subset is button `clicked`.

These changes improve artifact correctness but are not novelty claims.

## Current formal modules

```text
PatchFormal.lean             factorization, state, intervals, effects, policies
PatchSignature.lean          effect-only CoreStmt execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer evaluator/range soundness
PatchRuntime.lean            EffectRefines + RuntimePath correspondence
PatchRuntimeCapability.lean  concrete runtime capability containment
```

Formal CI generates and compiles `GeneratedCertificate.lean` and `GeneratedRuntimeCertificate.lean` under pinned Lean and rejects `sorry`/`admit`.

## Current claim boundary

A defensible beta.22 implementation/formal statement is:

> For supported protected direct-WebAssembly invocations, Patch emits proof-free concrete semantic occurrences and a control-flow witness. Lean checks these against an actual formal `SourceExecutes` trace. If the same formal source passes the verified semantic Change Capability checker, Lean proves every decoded concrete occurrence is admitted by that policy. This is restricted runtime correspondence and capability containment, not full compiler verification; frontend correctness, Wasm lowering, runtime semantic reconstruction and source-guard truth correspondence remain explicit boundaries.

## Remaining high-value gaps

- typed, guard-aware integer/Boolean execution core;
- formal recipe-call/substitution semantics;
- semantic-security/engineering case studies;
- measured analysis/source-validation/certificate/checker/backend overhead;
- systematic related-work review;
- reproducibility bundle;
- empirical usability work only with an appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for interval analysis, abstract interpretation, refinement relations, path witnesses, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C generation, provenance, undo or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**.

## Manuscript source

`main.tex` is the working article source. No empirical performance or user-study results should be stated until actually collected.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

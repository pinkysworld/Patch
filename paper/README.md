# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.24 / Change IR 0.9**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The latest formal research milestone remains beta.23; beta.24 is a product/semantic-consistency release showing that editable GUI input can be added without introducing a second hidden persistent-write mechanism.

The assurance story has five distinct layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean semantic core** — factorization, Mutation Transparency, Change Signature Soundness, verified semantic policy containment and integer range-analysis soundness for explicit fragments.
2. **Source translation validation** — an independent raw-source path reconstructs SourceStmt/range claims and compares them with production extraction.
3. **Guard translation validation** — an independent raw-source control-flow parser reconstructs GuardTree/guard claims/parameter vocabulary and compares them with production extraction.
4. **Direct-runtime validation** — an independent Change-IR execution model reconstructs concrete semantic effects from observed direct-Wasm transitions.
5. **Guard-aware runtime → Lean composition** — proof-free concrete effects, RuntimePath and invocation parameter environments are checked against `SourceExecutes`, source-guard truth and Change Capability containment.

None of these is described as complete compiler verification.

## Beta.23 guard-aware milestone

Consider:

```patch
create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus

do reward(4)
do reward(0)
```

The implementation produces separate proof-free invocation evidence such as:

```text
reward#1: bonus = 4, branchThen
reward#2: bonus = 0, branchElse
```

`PatchGuarded.lean` introduces a small integer/Boolean `GuardExpr`, a parallel `GuardTree`, and executable/verified checks for SourceStmt/GuardTree shape and guard/path validity. For the first invocation, Lean must evaluate the normalized guard `0 < bonus` under `bonus ↦ 4` to true before accepting `branchThen`; the second invocation requires false before accepting `branchElse`.

The main beta.23 checker is:

```text
checkGuardedSourceRuntimeEvidence
```

with soundness theorem:

```text
checkGuardedSourceRuntimeEvidence source tree env observed path = true
--------------------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
  and GuardShape source tree
  and GuardPathValid env tree path
```

`checkedGuardedConcreteRuntimeCannotEscape` additionally composes this guarded correspondence with the verified semantic policy checker, proving every decoded concrete occurrence remains within the declared Change Capability.

## Independent guard extraction

Change IR 0.9 adds `guardValidation`. Production AST extraction yields `formalSource.guardTree` and normalized guard claims. A separate indentation/control-flow parser reads raw source without importing `parser.js` and compares its GuardTree, guard claims and recipe parameter vocabulary with production extraction.

The small guard-expression normalizer is shared between the two paths; therefore the independent claim concerns source/control-flow extraction and equality of normalized claims, not two independent expression parsers.

## Current formal guard fragment

Guard-aware runtime certification covers safe-integer recipe parameter values, integer literals/parameter variables, `+`, `-`, unary minus, multiplication by one non-negative integer literal, comparisons, Boolean literals and `not/and/or`.

Persistent/global state guards, decimal guard values, division and general variable multiplication remain outside this stronger runtime theorem. A recipe can still retain older static SourceStmt/signature/capability coverage when its guard is outside beta.23; guard-aware runtime certification is a separate stricter layer.

## Beta.24 GUI mutation-path evidence

Beta.24 implements editable Window inputs with this source model:

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

The control edit supplies transient event-local `value`; the UI runtime does not assign `name` directly. Only source-level `change` commits persistent state. Unit tests verify the interpreter history/provenance route, and generated single-file Window HTML is executed in a fake-DOM harness to distinguish observation-only input from explicit persistence.

This is implementation evidence that the GUI surface respects State-Change Factorization. It is **not** a new mechanized theorem or standalone novelty claim.

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
PatchGuarded.lean            guard truth + guarded runtime/capability correspondence
```

Formal CI generates and compiles both static and guard-aware direct-runtime certificates under pinned Lean and rejects `sorry`/`admit`.

## Artifact engineering

The beta.24 artifact contains direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps and Patch Studio. Window runtimes support button `clicked` and semantic input `changed`; generated Window Web input behavior is executed in regression tests.

These platform features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.23 formal statement is:

> For a conservative protected direct-WebAssembly fragment, Patch independently validates source and guard/control-flow artifacts before runtime certification. Proof-free concrete semantic occurrences, path witnesses and concrete recipe-parameter environments are then checked by Lean against formal execution; branch witnesses must agree with evaluation of the normalized source guard in a safe-integer parameter fragment, and every decoded concrete occurrence is proved to remain within the declared semantic Change Capability. These results do not constitute full compiler verification.

Still unverified: JavaScript parser correctness, JavaScript→Wasm lowering, Wasm engine correctness, runtime observation/semantic reconstruction, and correct binding of proof-free JavaScript invocation values to machine-level Wasm parameters.

## Remaining high-value gaps

- formal recipe-call/substitution semantics for the implemented acyclic direct subset;
- semantic-security/plugin case studies;
- measured analysis/source/guard-validation/certificate/checker/backend overhead;
- systematic related-work review;
- reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for guard semantics, operational semantics, range analysis, abstract interpretation, refinement, path witnesses, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C generation, provenance, undo, GUI event wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**.

## Manuscript source

`main.tex` is the working article source. No empirical performance or user-study results should be stated until actually collected.

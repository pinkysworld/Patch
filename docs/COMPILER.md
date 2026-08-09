# Patch Compiler Architecture

Status: **0.2.0-beta.28** · Change IR **0.10**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard translation validation, Lean-checkable static/runtime/call certificates, direct Wasm/C99 Console backends, Standalone Window Web Apps and cross-platform packaging.

## Architecture

```text
exact Patch source
   ├─ production parser / AST
   │    ├─ Change Signatures / Capabilities
   │    ├─ SourceStmt + ranges + GuardTree
   │    └─ finite formalCalls recipe environment
   │
   ├─ independent raw SourceStmt/range parser ----┐
   └─ independent raw GuardTree/control parser ---┤ compare
                                                  ↓
                                      sourceValidation + guardValidation
                                                  ↓
                                           Change IR 0.10
                                                  ↓
       ┌─────────────┬───────────┬──────────┬────────────┬──────────────────┐
    .patchapp     bootstrap    direct      C99       Window Web       certificates
                  Wasm         Wasm                 generated runtime      ├─ static
                                                                         ├─ runtime/guard
                                                                         ├─ abstract calls
                                                                         ├─ exact calls
                                                                         ├─ arithmetic calls
                                                                         └─ structured callee traces
```

## Change IR 0.10

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
formalCalls
sourceValidation
guardValidation
```

Beta.28 does **not** change this schema. Concrete/arithmetic/structured-call witnesses and certificates remain separate research artifacts derived from the existing AST + `formalCalls` boundary.

## Abstract calls: beta.25

`src/formal-calls.js` emits a conservative finite per-recipe representation with parameter intervals, rank, semantic signature and a small `CallStmt` body. `formal/PatchCalls.lean` checks call resolution, strict rank decrease, positional `ArgsFit`, direct-effect membership and callee-to-caller `SignatureCovers`. `callSignatureSoundness` proves modeled rank-decreasing call effects remain in the caller semantic signature.

## Exact concrete binding: beta.26

`src/concrete-call-witness.js` records proof-free caller environments, formal argument `RangeExpr`s, exact integer values, expected callee bindings, declarations and beta.25 abstract argument intervals.

`formal/PatchCallSubstitution.lean` re-evaluates those expressions through the established functional `IntEnv`, constructs exact positional `BindingList`s and proves `concreteCallBinding_sound`. `formal/PatchCallRefinement.lean` transports exact values through beta.25 intervals to declarations.

`formal/PatchCallEffect.lean` evaluates a direct quantitative leaf Change under the exact bound environment. `checkedConcreteBoundEffectRefinesCallerSignature` combines exact binding/effect evaluation, callee effect membership and beta.25 callee-to-caller signature containment.

Duplicate parameter names are explicitly rejected at the concrete binding producer boundary so `BindingList → IntEnv` cannot depend on ambiguous shadowing order.

## Arithmetic certificate coverage: beta.27

The formal range semantics already supported:

```text
RangeExpr.lit Int
RangeExpr.var Name
RangeExpr.add left right
RangeExpr.sub left right
RangeExpr.neg expr
RangeExpr.scale Nat expr
```

Beta.27 recursively encodes that grammar in `src/concrete-call-certificate.js` version **0.3**. For `bonus + 1` and `amount * 2`, Lean receives and independently evaluates the formal expressions rather than trusted JavaScript constants.

## Structured callee traces: beta.28

Beta.28 adds a second concrete-call artifact for complete exact semantic-effect traces over a deliberately conservative structured callee-body fragment.

Production side:

```text
src/concrete-call-body.js
src/concrete-call-body-certificate.js
scripts/generate-concrete-call-body-certificate.js
examples/formal-callee-trace.patch
```

Formal side:

```text
formal/PatchCallBody.lean
formal/PatchCallBodyImport.lean
```

The supported `BoundStmt` grammar is:

```text
skip
emit expected amountExpr
seq first second
repeat Nat body
```

`evalBoundStmt` deterministically evaluates that body under one exact `BindingList`. Each quantitative emit reuses beta.26 `evalBoundQuantitativeEffect`, so arithmetic amounts continue to use the existing safe-integer `RangeExpr` semantics.

`evalBoundStmt_sound` connects executable evaluation to relational `BoundExec`. Generated evidence supplies a proof-free claimed effect list; `evalBoundStmtEqBool` recomputes the trace in Lean and compares each effect through the already-verified `effectEqBool`. `evalBoundStmtEqBool_sound` recovers exact trace equality.

`BoundBodyCovered` and `boundBodyCoveredBool` require each expected formal emit to be present in the callee semantic signature. `boundExecRefinesSignature` proves every actual occurrence in a structured exact execution refines some effect in that signature. `checkedEvaluatedBoundBodyRefinesSignature` exposes only executable premises to generated certificates.

`PatchCallBodyImport.lean` then composes:

```text
exact concreteCallBinding
+ exact structured callee evaluation
+ callee signature coverage
+ beta.25 callee -> caller SignatureCovers
-------------------------------------------------
ConcreteCallBindingSpec
+ whole exact concrete trace refines caller signature
```

The certificate-facing theorem is `checkedConcreteCallBodyRefinesCallerSignature`.

The reproducible example binds `caller(bonus=2)` to `award(amount=3)`. `award` changes `score` once and repeats a `coins` change twice, so the exact checked trace contains three semantic-effect occurrences.

## Generated certificates

Standard Formal CI generates and checks:

```text
GeneratedCertificate.lean
GeneratedRuntimeCertificate.lean
GeneratedCallCertificate.lean
GeneratedConcreteCallCertificate.lean
GeneratedArithmeticCallCertificate.lean
GeneratedConcreteCallBodyCertificate.lean
```

Cross-platform Node CI also generates the structured callee certificate on Windows, macOS and Linux.

The old beta.26/beta.27 focused compatibility workflows are retained for manual `workflow_dispatch`; the active beta.28 focused workflow and normal CI/Formal workflows skip Draft PRs and run when the PR is ready for review.

## Exact beta.28 boundary

Concrete structured-call certificate coverage includes:

- bounded safe-integer inter-recipe arguments from the beta.27 expression fragment;
- exact positional callee binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal non-negative static repeat;
- exact full effect trace for that body;
- callee signature coverage;
- import of the full exact trace into the caller semantic signature.

Still outside:

```text
branches/guard choices inside the structured certificate
nested recipe calls inside the certified body
dynamic repeat counts
state-dependent amount expressions outside the integer RangeExpr fragment
root-program concrete call certification
complete transitive concrete call trees
production JavaScript/direct-Wasm call equivalence
recursive/full floating-point call semantics
full compiler verification
```

Unsupported cases fail rather than silently weakening the certificate.

## Source, guard and runtime assurance

Independent `source-validation.js` and `guard-validation.js` continue to validate supported source/range and GuardTree extraction. `PatchGuarded` checks branch witnesses for the safe-integer guard fragment and composes accepted direct-runtime evidence with Change Capabilities. Beta.28 does not claim that this older runtime theorem already proves call-aware Wasm execution.

## Window and backend boundaries

The shared Window preflight supports button `clicked` and input `changed`; input edits remain transient until Patch source performs explicit `change`.

Direct Wasm supports the conservative numeric Console subset including acyclic recipes. Raw direct Wasm uses Patch's small host ABI and is not yet a standalone WASI command. Portable C99 is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw source/guard parser correctness
formalCalls/concrete-witness JavaScript extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
runtime observation completeness
branch/nested-call exact callee execution correspondence
production call execution == formal concrete call semantics
full floating-point/full-language semantics
```

Proof-free production data is accepted only where the relevant Lean checker can recompute or validate its supported obligation.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and certificate generation;
- generated static/runtime/abstract-call/exact-call/arithmetic-call/structured-call certificates;
- pinned-Lean verification of all generated certificates;
- focused beta.28 structured callee trace workflow;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.

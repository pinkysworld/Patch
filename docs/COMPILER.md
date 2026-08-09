# Patch Compiler Architecture

Status: **0.2.0-beta.29** · Change IR **0.10**

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
                                                                         └─ guarded structured callee traces
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

Beta.29 does **not** change this schema. Concrete/arithmetic/structured-call witnesses and certificates remain separate research artifacts derived from the existing AST + `formalCalls` boundary. Guard-aware callee traces reuse the existing formal guard representation rather than adding an IR field.

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

The beta.28 `BoundStmt` grammar is:

```text
skip
emit expected amountExpr
seq first second
repeat Nat body
```

`evalBoundStmt` deterministically evaluates that body under one exact `BindingList`. Each quantitative emit reuses beta.26 `evalBoundQuantitativeEffect`, so arithmetic amounts continue to use the existing safe-integer `RangeExpr` semantics.

`evalBoundStmt_sound` connects executable evaluation to relational `BoundExec`. Generated evidence supplies a proof-free claimed effect list; `evalBoundStmtEqBool` recomputes the trace in Lean and compares each effect through the already-verified `effectEqBool`. `evalBoundStmtEqBool_sound` recovers exact trace equality.

`BoundBodyCovered` and `boundBodyCoveredBool` require each expected formal emit to be present in the callee semantic signature. `boundExecRefinesSignature` proves every actual occurrence in a structured exact execution refines some effect in that signature. `checkedEvaluatedBoundBodyRefinesSignature` exposes only executable premises to generated certificates.

`PatchCallBodyImport.lean` composes exact concrete binding, exact structured callee evaluation, callee signature coverage and beta.25 callee-to-caller `SignatureCovers`. The certificate-facing theorem is `checkedConcreteCallBodyRefinesCallerSignature`.

`GeneratedConcreteCallBodyCertificate.lean` remains the branch-free beta.28 regression certificate.

## Guard-aware structured callee traces: beta.29

Beta.29 extends the **same** `BoundStmt` semantics rather than introducing a second body language:

```text
branch GuardExpr thenBranch elseBranch
```

The guard is the established `GuardExpr` from `PatchGuarded.lean`. `evalBoundStmt` evaluates it through `evalGuard guard (envOfBindings bindings)`, so exact branch truth is computed using the same integer `RangeExpr` evaluator and the exact callee `BindingList` already checked at the beta.26 boundary.

Relational semantics add `BoundExec.branchThen` and `BoundExec.branchElse`. `evalBoundStmt_sound` proves that successful executable evaluation determines a matching relational execution including the concrete guard truth.

Static signature discipline remains deliberately stronger than concrete path selection. `BoundBodyCovered` for a branch requires coverage of **both** arms. `boundExecRefinesSignature` then uses the selected branch execution to prove only the actual trace occurrences while retaining both-arm semantic-signature coverage.

Production witness/certificate versions are **0.2**:

```text
src/concrete-call-body.js
src/concrete-call-body-certificate.js
examples/formal-callee-guard.patch
GeneratedGuardedCallBodyCertificate.lean
```

`src/concrete-call-body.js` reuses `src/formal-guard.js` to reconstruct supported guards. Guard variables are limited to bounded recipe parameters, and JavaScript computes a proof-free exact trace claim only after exact call binding. Lean independently re-evaluates both the guard and selected body before accepting the claim.

The focused beta.29 example certifies two concrete calls to the same callee: one selects the `then` arm with `amount = 3`, and one selects the `else` arm with `amount = 1`. This exercises exact true and false branch paths rather than one happy case.

## Generated certificates

Standard Formal CI generates and checks:

```text
GeneratedCertificate.lean
GeneratedRuntimeCertificate.lean
GeneratedCallCertificate.lean
GeneratedConcreteCallCertificate.lean
GeneratedArithmeticCallCertificate.lean
GeneratedConcreteCallBodyCertificate.lean
GeneratedGuardedCallBodyCertificate.lean
```

The old beta.26/beta.27 focused compatibility workflows remain manual. The beta.28 regression workflow and active beta.29 focused workflow use pinned Lean and reject unfinished proofs.

## Exact beta.29 boundary

Concrete guarded structured-call certificate coverage includes:

- bounded safe-integer inter-recipe arguments from the beta.27 expression fragment;
- exact positional callee binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal non-negative static repeat;
- formal Boolean/comparison `GuardExpr` over exact recipe parameters;
- exact true/false branch selection;
- exact full effect trace for the selected path;
- both-arm callee signature coverage;
- import of the selected exact trace into the caller semantic signature.

Still outside:

```text
persistent-state guard variables in the exact call certificate
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

Independent `source-validation.js` and `guard-validation.js` continue to validate supported source/range and GuardTree extraction. `PatchGuarded` checks branch witnesses for the safe-integer guard fragment and composes accepted direct-runtime evidence with Change Capabilities. Beta.29 reuses its `GuardExpr` evaluator for exact callee branch choice but does not claim that the older runtime theorem already proves call-aware Wasm execution.

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
nested/transitive exact callee execution correspondence
production call execution == formal concrete call semantics
full floating-point/full-language semantics
```

Proof-free production data is accepted only where the relevant Lean checker can recompute or validate its supported obligation.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and certificate generation;
- generated static/runtime/abstract-call/exact-call/arithmetic-call/structured-call/guarded-call certificates;
- pinned-Lean verification of all generated certificates;
- focused beta.28 regression and beta.29 guard-aware structured callee trace workflows;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.

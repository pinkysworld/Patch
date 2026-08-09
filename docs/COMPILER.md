# Patch Compiler Architecture

Status: **0.2.0-beta.27** · Change IR **0.10**

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
                                                                         └─ arithmetic calls
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

Beta.27 does **not** change this schema. Concrete/arithmetic call witnesses and certificates remain separate research artifacts derived from the existing AST + `formalCalls` boundary.

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

Beta.26's certificate encoder exposed only `RangeExpr.var`. Beta.27 recursively encodes the full grammar above in `src/concrete-call-certificate.js` version **0.3**. This is a production-to-formal coverage extension, not a new arithmetic analyzer.

Example:

```patch
create number score = 0

make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)
```

The generated certificate preserves:

```text
RangeExpr.add (RangeExpr.var "bonus") (RangeExpr.lit 1)
RangeExpr.scale 2 (RangeExpr.var "amount")
```

instead of replacing them with JavaScript-computed constants. Lean re-evaluates the call argument to `5`, reconstructs `amount = 5`, checks it through the abstract/declaration intervals, evaluates the direct leaf amount to `10`, and validates the singleton effect through the existing effect-refinement/caller-signature theorem.

For direct leaf effects JavaScript still emits a proof-free claimed singleton effect. The helper `evaluateFormalRangeExprExact` exists only to form that claim; generated Lean independently checks it through `evalBoundQuantitativeEffectEqBool` and `evalBoundQuantitativeEffectEqBool_sound`.

## Generated certificates

Standard Formal CI now generates and checks:

```text
GeneratedCertificate.lean
GeneratedRuntimeCertificate.lean
GeneratedCallCertificate.lean
GeneratedConcreteCallCertificate.lean
GeneratedArithmeticCallCertificate.lean
```

The arithmetic file comes from `examples/formal-calls-arithmetic.patch`. The dedicated `Patch Beta27 Arithmetic Calls` workflow separately generates and checks that exact file under the pinned Lean version.

Cross-platform Node CI generates both the beta.26 concrete certificate and beta.27 arithmetic certificate on Windows, macOS and Linux before continuing with normal build/site gates.

## Exact beta.27 boundary

Concrete certificate coverage now includes:

- bounded safe-integer inter-recipe arguments using integer literals, variables, `+`, `-`, unary `-`, and multiplication by a non-negative integer literal;
- exact positional callee binding;
- exact-value fit through beta.25 abstract intervals into declarations;
- a single direct quantitative leaf `add`/`remove` Change whose amount uses the same formal integer expression fragment;
- singleton concrete effect refinement into an effect represented by the caller signature.

Still outside:

```text
division
general variable-by-variable multiplication
decimal/floating-point call expressions
root-program concrete call certification
arbitrary structured callee-body execution under exact bindings
complete transitive concrete call traces
production JavaScript/direct-Wasm call equivalence
recursive/full-language call semantics
```

Unsupported cases fail rather than silently weakening the certificate.

## Source, guard and runtime assurance

Independent `source-validation.js` and `guard-validation.js` continue to validate supported source/range and GuardTree extraction. `PatchGuarded` checks branch witnesses for the safe-integer guard fragment and composes accepted direct-runtime evidence with Change Capabilities. Beta.27 does not claim that this older runtime theorem already proves call-aware Wasm execution.

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
arbitrary structured call execution correspondence
production call execution == formal concrete call semantics
full floating-point/full-language semantics
```

Proof-free production data is accepted only where the relevant Lean checker can recompute or validate its supported obligation.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and certificate generation;
- generated static/runtime/abstract-call/exact-call/arithmetic-call certificates;
- pinned-Lean verification of all generated certificates;
- dedicated arithmetic concrete-call workflow;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.

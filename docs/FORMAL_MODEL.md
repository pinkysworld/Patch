# Patch Core Formal Model

Status: **beta.32: mechanized semantic-change contracts, finite transitive exact call trees, and invocation-frame-aware direct-Wasm correspondence for repeated finite calls**.

Patch is not a fully verified compiler. Lean covers explicit fragments; production parsing, JavaScript-to-Wasm lowering/runtime, independent JavaScript validators, runtime capture and invocation-frame reconstruction remain named boundaries.

## Lean modules

- `PatchFormal.lean`: semantic changes, state, intervals, effects and policies.
- `PatchSignature.lean`: Change Signature Soundness.
- `PatchChecker.lean`: verified semantic policy checker.
- `PatchRange.lean`: exact integer `RangeExpr` evaluation and range soundness.
- `PatchRuntime.lean` / `PatchRuntimeCapability.lean`: runtime effect refinement/capability containment.
- `PatchGuarded.lean`: formal `GuardExpr` truth and guard-aware runtime correspondence.
- `PatchCalls.lean`: finite ranked abstract recipe-call composition.
- `PatchCallSubstitution.lean`: exact positional call binding.
- `PatchCallRefinement.lean`: concrete values through beta.25 abstract intervals.
- `PatchCallEffect.lean`: exact quantitative effect refinement.
- `PatchCallBody.lean` / `PatchCallBodyImport.lean`: beta.28/29 exact structured/guarded callee traces.
- `PatchCallTree.lean`: beta.30 finite recursive exact call-tree evaluation and edge-by-edge signature import.
- **`PatchCallRuntime.lean`: runtime-derived observed effects re-evaluated against beta.30 exact call-tree semantics.**

Change IR remains **0.10**.

## Core containment

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Independent source, range and guard translation validation

The production compiler emits formal source/range/guard views that later certificates consume. Patch does not treat those JavaScript extractions as self-authenticating.

### Independent source and range path

`src/source-validation.js` reconstructs the supported source shape directly from raw Patch text without importing `parser.js` or consuming the production AST.

Numeric `add`/`remove` expressions no longer reuse the production `formal-range.js` implementation. `src/independent-range-expression.js` contains a separate lexer, recursive-descent parser and safe-integer interval evaluator. It imports neither `formal-range.js`, `range-analysis.js` nor `parser.js`.

For the beta.9 supported numeric fragment it independently derives:

- normalized declarative `RangeExpr` structure;
- exactly used parameter-range bindings;
- safe-integer interval bounds.

The supported fragment includes integer literals, ranged recipe parameters, parentheses, unary plus/minus, addition/subtraction and multiplication where one operand is a non-negative integer literal. Decimals, division, unknown/unranged values, unsafe integers and general variable-by-variable multiplication fail closed.

The independently reconstructed `SourceStmt` and range claims are compared with compiler-produced `formalSource` evidence. Source-validation schema **0.2** records independent range-expression implementation version **0.1**. The generated static Lean certificate records both versions and only emits protected evidence after raw-source validation succeeds.

### Independent guard path

Guard validation separately reconstructs both source control structure and guard expressions:

1. `src/guard-validation.js` independently reconstructs indentation, recipe boundaries, branches and repeats from raw Patch text;
2. `src/independent-guard-expression.js` uses its own lexer and recursive-descent parser for the beta.23 Boolean/integer guard fragment;
3. this independent parser does **not** import `formal-guard.js`, `parser.js`, or production AST helpers;
4. its normalized declarative `GuardExpr`, guard claims and variable set are compared against compiler-produced formal guard evidence;
5. mismatches fail validation before protected runtime certification.

The production and validation sides therefore share formal target vocabularies but no longer share the numeric range-expression or Boolean guard-expression parser implementations. Guard-validation evidence schema **0.2** records independent guard-expression parser version **0.1**.

These are concrete reductions of shared JavaScript extraction trust, not verified parser/evaluator theorems. Both independent implementations remain JavaScript. Lean checks the formal evidence produced after translation validation rather than proving either lexer, parser or interval evaluator correct.

## Beta.30 finite transitive exact call trees

`CallTreeStmt` preserves beta.29 bodies as call-free leaves and adds sequence, literal/static repeat, exact `GuardExpr` branches and ranked nested calls.

Lean independently checks exact nested argument evaluation/binding, strict rank decrease, selected guard/repeat/direct-effect execution, nested body coverage and one `SignatureCovers` import per call edge.

The certificate theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

## Beta.31 observed runtime bridge

Beta.31 first connected an actually executed direct-Wasm trace to beta.30 call-tree semantics without adding trusted backend call-enter/call-exit markers. Its limitation was attribution: repeated indistinguishable scoped traces were rejected.

`PatchCallRuntime.lean` proves:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

with the critical premise:

```text
evalCallTreeStmtEqBool calleeBindings body observed = true
```

so the runtime-derived observed list is re-evaluated in Lean rather than trusted as already equal to the beta.30 trace.

## Beta.32 independent invocation-frame correspondence

The independent Change-IR execution model now reconstructs every concrete `DO` invocation-frame while deriving and validating the expected runtime path. No invocation metadata is accepted from the direct-Wasm backend.

Each frame contains:

```text
frameId
parentFrameId
callerScope
callee
dynamic invocation ordinal
depth
exact argument values
exact parameter BindingList
transitionStart / transitionEndExclusive
```

Every independently validated transition/effect carries the active frame stack. A beta.30 witness is matched to one reconstructed frame by caller/callee/dynamic invocation identity, and the frame's exact parameter bindings must match the beta.30 expected callee binding.

The generated beta.32 certificate then adds a Lean-decided equality:

```text
runtimeFrameBindings = beta30ExactBindings
```

before checking:

```text
evalCallTreeStmtEqBool beta30ExactBindings body frameSelectedObserved = true
```

and reusing:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

This makes repeated identical calls distinguishable by independently reconstructed concrete frame identity while keeping the formal call-tree semantics unchanged.

`examples/formal-transitive-calls-repeated.patch` contains two identical `do caller(1)` invocations. Beta.32 generates separate frame-selected observations and the corresponding `GeneratedRepeatedTransitiveRuntimeCertificate.lean`.

`examples/formal-transitive-calls-mixed-guards.patch` strengthens this regression with `caller(1)`, `caller(4)`, `caller(1)` through `caller -> outer -> middle -> leaf`. Independent reconstruction produces twelve dynamic frames and six supported transitive correspondences. The three outer witnesses preserve the concrete guard-selected effects `coins +4`, `score +5`, `coins +4`, and `GeneratedMixedGuardTransitiveRuntimeCertificate.lean` is checked with Lean.

## Exact beta.32 boundary

Mechanically/formally checked after evidence generation:

- beta.30 exact outer/nested bindings and rank decrease;
- beta.30 exact guarded/static-repeat/direct-effect semantics;
- nested signature coverage and edge-by-edge import;
- equality between each independently reconstructed runtime-frame `BindingList` and the beta.30 exact callee `BindingList`;
- exact equality between each frame-selected observed effect list and Lean's re-evaluated call-tree trace;
- observed-list refinement into the caller semantic signature.

Runtime evidence established by JavaScript before Lean:

- real direct-Wasm module execution;
- complete raw transition validation against independent Change-IR execution;
- semantic operation and recipe-scope reconstruction;
- concrete invocation-frame reconstruction and active frame stacks;
- frame-based effect selection.

Still explicit proof-free/trust boundaries:

- **runtime capture**;
- correctness/completeness of the independent JavaScript validator and **invocation-frame reconstruction**;
- production parser/extractor correctness, although independently parsed source/range and guard evidence now reduce shared-code extraction trust for the supported fragments;
- correctness of the independent JavaScript source/range/guard validators themselves;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.32 is therefore not a full forward/backward simulation theorem for the compiler/runtime and not full compiler verification.

## Earlier assurance layers

- Beta.23: conservative guard-aware direct-runtime/capability correspondence.
- Beta.25: abstract finite ranked call composition.
- Beta.26-27: exact safe-integer binding and integer `RangeExpr` coverage.
- Beta.28: exact direct quantitative sequence/static-repeat callee traces.
- Beta.29: exact formal-guard branch selection with both-arm static coverage.
- Beta.30: finite transitive exact call-tree traces.
- Beta.31: first conservative call-aware direct-Wasm bridge with unique-slice attribution.

## Research boundary

Procedure-call semantics, invocation frames, transitive traces, runtime validation, effect refinement, translation validation and proof-carrying evidence all have extensive prior art. Beta.32 is **supporting assurance**, not a new firstness claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.

# Patch Compiler Architecture

Status: **0.2.0-beta.26** · Change IR **0.10**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard translation validation, Lean-checkable static/runtime/abstract-call/concrete-call certificates, direct Wasm/C99 Console backends, Standalone Window Web Apps and cross-platform packaging.

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
       ┌─────────────┬───────────┬──────────┬────────────┬─────────────┐
    .patchapp     bootstrap    direct      C99       Window Web    certificates
                  Wasm         Wasm                 generated runtime
                                                               ├─ static
                                                               ├─ runtime/guard
                                                               ├─ abstract calls
                                                               └─ concrete calls
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

Beta.26 does **not** change this schema. Concrete call witnesses/certificates are deliberately separate proof-free research artifacts derived from the existing AST plus `formalCalls` boundary.

## Beta.25 abstract `formalCalls`

`src/formal-calls.js` emits a conservative finite per-recipe representation with parameter intervals, rank, semantic signature and a small `CallStmt` body. Unknown calls, duplicate recipes, recursion/cycles, unbounded parameters and unsupported constructs fail conservatively.

The Lean module `PatchCalls.lean`, stored at `formal/PatchCalls.lean`, checks:

```text
callee exists
callee.rank < caller.rank
actual argument intervals fit callee parameter intervals
callee.signature ⊆ caller.signature
direct effect ∈ caller signature
```

The production-generated `GeneratedCallCertificate.lean` requires `checkRecipeEnv callEnv = true`. `callSignatureSoundness` proves modeled rank-decreasing call effects remain inside the caller semantic signature.

## Beta.26 concrete call witness

`src/concrete-call-witness.js` executes the supported safe-integer call-argument fragment over concrete local environments and records proof-free data:

```text
caller
callee
callerEnv
formal argument RangeExprs
exact concrete argument values
expected positional callee bindings
declared callee parameter intervals
beta.25 abstract argument intervals
```

The JavaScript witness is not treated as a proof. `src/concrete-call-certificate.js` encodes the data into `GeneratedConcreteCallCertificate.lean`, where Lean re-evaluates supported arguments and reconstructs the binding.

The first concrete production-connected subset is intentionally restricted to **inter-recipe variable pass-through** calls such as:

```patch
make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)
```

Root-program calls and richer arithmetic call arguments remain outside the current concrete certificate.

## Concrete parameter binding

`formal/PatchCallSubstitution.lean` keeps serializable evidence separate from the existing evaluator environment:

```text
BindingList = List (Name × Int)
IntEnv      = Name → Option Int
```

`envOfBindings` converts the serializable binding list into `IntEnv`. `evalCallArgs` evaluates formal `RangeExpr` arguments; `bindCallParams` constructs exact positional callee bindings. `concreteCallBinding_sound` proves successful executable binding satisfies `ConcreteCallBindingSpec`.

## Concrete-to-abstract interval bridge

`formal/PatchCallRefinement.lean` composes exact values with beta.25 intervals:

```text
ConcreteArgsFit values actual
ArgsFit actual declared
-----------------------------
ConcreteArgsFit values declared
```

The certificate-facing executable check is `concreteThroughAbstractBool`; its soundness theorem is `concreteThroughAbstractBool_sound`.

## Bound direct semantic effect

`formal/PatchCallEffect.lean` handles a narrower direct quantitative leaf Change. `evalBoundQuantitativeEffect` evaluates the amount expression in the exact callee environment and constructs a singleton concrete amount interval.

For example:

```text
amount = 4
expected: score increase [0,5]
actual:   score increase [4,4]
```

`evalBoundQuantitativeEffect_sound` proves the concrete effect satisfies the existing `PatchRuntime.EffectRefines` relation.

Generated certificates use `evalBoundQuantitativeEffectEqBool` rather than adding a global `DecidableEq Effect`; its theorem `evalBoundQuantitativeEffectEqBool_sound` recovers the exact equality from beta.25's verified `effectEqBool`.

The main executable composition theorem is:

```text
checkedConcreteBoundEffectRefinesCallerSignature
```

It combines exact binding, exact amount evaluation, callee effect membership and beta.25 callee-to-caller signature containment. The conclusion contains both `ConcreteCallBindingSpec` and `RefinesSignature concreteEffect callerSignature`.

## Generated concrete certificate

The cross-platform JS CI generates:

```text
GeneratedConcreteCallCertificate.lean
```

Standard Formal CI and the beta.26 focused gate both compile it with pinned Lean. For the current `formal-calls.patch` example, concrete bindings are checked for the nested call chain, and the two `reward -> add_points` leaf invocations additionally receive direct bound-effect refinement proofs.

## Exact beta.26 boundary

Proved/checked in the concrete-call slice:

- inter-recipe safe-integer variable argument evaluation;
- exact positional parameter binding;
- exact value fit through beta.25 abstract intervals to declarations;
- one direct quantitative leaf `add`/`remove` effect whose amount is a bound variable;
- refinement of the exact singleton effect into an effect imported by the caller signature.

Still outside:

```text
root-program concrete call certification
richer arithmetic call substitution
arbitrary callee-body/control-flow execution under exact bindings
full transitive concrete call traces
production JavaScript/direct-Wasm call equivalence
recursive/floating-point/full-language call semantics
```

These are explicit limits, not silent fallbacks.

## Source, guard and runtime assurance

Independent `source-validation.js` and `guard-validation.js` continue to validate supported source/range and GuardTree extraction. `PatchGuarded` checks concrete branch witnesses for the safe-integer parameter fragment and composes accepted direct-runtime evidence with Change Capabilities. beta.26 does not conflate this existing runtime theorem with the newer call certificate.

## Window and backend boundaries

The shared Window preflight supports button `clicked` and input `changed`; input edits remain transient until Patch source performs explicit `change`.

Direct Wasm supports the conservative numeric Console subset including acyclic recipes. Raw direct Wasm still uses Patch's small host ABI and is not a standalone WASI command. Portable C99 is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw source/guard parser correctness
formalCalls JavaScript extractor correctness
concrete-call JavaScript witness extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
runtime observation completeness
arbitrary source-call expression -> concrete certificate correspondence
production call execution == formal concrete call semantics
full floating-point/full-language semantics
```

Proof-free production data is accepted only where the relevant Lean checker can recompute or validate its supported obligation.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests;
- concrete call witness/certificate tests;
- generated static/runtime/abstract-call/concrete-call certificates;
- `PatchCalls`, `PatchCallSubstitution`, `PatchCallRefinement`, `PatchCallEffect` under pinned Lean;
- generated `GeneratedConcreteCallCertificate.lean` checked by Lean;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.

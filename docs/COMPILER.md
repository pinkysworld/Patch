# Patch Compiler Architecture

Status: **0.2.0-beta.30** · Change IR **0.10**

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
                  Wasm         Wasm                 generated runtime      ├─ static/runtime
                                                                         ├─ abstract calls
                                                                         ├─ exact calls
                                                                         ├─ guarded body traces
                                                                         └─ finite transitive call trees
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

Beta.30 does **not** change this schema. The new transitive witness/certificate is a separate assurance artifact derived from the existing AST + `formalCalls` boundary.

## Call-assurance progression

### Beta.25: abstract finite calls

`src/formal-calls.js` emits a conservative finite per-recipe representation with parameter intervals, rank, semantic signature and `CallStmt` body. `PatchCalls.lean` checks resolution, strict rank decrease, `ArgsFit`, direct-effect membership and `SignatureCovers`.

### Beta.26–27: exact binding and arithmetic

`src/concrete-call-witness.js` records exact caller environments, formal `RangeExpr` arguments, exact integer values, declarations and beta.25 abstract argument intervals.

`PatchCallSubstitution.lean` re-evaluates arguments and proves exact positional binding. `PatchCallRefinement.lean` connects concrete values through beta.25 intervals. `PatchCallEffect.lean` checks exact quantitative direct leaf effects.

The supported integer expression grammar is:

```text
RangeExpr.lit Int
RangeExpr.var Name
RangeExpr.add left right
RangeExpr.sub left right
RangeExpr.neg expr
RangeExpr.scale Nat expr
```

### Beta.28: exact structured callee traces

`PatchCallBody.lean` adds executable complete traces for call-free direct quantitative bodies containing `skip`, `emit`, `seq` and literal/static `repeat`. `PatchCallBodyImport.lean` imports the exact trace through the caller signature.

### Beta.29: exact GuardExpr branches

The same `BoundStmt` semantics gains `branch GuardExpr thenBranch elseBranch`. Lean evaluates guards under the exact callee `BindingList`. Concrete execution follows only the selected path while static signature coverage requires **both** branch arms.

### Beta.30: finite transitive exact call trees

Production side:

```text
src/transitive-call-body.js
src/transitive-call-body-certificate.js
scripts/generate-transitive-call-body-certificate.js
examples/formal-transitive-calls.patch
```

Formal side:

```text
formal/PatchCallTree.lean
```

`src/transitive-call-body.js` preserves recursive nested-call structure rather than flattening effects. Each nested call records formal argument expressions, declarations, nested callee signature and nested body.

`PatchCallTree.lean` adds:

```text
CallTreeStmt.base BoundStmt
CallTreeStmt.seq
CallTreeStmt.repeat Nat
CallTreeStmt.branch GuardExpr
CallTreeStmt.call callerRank calleeRank argExprs params declared calleeSignature body
```

`CallTreeExec` is indexed by exact `BindingList`, allowing nested calls to construct and switch to a new exact callee environment through the existing `concreteCallBinding` evaluator.

`CallTreeCovered` is indexed by semantic signature. Every nested call requires:

```text
calleeRank < callerRank
nested body covered by callee signature
callee signature covered by enclosing signature
```

The executable `callTreeCoveredBool` checks these obligations recursively. Thus strict rank decrease is mechanically checked in Lean at every nested edge rather than being trusted from the JavaScript witness producer.

The generated certificate separately checks the outer certified edge rank as well.

The strongest beta.30 example is:

```text
caller -> outer -> middle -> leaf
```

and produces the exact selected transitive trace:

```text
score increase [4,4]
coins increase [3,3]
```

Lean re-evaluates exact outer binding, concrete-through-abstract interval fit, outer rank decrease, every nested argument/binding, nested rank decrease, selected guards/repeats/effects and edge-by-edge semantic-signature import.

The certificate-facing theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

## Generated certificates

Standard Formal CI now generates and verifies:

```text
GeneratedCertificate.lean
GeneratedRuntimeCertificate.lean
GeneratedCallCertificate.lean
GeneratedConcreteCallCertificate.lean
GeneratedArithmeticCallCertificate.lean
GeneratedConcreteCallBodyCertificate.lean
GeneratedGuardedCallBodyCertificate.lean
GeneratedTransitiveCallBodyCertificate.lean
```

The beta.30 certificate can be regenerated with:

```bash
npm run transitive-callee-trace-certify:example
```

The focused beta.30 workflow also regenerates beta.29 evidence as regression coverage and rejects unfinished Lean proofs.

## Exact beta.30 boundary

Covered:

- beta.25 finite acyclic/rank-decreasing recipe environments;
- safe-integer `RangeExpr` call arguments;
- exact outer/nested positional binding;
- beta.25 abstract interval fit for outer concrete values;
- strict outer and nested rank-decrease checks;
- direct quantitative `add`/`remove` effects;
- sequence;
- literal/static repeat;
- exact `GuardExpr` branches over recipe parameters;
- complete finite selected transitive traces;
- nested signature coverage and edge-by-edge caller-signature import.

Still outside:

```text
root-program concrete call certification
recursive/cyclic call trees
dynamic repeat
persistent-state exact guard variables
returns
expressions outside supported safe-integer/Boolean fragments
production JavaScript/direct-Wasm call equivalence
full floating-point call semantics
full compiler verification
```

Unsupported assurance cases fail closed.

## Source, guard and runtime assurance

Independent `source-validation.js` and `guard-validation.js` validate supported source/range and GuardTree extraction. `PatchGuarded` checks direct-runtime guard truth and capability correspondence for the established safe-integer parameter fragment.

Beta.30 reuses those formal guard semantics but does **not** claim that the existing direct-runtime theorem proves call-aware production-Wasm equivalence. Connecting beta.30 call-tree certificates to observed direct-Wasm calls is the next research priority.

## Window and backend boundaries

The shared Window preflight supports button `clicked` and input `changed`; input edits remain transient until Patch source performs explicit `change`.

Direct Wasm supports the conservative numeric Console subset including acyclic recipes. Raw direct Wasm uses Patch's small host ABI and is not yet a standalone WASI command. Portable C99 is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw source/guard parser correctness
proof-free witness extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
runtime observation completeness
production JavaScript/direct-Wasm call execution equivalence
full floating-point/full-language semantics
```

Proof-free production data is accepted only where the relevant Lean checker can recompute or validate its supported obligation.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and certificate generation;
- pinned-Lean verification of all generated certificates including beta.30;
- focused beta.28/beta.29 regression and beta.30 transitive call-tree workflows;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.

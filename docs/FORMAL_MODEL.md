# Patch Core Formal Model

Status: **beta.31: mechanized semantic-change contracts, finite transitive exact call trees, and conservative call-aware direct-Wasm correspondence for unambiguous validated scoped traces**.

Patch is not a fully verified compiler. Lean covers explicit fragments; production parsing, JavaScript-to-Wasm lowering/runtime, independent JavaScript validators and evidence attribution remain named boundaries.

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
- **`PatchCallRuntime.lean`: beta.31 bridge from runtime-derived observed effects to beta.30 exact call-tree refinement.**

Change IR remains **0.10**.

## Core containment

For the structured semantic core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.30 finite transitive exact call trees

`CallTreeStmt` preserves beta.29 bodies as call-free leaves and adds sequence, literal/static repeat, exact `GuardExpr` branches and ranked nested calls.

Each nested call carries:

```text
callerRank
calleeRank
RangeExpr arguments
parameter names
declared intervals
callee semantic signature
nested CallTreeStmt body
```

Lean independently checks exact nested argument evaluation/binding, strict rank decrease, selected guard/repeat/direct-effect execution, nested body coverage and one `SignatureCovers` import per call edge.

The certificate theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

The depth-2 example is:

```text
caller -> outer -> middle -> leaf
```

with exact selected trace:

```text
score increase [4,4]
coins increase [3,3]
```

## Beta.31 call-aware direct-Wasm correspondence

Beta.31 does not modify the direct-Wasm backend to emit trusted call-enter/call-exit markers. The existing backend executes normally and returns its raw transition stream:

```text
target / before / after
```

`src/direct-trace-validator.js` independently executes the supported Change IR and validates the **complete** raw transition sequence. `src/direct-effect-validator.js` then reconstructs semantic operation identity and recipe scope from that independent execution model.

`src/transitive-runtime-correspondence.js` compares the beta.30 exact scoped trace with the validated runtime semantic-effect stream. A candidate is accepted only if the same **scope + exact semantic-effect sequence** occurs once. Zero matches fail; repeated indistinguishable matches are marked ambiguous and fail closed.

For the depth-2 example the validated scoped sequence is:

```text
leaf   : score increase [4,4]
middle : coins increase [3,3]
```

Site ids, source operation lines and raw before/after transitions are retained as audit metadata, but beta.31's attribution criterion is the unique scoped exact-effect sequence.

### Lean bridge

`PatchCallRuntime.lean` proves:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

Its critical premise is:

```text
evalCallTreeStmtEqBool calleeBindings body observed = true
```

where `observed` is the semantic-effect list reconstructed from the validated direct-Wasm execution.

Therefore the observed runtime list is not trusted as already equal to the beta.30 trace. `evalCallTreeStmtEqBool_sound` causes Lean to re-evaluate the exact nested call tree against that runtime-derived list before the beta.30 caller-signature theorem is reused.

The generated `GeneratedTransitiveRuntimeCertificate.lean` embeds the full beta.30 generated call-tree definitions/proofs and adds runtime-derived observed effects, scope/site audit metadata and the beta.31 theorem.

Standard Formal CI runs the Wasm program, generates the certificate and verifies it with pinned Lean. Standard Windows/macOS/Linux CI also executes the direct-Wasm example and regenerates beta.31 evidence.

## Exact beta.31 boundary

Mechanically/formally checked after evidence generation:

- beta.30 exact outer and nested bindings;
- beta.30 outer/nested rank decrease;
- beta.30 exact guarded/static-repeat/direct-effect semantics;
- beta.30 nested signature coverage and edge-by-edge import;
- exact equality between the runtime-derived observed effect list and Lean's re-evaluated call-tree trace;
- observed-list refinement into the caller semantic signature.

Runtime evidence established by JavaScript before Lean:

- real direct-Wasm module execution;
- complete raw transition validation against independent Change-IR execution;
- semantic operation reconstruction;
- recipe-scope reconstruction;
- unique contiguous scoped-effect sequence attribution.

Still explicit proof-free/trust boundaries:

- **runtime capture**;
- correctness/completeness of the independent JavaScript validator;
- **scoped-slice attribution** from the validated effect stream to a concrete invocation;
- production parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.31 is therefore not a full forward/backward simulation theorem for the compiler/runtime. In particular, repeated identical scoped traces are rejected rather than disambiguated.

## Earlier assurance layers

- Beta.23: conservative guard-aware direct-runtime/capability correspondence.
- Beta.25: abstract finite ranked call composition.
- Beta.26-27: exact safe-integer binding and integer `RangeExpr` coverage.
- Beta.28: exact direct quantitative sequence/static-repeat callee traces.
- Beta.29: exact formal-guard branch selection with both-arm static coverage.
- Beta.30: finite transitive exact call-tree traces.

## Research boundary

Procedure-call semantics, transitive traces, runtime validation, effect refinement, translation validation and proof-carrying evidence all have extensive prior art. Beta.31 is **supporting assurance**, not a new firstness claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.

The next formal hardening target is independent concrete invocation-frame reconstruction so repeated identical calls can be mapped without relying on globally unique scoped slices or adding trusted compiler-emitted call events.

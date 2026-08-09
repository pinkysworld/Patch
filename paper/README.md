# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.31 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance stack now includes:

1. semantic factorization, Change Signature Soundness, policy containment and integer range soundness;
2. independent source/guard translation validation;
3. conservative guard-aware direct-runtime validation;
4. finite ranked abstract recipe-call composition;
5. exact safe-integer binding and quantitative effect refinement;
6. beta.28/29 exact structured and guard-selected callee traces;
7. beta.30 finite transitive exact call-tree traces;
8. **beta.31 call-aware direct-Wasm correspondence for unambiguous independently validated scoped traces**.

None is described as complete compiler verification.

## Beta.31 call-aware direct-Wasm milestone

The reproducible example is `examples/formal-transitive-calls.patch`:

```text
caller -> outer -> middle -> leaf
```

The existing direct-Wasm backend is executed without adding trusted call-entry/exit events. It produces its normal raw transition stream. The independent Change-IR validator must first validate the complete target/before/after sequence and reconstruct semantic operation identity and recipe scope.

The beta.30 exact scoped effect sequence is then accepted only if it has one unique occurrence in that validated stream. For the depth-2 example:

```text
leaf   : score increase [4,4]
middle : coins increase [3,3]
```

Repeated indistinguishable scoped sequences are rejected as ambiguous.

`formal/PatchCallRuntime.lean` adds:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

The generated runtime-derived observed list is passed directly to:

```text
evalCallTreeStmtEqBool exactBindings exactTree observed
```

so Lean re-evaluates the beta.30 exact call tree against the effects reconstructed from the real validated Wasm execution before caller-signature refinement is concluded.

`GeneratedTransitiveRuntimeCertificate.lean` is self-contained: it embeds the beta.30 generated call-tree certificate and appends beta.31 runtime-derived observations and proofs. Standard Formal CI and the focused beta.31 workflow verify it with pinned Lean. Windows/macOS/Linux CI execute the direct-Wasm example and regenerate the evidence.

### Exact beta.31 boundary

Checked/validated in the artifact:

- real direct-Wasm execution;
- complete independent transition validation;
- semantic operation and recipe-scope reconstruction;
- unique scoped exact-effect sequence matching;
- beta.30 exact binding/rank/call-tree semantics;
- runtime-derived observed effects re-evaluated by Lean;
- caller-signature refinement of that observed list.

Explicit proof-free/trust boundaries remain:

- runtime capture;
- correctness/completeness of the independent JavaScript validator;
- **scoped-slice attribution** to one concrete invocation;
- production parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.31 is therefore not an end-to-end compiler/runtime refinement theorem.

## Beta.30 regression milestone

`PatchCallTree.lean` recursively checks exact nested `RangeExpr` bindings, strict outer/nested rank decrease, selected `GuardExpr`/static-repeat/direct-effect execution and edge-by-edge semantic-signature import.

`GeneratedTransitiveCallBodyCertificate.lean` remains runtime-independent beta.30 regression evidence. Beta.31 changes the transitive witness schema to **0.2** only to add expected recipe scope to each selected effect occurrence; the beta.30 effect trace itself remains unchanged.

## Reproducibility

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
```

Relevant formal modules:

```text
PatchCallBody.lean
PatchCallBodyImport.lean
PatchCallTree.lean
PatchCallRuntime.lean
```

Relevant generated evidence:

```text
GeneratedGuardedCallBodyCertificate.lean
GeneratedTransitiveCallBodyCertificate.lean
GeneratedTransitiveRuntimeCertificate.lean
```

## Current claim boundary

A defensible beta.31 artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature, policy, range and finite exact call-tree properties. For a conservative transitive recipe example, the production direct-Wasm module is executed, its complete transition stream is independently validated, one unambiguous scoped semantic-effect sequence is associated with a beta.30 call-tree witness, and Lean re-evaluates the runtime-derived observed effects against that exact call tree before deriving caller-signature refinement. Runtime capture, independent-validator correctness and scoped-slice attribution remain explicit proof-free evidence boundaries; the result is not a full compiler correctness theorem.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, transitive traces, runtime validation, effect refinement, translation validation, proof-carrying code, WebAssembly or GUI packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.31 is supporting assurance, not a firstness assertion.

## Remaining high-value gaps

- independent concrete invocation-frame reconstruction to disambiguate repeated identical calls;
- semantic-security/plugin case studies;
- validation/certificate/checker/backend overhead measurements;
- systematic related-work review and reproducibility bundle;
- controlled synchronization of these claims into `main.tex` before venue submission.

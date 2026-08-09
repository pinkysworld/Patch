# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.32 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance stack now includes:

1. semantic factorization, Change Signature Soundness, policy containment and integer range soundness;
2. independent source/guard translation validation;
3. conservative guard-aware direct-runtime validation;
4. finite ranked abstract recipe-call composition;
5. exact safe-integer binding and quantitative effect refinement;
6. beta.28/29 exact structured and guard-selected callee traces;
7. beta.30 finite transitive exact call-tree traces;
8. beta.31 first call-aware direct-Wasm bridge;
9. **Beta.32 invocation-frame-aware direct-Wasm correspondence, including repeated identical calls**.

None is described as complete compiler verification.

## Beta.32 invocation-frame milestone

The direct-Wasm backend remains unchanged and emits no trusted call-entry/exit events. The independent Change-IR validator validates the complete target/before/after transition stream and reconstructs semantic operation identity, recipe scope and concrete invocation frames.

Each reconstructed frame records caller/callee identity, dynamic invocation ordinal, parent/depth information, exact arguments/bindings and transition boundaries. Every validated effect carries the active frame stack.

For each beta.30 exact call-tree witness, beta.32 selects observed effects by concrete frame identity and verifies that the frame's exact parameter binding equals the beta.30 expected callee binding.

The generated Lean certificate checks:

```text
runtimeFrameBindings = beta30ExactBindings
```

and then:

```text
evalCallTreeStmtEqBool beta30ExactBindings exactTree frameSelectedObservedEffects = true
```

before reusing `checkedObservedTransitiveRuntimeRefinesCallerSignature` to derive caller-signature refinement.

The repeated regression source is:

```text
examples/formal-transitive-calls-repeated.patch
```

and contains two identical `do caller(1)` calls. They receive distinct independently reconstructed frames and separate certifiable runtime observations.

Generated runtime evidence:

```text
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

### Exact beta.32 boundary

Checked/validated in the artifact:

- real direct-Wasm execution;
- complete independent transition validation;
- semantic operation and recipe-scope reconstruction;
- concrete invocation-frame reconstruction and exact parameter bindings;
- repeated identical calls distinguished by dynamic frame identity;
- beta.30 exact binding/rank/call-tree semantics;
- frame binding equality checked in Lean;
- frame-selected observed effects re-evaluated by Lean;
- caller-signature refinement of accepted observed lists.

Explicit proof-free/trust boundaries remain:

- runtime capture;
- correctness/completeness of the independent JavaScript validator and invocation-frame reconstruction;
- production parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.32 is therefore not an end-to-end compiler/runtime refinement theorem.

## Beta.30 regression milestone

`PatchCallTree.lean` recursively checks exact nested `RangeExpr` bindings, strict outer/nested rank decrease, selected `GuardExpr`/static-repeat/direct-effect execution and edge-by-edge semantic-signature import.

`GeneratedTransitiveCallBodyCertificate.lean` remains runtime-independent beta.30 regression evidence.

## Reproducibility

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
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
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

## Current claim boundary

A defensible beta.32 artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature, policy, range and finite exact call-tree properties. For conservative transitive recipe examples, the production direct-Wasm module is executed and its complete transition stream is independently validated. The independent execution model reconstructs concrete invocation frames without backend call markers, including repeated identical calls. Generated evidence checks each runtime-frame binding against the beta.30 exact callee binding, and Lean re-evaluates the frame-selected observed effects against that exact call tree before deriving caller-signature refinement. Runtime capture and independent-validator/frame-reconstruction correctness remain explicit proof-free evidence boundaries; the result is not a full compiler correctness theorem.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, invocation frames, transitive traces, runtime validation, effect refinement, translation validation, proof-carrying code, WebAssembly or GUI packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.32 is supporting assurance, not a firstness assertion.

## Remaining high-value gaps

- semantic-security/plugin case studies;
- validation/certificate/checker/backend overhead measurements;
- systematic related-work review and reproducibility bundle;
- controlled synchronization of these claims into `main.tex` before venue submission;
- further reduction of parser/lowering/runtime trust boundaries without overstating full verification.

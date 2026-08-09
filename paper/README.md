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
9. **Beta.32 invocation-frame-aware direct-Wasm correspondence, including repeated identical calls**;
10. a **reproducible assurance-overhead/scaling evaluation harness** with controlled raw-data output.

None is described as complete compiler verification, and the evaluation harness is not itself an empirical result.

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

The repeated regression source is `examples/formal-transitive-calls-repeated.patch` and contains two identical `do caller(1)` calls. They receive distinct independently reconstructed frames and separate certifiable runtime observations.

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

Explicit proof-free/trust boundaries remain runtime capture, correctness/completeness of the independent JavaScript validator and invocation-frame reconstruction, production parser/extractor correctness, JavaScript-to-Wasm lowering correctness and Wasm-engine correctness.

Beta.32 is therefore not an end-to-end compiler/runtime refinement theorem.

## Assurance overhead evaluation harness

`src/evaluation-corpus.js`, `scripts/benchmark-assurance.js` and `docs/EVALUATION.md` define a deterministic evaluation methodology rather than hard-coded performance claims.

The corpus separates:

- **nested call depth** at fixed concrete invocation count;
- **concrete invocation count** at fixed call depth;
- combined depth/invocation scenarios.

The benchmark records raw timing samples plus min/median/mean/p95/max for:

```text
production direct-Wasm compilation
precompiled direct-Wasm execution
independent transition/effect/invocation-frame validation
end-to-end beta.32 runtime correspondence
beta.30+32 Lean-source certificate generation
```

It also records source/Wasm/certificate size, transition/effect/frame/correspondence counts and the CPU/OS/Node/V8 environment manifest.

A manual-only **Patch Assurance Evaluation** workflow records separate pinned-Lean certificate-checking wall time and memory. It is deliberately not an ordinary PR workflow, both to avoid notification noise and because hosted-runner timings should be treated as reproducibility evidence rather than stable microbenchmark results.

### Empirical-claim rule

**No overhead, scalability or asymptotic claim is made yet.** The next step is to collect controlled paper-quality measurements on fixed hardware, preserve raw JSON/CSV, characterize variance and only then synchronize measured results into `main.tex`.

## Reproducibility

Core assurance:

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

Evaluation:

```bash
npm run evaluate:assurance -- --preset paper --iterations 10 --warmup 3 \
  --out evaluation/results/assurance.json \
  --csv evaluation/results/assurance.csv
```

Relevant formal modules:

```text
PatchCallBody.lean
PatchCallBodyImport.lean
PatchCallTree.lean
PatchCallRuntime.lean
```

## Current claim boundary

A defensible beta.32 artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature, policy, range and finite exact call-tree properties. For conservative transitive recipe examples, the production direct-Wasm module is executed and its complete transition stream is independently validated. The independent execution model reconstructs concrete invocation frames without backend call markers, including repeated identical calls. Generated evidence checks each runtime-frame binding against the beta.30 exact callee binding, and Lean re-evaluates the frame-selected observed effects against that exact call tree before deriving caller-signature refinement. Runtime capture and independent-validator/frame-reconstruction correctness remain explicit proof-free evidence boundaries; the result is not a full compiler correctness theorem. The artifact additionally includes a reproducible overhead/scaling harness, but no empirical performance claim is made until controlled measurements are collected.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, invocation frames, transitive traces, runtime validation, effect refinement, translation validation, proof-carrying code, benchmarking, WebAssembly or GUI packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.32 and the evaluation harness are supporting assurance/evaluation infrastructure, not firstness assertions.

## Remaining high-value gaps

- semantic-security/plugin case studies;
- controlled validation/certificate/checker/backend overhead measurements using the completed harness;
- statistical analysis/plots from those measurements;
- systematic related-work review and reproducibility bundle;
- controlled synchronization of measured results and current claims into `main.tex` before venue submission;
- further reduction of parser/lowering/runtime trust boundaries without overstating full verification.

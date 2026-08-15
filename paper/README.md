# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The current product/research codebase is **Patch 0.2.0-beta.34 / Change IR 0.10**. The current formal runtime-correspondence milestone remains **beta.32**. Beta.33 and beta.34 add Studio/release engineering without widening the beta.32 formal claim. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance/evaluation stack now includes:

1. semantic factorization, Change Signature Soundness, policy containment and integer range soundness;
2. independent source/guard translation validation;
3. conservative guard-aware direct-runtime validation;
4. finite ranked abstract recipe-call composition;
5. exact safe-integer binding and quantitative effect refinement;
6. beta.28/29 exact structured and guard-selected callee traces;
7. beta.30 finite transitive exact call-tree traces;
8. beta.31 first call-aware direct-Wasm bridge;
9. **Beta.32 invocation-frame-aware direct-Wasm correspondence, including repeated identical calls**;
10. a reproducible assurance-overhead/scaling evaluation harness;
11. a **mechanized semantic-authority security ablation suite** using the real Patch compiler plus an explicitly internal coarse target-write baseline;
12. a larger checkout/loyalty extension case with a real safe direct-Wasm execution plus magnitude, direction and target escalation variants;
13. a **commit-bound reproducibility bundle** that packages the exact tracked source snapshot, regenerated formal/runtime evidence, semantic-authority case reports, environment provenance and per-file SHA-256 manifest.

None is described as complete compiler verification, complete sandboxing, or evidence that named prior systems cannot express comparable restrictions.

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

## Semantic-authority security ablation

`case-studies/security/` contains eight small extension-style programs evaluated by the **real Patch compiler and Change Capability analysis**. The same programs are also evaluated by an intentionally coarse internal baseline that asks only whether transitively reachable changed target paths appear in the recipe's `allow` block.

The baseline deliberately ignores semantic operation, magnitude and proof obligations. It is **not a model of any named effect system, capability language or related work**. It exists only to isolate the engineering value of Patch's semantic authority dimensions over target-only write authority.

The expected mechanized matrix is:

```text
3 cases  Patch accept / coarse target-write accept
4 cases  Patch reject / coarse target-write accept
1 case   Patch reject / coarse target-write reject
```

The four differential rejections are:

1. **magnitude escalation:** a `points` increase whose proven parameter range can reach 50 under `points may increase up to 10`;
2. **operation-direction escalation:** an increase of `balance` under an authority that permits only decrease;
3. **transitive magnitude escalation:** a helper call contributes an increase of 50 to an outer recipe limited to 10;
4. **fail-closed unknown magnitude:** an unbounded dynamic amount targets an allowed path but cannot be proved to stay within 10.

A separate target-escape control changes an undeclared target and is rejected by both Patch and the coarse baseline.

Reproduce the case suite with:

```bash
npm run evaluate:security -- \
  --out evaluation/security/report.json \
  --csv evaluation/security/report.csv \
  --markdown evaluation/security/table.md
```

`tests/security-case-studies.test.js` requires the exact case decisions, relevant diagnostics, transitive helper signature evidence, deterministic `SOURCE_DATE_EPOCH` handling, and JSON/CSV/Markdown report structure.

### Security-case claim boundary

The suite supports this narrow artifact statement:

> In these controlled extension-style examples, Patch distinguishes semantic operation, magnitude, transitive helper effects and missing bound evidence that a target-only write-authority ablation intentionally ignores.

It does **not** establish complete malicious-code containment, a general plugin sandbox, superiority over named prior systems, or novelty of quantitative/refinement effects and capabilities. A publication comparison against existing systems must come from systematic related work, not from this internal ablation.

## Checkout/loyalty extension case

`case-studies/checkout-extension/` provides a larger coherent application-level example instead of another isolated micro-case. The protected `checkout_extension` recipe composes discount and loyalty helpers over multiple state paths.

The safe source is executed through the real direct-Wasm backend and must finish at:

```text
balance = 80
points = 8
cashback = 0
```

The protected semantic signature must include the transitive balance-decrease and points-increase effects with their expected bounds. Three controlled variants then exercise reward-magnitude escalation, balance-direction escalation and an unauthorized cashback target. The first two are accepted by the intentionally coarse target-only ablation but rejected by Patch semantic authority; the target escape is rejected by both.

Reproduce the application report with:

```bash
npm run evaluate:checkout-extension -- \
  --out evaluation/checkout/report.json \
  --markdown evaluation/checkout/report.md
```

This is a realistic engineering/motivating case relative to the eight micro-cases, but it is still not a complete plugin sandbox or an empirical claim about an external extension ecosystem.

## Assurance overhead evaluation harness

`src/evaluation-corpus.js`, `scripts/benchmark-assurance.js` and `docs/EVALUATION.md` define a deterministic evaluation methodology rather than hard-coded performance claims.

The corpus separates nested call depth, concrete invocation count, and combined depth/invocation scenarios. The benchmark records raw timing samples plus min/median/mean/p95/max for direct-Wasm compilation, precompiled execution, independent validation, end-to-end beta.32 correspondence and beta.30+32 Lean-source certificate generation.

It also records source/Wasm/certificate size, transition/effect/frame/correspondence counts and the CPU/OS/Node/V8 environment manifest.

A manual-only **Patch Assurance Evaluation** workflow records separate pinned-Lean certificate-checking wall time and memory. Hosted-runner timings are treated as reproducibility evidence rather than stable microbenchmark results.

### Empirical-claim rule

**No overhead, scalability or asymptotic claim is made yet.** Controlled paper-quality measurements on fixed hardware must be collected and analyzed before measured results are synchronized into `main.tex`.

## Commit-bound reproducibility bundle

`docs/REPRODUCIBILITY_BUNDLE.md` and `.github/workflows/reproducibility-bundle.yml` define the review artifact packaging path.

For the exact checked-out commit, the workflow:

1. resolves the Patch version, 40-character commit id and commit timestamp;
2. regenerates the finite transitive call-tree certificate;
3. executes direct Wasm and regenerates the transitive runtime certificate;
4. regenerates repeated-call invocation-frame evidence;
5. regenerates the eight-case semantic-authority report and checkout-extension report with `SOURCE_DATE_EPOCH` fixed to the commit timestamp;
6. snapshots all Git-tracked source plus those explicit generated reports;
7. records size and SHA-256 for every copied source/evidence file in `BUNDLE-MANIFEST.json`;
8. verifies every bundled file plus the expected Patch version and source commit;
9. creates a sorted commit-time tar/gzip envelope with numeric owner/group and `gzip -n`;
10. uploads the archive and its SHA-256 as a 90-day Actions artifact.

The bundle supports artifact identity and evidence reruns. It intentionally does **not** execute the paper benchmark or convert variable hosted-runner timings into manuscript results.

## Reproducibility

Core assurance:

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

Evaluation/evidence:

```bash
npm run evaluate:assurance -- --preset paper --iterations 10 --warmup 3 \
  --out evaluation/results/assurance.json \
  --csv evaluation/results/assurance.csv

npm run evaluate:security -- \
  --out evaluation/security/report.json \
  --csv evaluation/security/report.csv \
  --markdown evaluation/security/table.md

npm run evaluate:checkout-extension -- \
  --out evaluation/checkout/report.json \
  --markdown evaluation/checkout/report.md
```

Commit-bound artifact:

```bash
npm run bundle:reproducibility
npm run verify:reproducibility
```

For the full generated-evidence bundle, follow `docs/REPRODUCIBILITY_BUNDLE.md` or run the **Patch Reproducibility Bundle** workflow.

Relevant formal modules:

```text
PatchCallBody.lean
PatchCallBodyImport.lean
PatchCallTree.lean
PatchCallRuntime.lean
```

## Current claim boundary

A defensible current artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature, policy, range and finite exact call-tree properties. For conservative transitive recipe examples, the production direct-Wasm module is executed and its complete transition stream is independently validated. The independent execution model reconstructs concrete invocation frames without backend call markers, including repeated identical calls. Generated evidence checks each runtime-frame binding against the beta.30 exact callee binding, and Lean re-evaluates the frame-selected observed effects against that exact call tree before deriving caller-signature refinement. The artifact also includes a controlled semantic-authority ablation and a larger checkout/loyalty extension case. A commit-bound bundle identifies and hashes the exact source/evidence snapshot used for review. These results do not establish full compiler correctness, complete sandboxing, reproducible performance numbers across machines or superiority over named prior systems.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, invocation frames, transitive traces, runtime validation, quantitative/refinement effects, capabilities, proof-carrying code, benchmarking, reproducibility packaging, WebAssembly or GUI packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.32, the evaluation harness, security ablation, checkout case and reproducibility bundle are supporting assurance/evaluation infrastructure, not standalone firstness assertions.

## Remaining high-value gaps

- controlled validation/certificate/checker/backend overhead measurements using the completed harness;
- systematic related-work review and literature-grounded comparison dimensions;
- controlled synchronization of measured results and current claims into `main.tex` before venue submission;
- further reduction of parser/lowering/runtime trust boundaries without overstating full verification;
- additional externally motivated application/extension cases if venue feedback indicates the current checkout case is not sufficient.

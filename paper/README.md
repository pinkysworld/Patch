# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current manuscript status

The manuscript is now synchronized to the current research/product split:

- product artifact: **Patch 0.2.0-beta.34**;
- semantic IR: **Change IR 0.10**;
- formal runtime-correspondence milestone: **beta.32**;
- beta.33/beta.34: Studio, release, persistence and runtime-integrity engineering that does not widen the beta.32 Lean claim.

`main.tex` now includes the implemented beta.30 finite transitive call-tree layer, beta.31 call-aware direct-Wasm bridge, beta.32 independently reconstructed invocation frames, semantic-authority evaluation, checkout/loyalty case, controlled-measurement protocol, reproducibility bundle and the narrowed related-work claim boundary.

The paper remains a working research manuscript, not yet a submission-ready top-venue paper. In particular, **no controlled paper-quality performance dataset has been collected yet**.

## Candidate contribution

The current contribution hypothesis is intentionally narrow:

> Patch factors ordinary post-creation persistent mutation through a structured semantic Change, and derives operation- and magnitude-aware summaries and authority from that same mandatory mutation substrate.

This is not a unique-expressibility or firstness claim. Related systems provide first-class state change, rich effects, capabilities, quantitative grades, permissions and more general state specifications. See `docs/RELATED_WORK.md`, `docs/NOVELTY.md` and `related-work.tex`.

## Assurance stack represented in the manuscript

1. State-Change Factorization and Mutation Transparency;
2. Change Signature and Change Capability soundness for explicit semantic fragments;
3. integer `RangeExpr` soundness;
4. independent source/range and guard translation validation;
5. finite ranked abstract call composition;
6. exact safe-integer call binding and quantitative effect refinement;
7. beta.28/29 structured and guard-selected exact callee traces;
8. beta.30 finite transitive exact call-tree refinement;
9. beta.31 production direct-Wasm execution connected to independently validated semantic observations;
10. beta.32 independently reconstructed invocation frames, including repeated identical calls;
11. generated Lean evidence checking runtime-frame bindings against beta.30 exact bindings and re-evaluating frame-selected observed effects;
12. semantic-authority micro-case ablation and checkout/loyalty engineering case;
13. process-isolated controlled-measurement protocol;
14. commit-bound reproducibility bundle.

## Beta.32 runtime boundary

The production direct-Wasm backend does not need to emit trusted call-entry/exit markers. The independent validator reconstructs concrete invocation frames from validated execution structure. Each frame carries caller/callee identity, dynamic ordinal, parent/depth information, exact arguments/bindings and transition boundaries.

For a selected beta.30 exact call-tree witness, generated evidence checks:

```text
runtimeFrameBindings = beta30ExactBindings
```

and then lets Lean re-evaluate the frame-selected observed effects through the exact call-tree semantics before applying:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

The repeated-call regression source is:

```text
examples/formal-transitive-calls-repeated.patch
```

Generated runtime certificates include:

```text
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

This is **not** an end-to-end compiler/runtime refinement theorem. Explicit proof-free/trust boundaries remain runtime capture, JavaScript validator/frame-reconstruction correctness, parser/extractor correctness, JavaScript-to-Wasm lowering and the Wasm engine.

## Semantic-authority evaluation

The eight micro-cases use the real Patch compiler/Change Capability analysis plus an intentionally coarse internal target-only write-authority ablation.

Expected mechanized matrix:

```text
3  Patch accept / coarse accept
4  Patch reject / coarse accept
1  Patch reject / coarse reject
```

The four differential rejections cover magnitude escalation, operation-direction escalation, transitive helper magnitude escalation and fail-closed unknown magnitude. The shared rejection is a target escape.

The coarse baseline is an internal ablation, not a model of a named effect or capability system.

Reproduce:

```bash
npm run evaluate:security -- \
  --out evaluation/security/report.json \
  --csv evaluation/security/report.csv \
  --markdown evaluation/security/table.md
```

## Checkout/loyalty extension case

The safe checkout extension executes through direct Wasm and must finish at:

```text
balance = 80
points = 8
cashback = 0
```

Controlled variants exercise reward-magnitude escalation, balance-direction escalation and unauthorized cashback state.

Reproduce:

```bash
npm run evaluate:checkout-extension -- \
  --out evaluation/checkout/report.json \
  --markdown evaluation/checkout/report.md
```

This is a larger motivating/engineering case, not a complete plugin sandbox or an empirical study of an external extension ecosystem.

## Controlled performance protocol

The phase harness and process-isolated controller are documented in:

```text
docs/EVALUATION.md
docs/CONTROLLED_EVALUATION.md
```

A paper-candidate run uses fresh Node processes and preserves every raw report. The controller checks source commit, working-tree state, scenario/source/artifact identity and normalized machine/runtime identity before aggregation. It records Q1, median, Q3, p95, mean, MAD and IQR across process medians and hashes the complete dataset.

Example controlled command:

```bash
npm run evaluate:assurance:controlled -- \
  --preset paper \
  --runs 10 \
  --iterations 10 \
  --warmup 3 \
  --machine-id patch-lab-01 \
  --label 2026-08-paper-baseline \
  --out-dir evaluation/results/controlled
```

GitHub-hosted timing is explicitly labelled `hosted-ci` and cannot be relabelled `controlled` by the runner.

### Empirical claim boundary

No overhead, scalability or asymptotic claim belongs in `main.tex` until an actual fixed-machine controlled dataset has been collected, reviewed and analyzed. The manuscript currently states this explicitly.

## Reproducibility bundle

The `Patch Reproducibility Bundle` workflow binds source/evidence to an exact Patch version and Git commit, regenerates the formal/runtime/security/checkout evidence, hashes every bundled source/evidence file and creates a deterministic archive envelope.

Reproduce locally:

```bash
npm run bundle:reproducibility
npm run verify:reproducibility
```

The bundle deliberately excludes manuscript performance results from heterogeneous hosted runners.

## Related work

`paper/related-work.tex` is now included by `main.tex` and cites the expanded `references.bib`.

The structured comparison covers:

- Plaid and first-class state change;
- Worlds/reified state;
- classical, algebraic and sequential effects;
- Effects-as-Capabilities/System C;
- graded quantitative reasoning;
- borrowing permissions and Mezzo;
- HTT, F* and Dijkstra monads;
- explicit program edits/change calculi/patch theory;
- translation validation, PCC and provenance debugging.

The key discipline is to separate **expressibility** from **default mutation architecture**. Patch does not claim that richer systems cannot state an equivalent bounded transition.

## Reproducibility commands

Core assurance:

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

Evidence:

```bash
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:assurance:isolated
```

Commit-bound artifact:

```bash
npm run bundle:reproducibility
npm run verify:reproducibility
```

## Remaining high-value gaps

1. collect the fixed-machine controlled overhead/scaling dataset;
2. analyze that dataset with explicit models, dispersion and plots, then synchronize measured results into `main.tex`;
3. broaden the externally motivated application/extension corpus;
4. continue recent dependent/graded-effect review for any closer architectural match;
5. reduce parser/lowering/runtime trust boundaries where the improvement materially strengthens the central claim;
6. obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful.

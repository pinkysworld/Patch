# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current manuscript status

The manuscript is synchronized to the current research/product split:

- product artifact: **Patch 0.2.0-beta.34**;
- semantic IR: **Change IR 0.10**;
- formal runtime-correspondence milestone: **beta.32**;
- beta.33/beta.34: Studio, release, persistence and runtime-integrity engineering that does not widen the beta.32 Lean claim.

`main.tex` includes the implemented beta.30 finite transitive call-tree layer, beta.31 call-aware direct-Wasm bridge, beta.32 independently reconstructed invocation frames, repeated-identical and mixed-guard repeated-call evidence, semantic-authority evaluation, the checkout/loyalty and usage/quota application cases, controlled-measurement protocol, reproducibility bundle and the narrowed related-work claim boundary.

The paper remains a working research manuscript, not yet a submission-ready top-venue paper. In particular, **no controlled paper-quality performance dataset has been collected yet**.

## Candidate contribution

The current contribution hypothesis is intentionally narrow:

> Patch factors ordinary post-creation persistent mutation through a structured semantic Change, and derives operation- and magnitude-aware summaries and authority from that same mandatory mutation substrate.

This is not a unique-expressibility or firstness claim. Related systems provide first-class state change, rich and value-dependent effects, capabilities, quantitative grades, permissions, typestate mechanisms and more general state specifications. See `docs/RELATED_WORK.md`, `docs/NOVELTY.md` and `related-work.tex`.

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
10. beta.32 independently reconstructed invocation frames, including repeated identical calls and mixed concrete guard paths between repeated identities;
11. generated Lean evidence checking runtime-frame bindings against beta.30 exact bindings and re-evaluating frame-selected observed effects;
12. semantic-authority micro-case ablation plus checkout/loyalty and usage/quota engineering cases;
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

The repeated-identical-call regression source is:

```text
examples/formal-transitive-calls-repeated.patch
```

The stronger mixed-guard regression source is:

```text
examples/formal-transitive-calls-mixed-guards.patch
```

It executes `caller(1)`, `caller(4)`, `caller(1)` through `caller -> outer -> middle -> leaf`. The first and third calls are identical, while the middle call takes the opposite guard branch. The verified artifact reconstructs 12 dynamic frames, supports six transitive runtime correspondences with maximum certified nested depth 2, and preserves the three `caller -> outer` effect traces as `coins +4`, `score +5`, `coins +4`.

Generated runtime certificates include:

```text
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
GeneratedMixedGuardTransitiveRuntimeCertificate.lean
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

## Multi-domain application corpus

### Checkout/loyalty

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

### Usage/quota

The second application case uses a different domain and persistent state paths. Its safe execution must finish at:

```text
used = 35
remaining = 85
bonus = 5
admin_credit = 0
```

Its protected entry signature carries bounded usage increase, remaining-quota decrease and bonus increase. Controlled variants exercise magnitude escalation, operation-direction reversal and unauthorized `admin_credit` state under the same internal target-only ablation.

Reproduce:

```bash
npm run evaluate:quota-extension -- \
  --out evaluation/quota/report.json \
  --markdown evaluation/quota/report.md
```

Together these form a two-domain artifact corpus. They are larger motivating/engineering cases, not real third-party plugin integration, a complete plugin sandbox, or an empirical study of an external extension ecosystem.

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

The `Patch Reproducibility Bundle` workflow binds source/evidence to an exact Patch version and Git commit, regenerates the formal/runtime/security/checkout/quota evidence, hashes every bundled source/evidence file and creates a deterministic archive envelope. The formal evidence includes the single-call, repeated-identical-call and mixed-guard invocation-frame certificates.

Reproduce locally:

```bash
npm run transitive-runtime-certify:mixed-guards
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
- 2026 dependent effects with program-value-dependent quantitative grades;
- borrowing permissions and Mezzo;
- 2026 revocable-capability typestate;
- 2025 invalidation-sensitive type-and-effect analysis;
- HTT, F* and Dijkstra monads;
- explicit program edits/change calculi/patch theory;
- translation validation, PCC and provenance debugging.

The targeted 2025–2026 follow-up further narrows the Patch hypothesis. Value-dependent quantitative effects and flow-sensitive state/capability reasoning are explicit prior art. The remaining candidate distinction is the mandatory/default modeled persistent-mutation architecture, not the individual existence of magnitude bounds, capabilities or typestate-sensitive effects.

The key discipline is to separate **expressibility** from **default mutation architecture**. Patch does not claim that richer systems cannot state an equivalent bounded transition.

## Reproducibility commands

Core assurance:

```bash
npm test
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
npm run transitive-runtime-certify:mixed-guards
```

Evidence:

```bash
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
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
3. validate Patch in a genuinely external or third-party extension/integration setting rather than another internally authored artifact case;
4. reduce parser/lowering/runtime trust boundaries where the improvement materially strengthens the central claim;
5. obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful.

Normal literature surveillance should continue before submission, but the targeted 2025–2026 dependent/state-sensitive effect follow-up for this paper iteration is complete. Richer mixed-guard repeated-call invocation-frame evidence is now part of the reproducible beta.32 artifact rather than an open backlog item.

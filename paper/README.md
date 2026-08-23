# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current manuscript status

The manuscript is synchronized to the current research/product split:

- product artifact: **Patch 0.2.0-beta.35**;
- semantic IR: **Change IR 0.10**;
- formal runtime-correspondence milestone: **beta.32**;
- current native product contract: **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**;
- frozen TreeView compatibility contract: **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3**;
- beta.33-beta.35+ product engineering does not widen the beta.32 Lean claim.

`main.tex` includes the implemented beta.30 finite transitive call-tree layer, beta.31 call-aware direct-Wasm bridge, beta.32 independently reconstructed invocation frames, repeated-identical and mixed-guard repeated-call evidence, semantic-authority evaluation, the checkout/loyalty and usage/quota application cases, controlled-measurement protocol, reproducibility bundle and the narrowed related-work claim boundary.

The artifact also independently binds supported static `do recipe(args)` source sites to production AST call sites before concrete-call witness generation. This reduces a parser/extractor trust dependency but does not widen the Lean theorem or turn the parser into a verified component.

Beta.35+ product work now includes the canonical multi-file Studio project bundle v3, list-backed multi-select ListBox parity, hierarchical TreeView and Slider across browser and supported Windows/macOS/Linux direct-native and token-free Ready/offline paths. Current token-free desktop Window packaging uses Native GUI IR 1.3, sealed payload v13 and runtime v1.4. The previous Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line remains frozen compatibility evidence. These GUI/runtime additions remain outside the beta.32 formal runtime-correspondence claim.

The paper remains a working research manuscript, not yet a submission-ready top-venue paper. In particular, **no controlled paper-quality performance dataset has been collected yet**.

## Candidate contribution

The current contribution hypothesis is intentionally narrow:

> Patch factors ordinary post-creation persistent mutation through a structured semantic Change, and derives operation- and magnitude-aware summaries and authority from that same mandatory mutation substrate.

This is not a unique-expressibility or firstness claim. Related systems provide first-class state change, rich and value-dependent effects, capabilities, quantitative grades, permissions, typestate mechanisms and more general state specifications. See `docs/RELATED_WORK.md`, `docs/NOVELTY.md` and `related-work.tex`.

## Assurance stack represented in the manuscript

1. State-Change Factorization and Mutation Transparency;
2. Change Signature and Change Capability soundness for explicit semantic fragments;
3. integer `RangeExpr` soundness;
4. independent source/range, guard and raw static call-site translation/source-identity validation;
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

## Static call-site source binding

Concrete call certificates do not accept the production AST as the sole source of truth for the identity of supported static `do recipe(args)` sites. `src/call-site-validation.js` independently scans raw source and reconstructs caller recipe context, callee name, source line and exact trimmed argument texts. The complete ordered raw-source list must agree with a separately collected production-AST list.

The validation artifact is attached to `formalCalls`, so concrete-call, structured-call, transitive-call and beta.32 runtime witness paths inherit the same fail-closed precondition. The Concrete Call Witness schema remains **0.1** because the call-site validation version and successful-source-binding flag are additive provenance metadata.

This check is syntactic, not semantic. After source identity is established, Lean still re-evaluates supported argument expressions and checks exact values, positional binding, declared ranges, call structure and later effect obligations. The independent scanner remains proof-free JavaScript and is not a verified parser. See `docs/CALL_SITE_VALIDATION.md`.

## Beta.32 runtime boundary

The production direct-Wasm backend does not emit trusted call-entry/exit markers. The independent validator reconstructs concrete invocation frames from validated execution structure. Each frame carries caller/callee identity, dynamic ordinal, parent/depth information, exact arguments/bindings and transition boundaries.

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

This is **not** an end-to-end compiler/runtime refinement theorem. Explicit proof-free/trust boundaries remain runtime capture, JavaScript validator/frame-reconstruction correctness, parser/extractor correctness outside independently cross-checked supported source/range, guard and static-call-site fragments, JavaScript-to-Wasm lowering and the Wasm engine. The independent validators themselves remain unverified JavaScript.

## Product boundary relative to the paper

The beta.35+ product artifact has moved ahead of the formal runtime-correspondence milestone in UI and distribution engineering. Current product features include:

- Patch Studio multi-file project bundle v3;
- browser App Preview and Standalone Web support for list-backed multi-select ListBox, TreeView and Slider;
- Native GUI IR 1.3 with hierarchical TreeView and Slider;
- sealed payload v13 / runtime v1.4 for current token-free Ready/offline Windows, macOS and Linux Window applications;
- frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView compatibility evidence;
- preserved Table/Grid, responsive layout, list-state and Menu semantics from the frozen earlier native contracts;
- SHA-256-verified browser runtime templates and a separately checksummed offline compiler distribution.

These product features are implementation evidence and usability/distribution work. They do not imply a new Lean theorem, a fully verified compiler, native GUI semantic verification, Authenticode signing or Developer ID notarization.

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

The `Patch Reproducibility Bundle` workflow binds source/evidence to an exact Patch version and Git commit, regenerates the formal/runtime/security/checkout/quota evidence, hashes every bundled source/evidence file and creates a deterministic archive envelope. The formal evidence includes the single-call, repeated-identical-call and mixed-guard invocation-frame certificates. The tracked source snapshot also contains the call-site validation implementation, tests and documentation that gate concrete call-witness generation.

Reproduce locally:

```bash
npm run transitive-runtime-certify:mixed-guards
npm run bundle:reproducibility
npm run verify:reproducibility
```

The bundle deliberately excludes manuscript performance results from heterogeneous hosted runners.

## Related work

`paper/related-work.tex` is included by `main.tex` and cites the expanded `references.bib`.

The structured comparison covers first-class state change, reified state, classical/algebraic/sequential effects, Effects-as-Capabilities/System C, graded quantitative reasoning, dependent effects, borrowing permissions, Mezzo, revocable-capability typestate, invalidation-sensitive type-and-effect analysis, HTT, F*, Dijkstra monads, explicit program edits/change calculi/patch theory, translation validation, PCC and provenance debugging.

The targeted 2025-2026 follow-up narrows the Patch hypothesis. Value-dependent quantitative effects and flow-sensitive state/capability reasoning are explicit prior art. The remaining candidate distinction is the mandatory/default modeled persistent-mutation architecture, not the individual existence of magnitude bounds, capabilities or typestate-sensitive effects.

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
4. continue reducing parser/lowering/runtime trust where the improvement materially strengthens the claim, with source/range, guard and static call-site identity already independently cross-checked for their supported fragments;
5. obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful.

Normal literature surveillance should continue before submission, but the targeted recent dependent/state-sensitive effect follow-up for this paper iteration is complete. Richer mixed-guard repeated-call invocation-frame evidence is part of the reproducible beta.32 artifact rather than an open backlog item.

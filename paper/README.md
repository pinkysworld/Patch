# Patch research paper

Working title:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Target and status

The current journal-oriented manuscript is being prepared for the **Research Papers / Experimental Software Technology** scope of *Science of Computer Programming* (SCP). The journal explicitly covers the design, implementation and evaluation of programming languages, programming environments and development tools, formal techniques, and experiments with novel programming languages and systems.

The paper is intentionally organized as a complete formal-and-artifact contribution without relying on uncollected performance numbers. A controlled fixed-machine performance dataset can strengthen a later revision, but it is not presented as an existing result.

The primary contribution hypothesis is:

> Patch factors ordinary post-creation persistent mutation through a structured semantic Change and derives operation- and magnitude-aware summaries and authority from that same mandatory mutation substrate.

This is an architectural claim, not a unique-expressibility or firstness claim. Related systems provide first-class state change, rich effects, capabilities, quantitative/dependent effects, permissions, typestate mechanisms, and more general state specifications.

## Research questions represented in `main.tex`

1. **Factorization:** can modeled persistent mutation use a single semantic Change route rather than a parallel assignment escape hatch?
2. **Authority:** can operation- and magnitude-aware authority derived from Changes reject behaviors that target-only write authority cannot distinguish?
3. **Assurance:** which properties of the Change model, signatures, capabilities, ranges, and finite interprocedural calls can be machine checked?
4. **Runtime correspondence:** how far can production direct-WebAssembly execution be connected to those formal fragments while keeping the remaining trust boundary explicit?

## Evidence in the current paper

The manuscript includes:

- State-Change Factorization and Mutation Transparency;
- Semantic Change Signature and Change Capability soundness for explicit fragments;
- integer `RangeExpr` soundness;
- independent source/range, guard and static-call-site validation for supported fragments;
- finite ranked call composition, exact binding, guarded traces and finite transitive call-tree refinement;
- direct-WebAssembly runtime correspondence using independently reconstructed invocation frames;
- repeated-identical-call and mixed-guard runtime evidence;
- an eight-case semantic-authority ablation;
- checkout/loyalty and usage/quota application cases;
- an explicit trust-boundary table and threats-to-validity section;
- a commit-bound reproducibility bundle.

The eight-case authority matrix is:

```text
3  Patch accept / coarse target-only accept
4  Patch reject / coarse target-only accept
1  Patch reject / coarse target-only reject
```

The four differential rejections isolate magnitude escalation, operation-direction escalation, transitive helper magnitude escalation, and fail-closed unknown magnitude. The shared rejection is a target escape. The coarse comparison is deliberately an internal ablation, not a stand-in for a named effect or capability system.

The safe checkout/loyalty application executes through direct Wasm and ends at:

```text
balance = 80
points = 8
cashback = 0
```

The safe usage/quota application ends at:

```text
used = 35
remaining = 85
bonus = 5
admin_credit = 0
```

## Claim boundary

The manuscript does **not** claim:

- a fully verified compiler;
- proof of runtime-capture or JavaScript-validator completeness;
- full parser or lowering verification;
- complete plugin sandboxing or foreign-code confinement;
- third-party ecosystem evidence;
- unique expressibility of bounded transitions;
- controlled performance, scaling or asymptotic results.

The formal/runtime claim remains limited to the explicitly encoded fragments. GUI, Things, native Window runtimes and foreign code remain outside that theorem unless they reduce to a supported semantic Change path.

## Performance methodology

The repository contains a process-isolated fixed-machine measurement protocol in:

```text
docs/EVALUATION.md
docs/CONTROLLED_EVALUATION.md
```

It is retained as reproducible methodology and potential revision evidence. Hosted-CI timing must not be presented as controlled paper performance data.

## Reproduction

Core checks:

```bash
npm test
npm run transitive-runtime-certify:mixed-guards
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
npm run bundle:reproducibility
npm run verify:reproducibility
```

## Pre-submission work still worth doing

The manuscript can stand on its current formal and semantic-authority results, but the strongest remaining improvements are:

1. run a final literature update immediately before submission;
2. add a genuinely external/third-party integration case if feasible;
3. collect controlled fixed-machine assurance-cost data if performance cost is to become a paper claim;
4. perform an independent reviewer-style pass focused on whether the architectural distinction is sufficiently useful, not merely different;
5. compile the final journal source with the exact template/metadata requirements used by the submission system.

Submission-oriented notes are maintained in `paper/SCP_SUBMISSION.md`.

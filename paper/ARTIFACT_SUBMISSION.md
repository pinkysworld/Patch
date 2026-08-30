# Patch Paper 1 artifact submission record

This file binds the journal manuscript to the reproducible Patch artifact and provides a starting point for artifact-evaluation material.

## Artifact

Repository: https://github.com/pinkysworld/Patch

Submission branch: `paper/research-framing-20260830`

Artifact snapshot commit: `TO_BE_REPLACED_WITH_FINAL_SOURCE_COMMIT`

## What the artifact supports

1. **Formal claims**
   - Lean models and proofs for Change Signature / Capability soundness.
   - Integer range soundness for the stated expression fragment.
   - Finite exact call-tree refinement for the stated finite-call fragment.

2. **Production-correspondence evidence**
   - Direct-WebAssembly execution for the selected correspondence case.
   - Independent reconstruction/validation of transitions, semantic effects, guards, call sites, and invocation frames.

3. **Controlled evaluation**
   - Eight-case target-only information ablation.
   - Checkout/loyalty application case.
   - Usage/quota application case.

4. **Public-code stress test**
   - Frozen 15-site corpus with exact project commits, paths, textual anchors, classification rubric, and rationale.

## Quick reproduction

```text
npm test
node scripts/report-formal-scope.js
npm run transitive-runtime-certify:mixed-guards
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
npm run bundle:reproducibility
```

## Claim boundary

The artifact does not establish full source-to-core compiler correctness, a fully verified runtime, third-party Patch execution, ecosystem prevalence, or performance/scalability results. The public-code corpus is an illustrative stress test rather than a repository-mining study.

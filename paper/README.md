# Patch journal manuscript

The current Science of Computer Programming manuscript is built from `paper/journal.tex`, which composes the stable `main.tex` core with the Round-6 public real-code mutation audit. It uses Elsevier `elsarticle` formatting and is developed as a **journal submission only; no conference submission is planned**.

## Current scientific framing

The paper is centered on a deliberately narrow architectural claim:

> Patch makes structured semantic Change the mandatory modeled route for post-creation application-state mutation and connects that semantic mutation lineage to operation- and magnitude-aware contracts, provenance, history, and scoped assurance.

`Application state` means Patch state retained across statements/events during execution; it does not imply durable storage across process restarts. `Same substrate` / `same lineage` means a shared mandatory semantic mutation route/vocabulary with distinct compile-time/runtime representations derived from it, not one literal object shared unchanged by every phase.

## Evidence currently in the manuscript

- State-Change Factorization as a by-construction machine-checked design invariant;
- Mutation Transparency;
- a direct Lean Change-to-contract bridge for supported singleton numeric Changes;
- proof that a bounded allowed Change effect constrains the actual committed before/after magnitude;
- fail-closed bounded unknown magnitude in the relational semantics;
- executable/relational policy equivalence (`allowsBool_iff`, `policyAllowsBool_iff`) for the modeled Effect/Rule fragment;
- normalized signature/capability and integer-range results for explicit fragments;
- finite ranked and transitive exact call-tree reasoning tied to semantic-authority propagation;
- accepted-evidence runtime-frame correspondence for selected direct-WebAssembly executions;
- repeated-identical and mixed-guard invocation-frame evidence;
- an explicitly defined eight-case target-only mechanism-isolation ablation;
- checkout/loyalty and usage/quota multi-state application cases;
- an exploratory public real-code mutation audit with 18 retained-state observations from six commit-pinned independently authored projects;
- artifact-level semantic-lineage reuse across compiler analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility tooling.

The public audit is intentionally mixed evidence: 5 observations are coded as direct local current-surface fits, 11 require adapters, 2 require source restructuring, and 3 have the same narrow singleton numeric directional shape as the present Lean bridge. Only 7 of 18 audited contexts are standalone. These counts describe the purposive corpus only; they are not ecosystem prevalence or migration-effort estimates and the external programs are not Lean-certified.

The manuscript does **not** claim end-to-end compiler verification, complete sandboxing, production source-to-effect verification, representative ecosystem validation, a controlled performance result, a usability result, atomic multi-target Change, or superiority over modern effect/capability systems.

## Review status

Four earlier internal reviewer-perspective rounds are documented in `INTERNAL_REVIEW.md`. Round 5 is documented in `INTERNAL_REVIEW_ROUND5.md` and `INTERNAL_REVIEW_ROUND5_RESPONSE.md`. Round 6 is documented in `INTERNAL_REVIEW_ROUND6.md` and focuses on empirical-transfer validity, source provenance, strict direct-fit coding, and claim discipline. An author-supplied Claude Opus referee-style AI review and its disposition are documented in `EXTERNAL_REVIEW_RESPONSE.md`; none of these internal/AI reviews is described as journal peer review.

The strongest formal issues identified across the reviews have been addressed by the direct Change-to-Effect/Rule bridge, consistent fail-closed magnitude semantics, and formal equivalence between the relational and executable policy checks. The former external-validity gap is now partially addressed by the public mutation-shape audit; a larger independently coded/representative study remains future work.

## Submission metadata currently known

- Author: Michél Nguyen
- Affiliation: University of the People
- Funding: none
- Competing interests: none declared
- Intended venue: Science of Computer Programming, Research Papers track
- Submission route: journal only

The exact originality/concurrent-submission declaration and any remaining Editorial Manager fields should be confirmed at actual submission time rather than inferred.

## Supporting submission files

- `journal.tex` — current journal root;
- `main.tex` — stable core manuscript;
- `real-code-study.tex` — Round-6 external mutation audit;
- `related-work.tex`;
- `references.bib` and `related-extra.bib`;
- `highlights.txt`;
- `cover-letter.md`;
- `SCP_SUBMISSION.md`;
- internal review/disposition files including `INTERNAL_REVIEW_ROUND6.md`.

The audit artifact lives under `studies/real-code-mutations/` with `corpus.json`, `results.json`, and its protocol README. `scripts/evaluate-real-code-mutations.js` deterministically validates/regenerates the counts; `scripts/verify-real-code-sources.js` optionally checks source anchors at the exact public commit pins.

## CI

`.github/workflows/paper.yml` first checks the frozen real-code corpus/result consistency, then compiles `journal.tex`, rejects unresolved citations/references, rejects `Overfull \hbox` layout overflow, and uploads the generated PDF artifact. The network source-anchor check is intentionally optional so temporary GitHub availability cannot break manuscript compilation. Formal CI separately regenerates and verifies the Lean/certificate assurance stack.

The Round-5/6 formal state is pinned to commit `2518a1522461319454449eb6ad85d1ffeeaab53b`, whose complete formal workflow passed with the checker-equivalence theorems and generated certificates.

## Remaining high-value strengthening work

1. archive/tag the final source/evidence snapshot under an immutable identifier/DOI before submission if appropriate;
2. expand the real-code audit into a larger independently coded or preregistered corpus and/or execute behavior-preserving translation cases;
3. collect fixed-machine controlled assurance-cost measurements;
4. implement or formally compare a representative modern effect/capability approach.

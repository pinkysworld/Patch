# Patch journal manuscript

The current manuscript in `paper/main.tex` is prepared specifically for the **Science of Computer Programming** (Elsevier) Research Papers track using `elsarticle` formatting. This manuscript is being developed as a **journal submission only; no conference submission is planned**.

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
- artifact-level semantic-lineage reuse across compiler analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility tooling.

The manuscript does **not** claim end-to-end compiler verification, complete sandboxing, production source-to-effect verification, third-party ecosystem validation, a controlled performance result, a usability result, atomic multi-target Change, or superiority over modern effect/capability systems.

## Review status

Four earlier internal reviewer-perspective rounds are documented in `INTERNAL_REVIEW.md`. The fifth skeptical SCP-style pass and its disposition are documented separately in `INTERNAL_REVIEW_ROUND5.md` and `INTERNAL_REVIEW_ROUND5_RESPONSE.md`. An author-supplied Claude Opus referee-style AI review and its disposition are documented in `EXTERNAL_REVIEW_RESPONSE.md`; it is not described as journal peer review.

The strongest formal issues identified across these reviews have been addressed by the direct Change-to-Effect/Rule bridge, consistent fail-closed magnitude semantics, and formal equivalence between the relational and executable policy checks. Round 5 also added direct positioning against prior Software Change Contracts and a self-contained target-only ablation definition. New empirical studies requested by reviewers (real-code corpus and controlled fixed-machine timing) remain limitations/future strengthening work rather than being replaced with synthetic claims.

## Submission metadata currently known

- Author: Michél Nguyen
- Affiliation: University of the People
- Funding: none
- Competing interests: none declared
- Intended venue: Science of Computer Programming, Research Papers track
- Submission route: journal only

The exact originality/concurrent-submission declaration and any remaining Editorial Manager fields should be confirmed at actual submission time rather than inferred.

## Supporting submission files

- `main.tex`
- `related-work.tex`
- `references.bib`
- `related-extra.bib`
- `highlights.txt`
- `cover-letter.md`
- `SCP_SUBMISSION.md`
- `INTERNAL_REVIEW.md`
- `INTERNAL_REVIEW_ROUND5.md`
- `INTERNAL_REVIEW_ROUND5_RESPONSE.md`
- `EXTERNAL_REVIEW_RESPONSE.md`

## CI

`.github/workflows/paper.yml` compiles the Elsevier manuscript, rejects unresolved citations/references, rejects `Overfull \hbox` layout overflow, and uploads the generated PDF artifact. Formal CI separately regenerates and verifies the Lean/certificate assurance stack on the journal branch.

The Round-5 formal state is pinned to commit `2518a1522461319454449eb6ad85d1ffeeaab53b`, whose complete formal workflow passed with the checker-equivalence theorems and generated certificates.

## Remaining high-value strengthening work

1. optionally archive/tag the final source/evidence snapshot under an archival DOI/identifier before submission;
2. genuine external/public real-code mutation evidence or a third-party integration case;
3. fixed-machine controlled assurance-cost measurements;
4. a fair implemented or formal comparison with a representative modern effect/capability approach.

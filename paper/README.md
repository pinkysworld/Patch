# Patch journal manuscript

The current journal-oriented manuscript is prepared in `paper/main.tex` for **Science of Computer Programming** using Elsevier `elsarticle` formatting.

## Current scientific framing

The paper is centered on a deliberately narrow architectural claim:

> Patch makes structured semantic Change the mandatory modeled route for post-creation persistent mutation and derives operation- and magnitude-aware authority, provenance, history and scoped assurance from that semantic mutation route.

`Persistent` here means Patch application state retained across statements/events during execution; it does not imply durable storage across process restarts. `Same substrate` means a shared mandatory semantic mutation route/vocabulary with distinct compile-time/runtime representations derived from it, not one literal object shared by every phase.

## Evidence currently in the manuscript

- State-Change Factorization as a by-construction machine-checked design invariant;
- Mutation Transparency;
- Lean-checked signature/capability and integer-range results for explicit fragments;
- finite ranked and transitive exact call-tree reasoning;
- accepted-evidence runtime-frame correspondence for selected direct-Wasm executions;
- repeated-identical and mixed-guard invocation-frame evidence;
- eight-case semantic-authority ablation;
- checkout/loyalty and usage/quota application cases;
- artifact-level substrate-reuse audit across compiler analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility tooling.

The manuscript does **not** claim end-to-end compiler verification, complete sandboxing, third-party ecosystem validation, a controlled performance result, a usability result, or superiority over modern effect/capability systems.

## Internal review status

Four internal reviewer-perspective rounds are documented in `INTERNAL_REVIEW.md`:

1. Programming Languages / Formal Methods;
2. Systems / Artifact / Evaluation;
3. Journal Editor / Novelty / Presentation;
4. Skeptical SCP Reviewer / Central-Claim Stress Test.

The fourth round specifically tightened the central architecture claim by distinguishing semantic-substrate reuse from literal object identity, defining `persistent state`, removing unsupported usability language, and making clear that the authority ablation does not prove mandatory factorization superior to conventional mutation plus separate analysis.

## Submission metadata currently known

- Author: Michél Nguyen
- Affiliation: University of the People
- Funding: none
- Competing interests: none declared

The exact concurrent-submission status, immutable artifact identifier/tag, and any remaining Editorial Manager fields should be confirmed at actual submission time rather than inferred.

## Supporting submission files

- `main.tex`
- `related-work.tex`
- `references.bib`
- `related-extra.bib`
- `highlights.txt`
- `cover-letter.md`
- `SCP_SUBMISSION.md`
- `INTERNAL_REVIEW.md`

## CI

`.github/workflows/paper.yml` compiles the Elsevier manuscript, rejects unresolved citations/references, and uploads the generated PDF artifact.

## Remaining high-value optional strengthening work

1. genuine external/third-party integration evidence;
2. fixed-machine controlled assurance-cost measurements;
3. a fair implemented or formal comparison with a representative modern effect/capability approach;
4. freeze the final source/evidence commit and archive/tag it before submission.

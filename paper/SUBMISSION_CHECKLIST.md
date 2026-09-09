# Paper 1 submission checklist - Programming Journal

Target: **The Art, Science, and Engineering of Programming**

## Journal-facing configuration

- Perspective: **The Art of Programming**
- Areas: **General-purpose programming; Program verification; Interpreters, virtual machines, and compilers; Security programming**
- Working title: **Patch: State-Change Factorization and Semantic Change Contracts**
- Keywords: **programming languages; state mutation; effects; capabilities; formal verification**
- ACM CCS: **Software and its engineering -> General programming languages**
- Main-text target: at most 22 pages in the journal style; bibliography and appendices are excluded from that recommendation.
- Next normal submission-cycle deadline after 30 August 2026: **1 October 2026, AoE**.

## Before upload

- [x] Author spelling: Michél Nguyen.
- [x] Affiliation set to **University of the People**, matching the affiliation selected for this paper.
- [ ] Add ORCID only if desired and verified by the author.
- [ ] Confirm that this manuscript is not simultaneously under review at another journal or proceedings venue.
- [ ] Use the PDF produced from `programming-submission.tex`, not the generic article-layout PDF.
- [ ] Confirm that the six-part abstract still covers Context, Inquiry, Approach, Knowledge, Grounding, and Importance and remains below 500 words.
- [ ] Keep the generative-AI disclosure in the acknowledgements; the journal requires disclosure of generative AI used in writing.
- [ ] Record the exact Patch repository commit used for the artifact in `ARTIFACT_SUBMISSION.md`.
- [ ] Check all external URLs and cited public-code commit hashes one final time.
- [ ] Review PDF page count, embedded fonts, broken links, overfull boxes, and bibliography output.

## Submission-form notes

Suggested perspective rationale:

> The paper's primary contribution is a programming-language design and programming model: a semantic mutation interface reused across execution, history, and restricted authority contracts. The formal results and bounded empirical studies ground the design, but the paper does not claim a full formalization or a baseline-beating engineering evaluation.

Suggested short note to editor:

> This submission presents Patch, a mutation-centered language design in which modeled post-creation persistent updates use a semantic Change interface that is also reused to derive target-, operation-, and magnitude-aware contracts. The manuscript deliberately separates by-construction design invariants from three machine-checked semantic-fragment results and from production correspondence evidence. The artifact includes the Lean development, evaluation scripts, frozen public-code audit manifest, and reproducibility tooling.

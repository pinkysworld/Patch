# Science of Computer Programming submission notes

## Submission route

**Journal only:** Science of Computer Programming (SCP), Research Papers track.

**No conference submission is planned for this manuscript.** Conference names may still appear in the bibliography because they are publication venues for cited prior work; they are not candidate submission venues for Patch.

**Best fit:** Experimental Software Technology, with substantial Formal Techniques content.

**Working title:**

> Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs

**Core one-sentence contribution:**

> Patch makes structured semantic Change the mandatory modeled route for post-creation application-state mutation and connects that route to operation- and magnitude-aware contracts, provenance, history, and scoped assurance.

## Author and declaration metadata

- **Author:** Michél Nguyen
- **Affiliation:** University of the People
- **Funding:** This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.
- **Competing interests:** The author declares no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

The affiliation is intentionally given using the institution's full standard name. Do not invent a department, campus, grant, sponsor, or institutional role that has not been supplied by the author.

At actual submission, confirm the originality/concurrent-submission declaration in Editorial Manager from the author's then-current status. Do not infer or pre-fill that declaration.

## Submission-format status

The journal branch uses the Elsevier `elsarticle` class with SCP front matter, affiliation, keywords, funding and competing-interest statements, and `elsarticle-num` bibliography style. Submission-facing LaTeX/BibTeX files are kept together in `paper/`.

Supporting files include:

- `main.tex` — journal manuscript;
- `related-work.tex` — related-work positioning;
- `references.bib` and `related-extra.bib` — bibliography;
- `highlights.txt` — five concise highlights;
- `cover-letter.md` — SCP journal cover letter;
- `INTERNAL_REVIEW.md` — internal reviewer-perspective rounds;
- `EXTERNAL_REVIEW_RESPONSE.md` — disposition of the author-supplied Claude Opus referee-style AI review.

The dedicated `.github/workflows/paper.yml` job compiles the Elsevier manuscript, rejects unresolved citations/references, and publishes the generated PDF as a workflow artifact.

## Current manuscript message

The abstract and introduction are now organized around four points:

1. Patch factors post-creation application-state mutation through structured semantic Changes;
2. a new Lean bridge directly connects a supported committed Change to its directional contract Effect and actual before/after magnitude;
3. the wider assurance/runtime stack is explicitly scoped and does not claim a fully verified compiler;
4. a deterministic target-only ablation isolates policy distinctions that disappear when operation and magnitude are erased.

Do not broaden this into a claim that Patch invents effects, capabilities, quantitative reasoning, first-class state changes, reversibility, event sourcing, or bounded state specifications.

## Research questions

The journal manuscript now uses three non-tautological research questions:

- **RQ1 — Contract linkage:** can a supported committed numeric Change be connected formally to a contract-level operation/magnitude effect and to the actual state delta?
- **RQ2 — Assurance and implementation correspondence:** which contract, range, finite-call, and runtime-correspondence properties are machine checked, and where does the proof-free implementation boundary remain?
- **RQ3 — Mechanism isolation:** which authority distinctions disappear when operation and magnitude information are erased while reachable write targets are retained?

State-Change Factorization itself is presented as a by-construction design invariant, not as an empirical research question.

## Terminology discipline

- `application state` means Patch state retained across statements/events during execution; it does **not** imply durable disk/database storage;
- `same substrate` / `same lineage` means one mandatory semantic mutation route/vocabulary with compile-time and runtime representations derived from it; it does **not** mean every phase consumes one identical serialized or in-memory object;
- a `Semantic Change Contract` is the checked combination of an inferred Change Signature and declared Change Capability;
- compact source syntax is a design description, not a measured usability result.

## Upload highlights

The upload-ready versions are in `highlights.txt`:

- Application-state mutation is factored through explicit semantic Changes.
- Change Contracts distinguish target, operation, and bounded magnitude.
- Lean links committed Change magnitude to bounded contract authority.
- Direct-Wasm observations are linked to exact call trees by checked evidence.
- A target-only ablation isolates operation- and magnitude-aware distinctions.

## Suggested classification / keywords

- Programming language design
- Mutable state
- Effect systems
- Capabilities and permissions
- Formal verification
- WebAssembly
- Program provenance
- Programming environments

## What is an actual result

The current manuscript may claim the implemented/mechanized results already present in the repository, including:

- State-Change Factorization as a by-construction machine invariant and Mutation Transparency in the modeled machine;
- the direct Change-to-contract bridge for supported singleton numeric Changes (`effectOf_amount_matches_actual` and `allowedEffectOf_respects_actual_bound`);
- fail-closed bounded unknown magnitude in the relational policy semantics and verified executable checker;
- normalized signature/capability and integer-range theorems for explicit Lean fragments;
- finite transitive exact call-tree refinement for the encoded fragment;
- accepted-evidence runtime-frame correspondence for selected direct-Wasm executions;
- reconstruction of repeated-identical and mixed-guard dynamic invocation frames;
- the eight-case mechanism-isolation decision matrix;
- safe execution and controlled escalation behavior in checkout/loyalty and usage/quota cases;
- artifact-level semantic-lineage reuse across compiler change analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility packaging.

## What must not be presented as an existing result

Do not claim:

- that State-Change Factorization is a difficult theorem rather than a machine-checked design invariant;
- that the normalized signature theorem proves production source-to-effect extraction;
- that the Change-to-contract bridge covers fields, multi-operation Changes, text/list operations, `clear`, or sign-indeterminate source ranges;
- end-to-end compiler verification;
- validator or runtime-capture completeness;
- complete parser/lowering correctness;
- complete sandboxing;
- third-party ecosystem validation;
- performance overhead, scalability, or asymptotic behavior without a reviewed controlled dataset;
- a usability/learnability/productivity benefit without a human study;
- atomic multi-target Change support in the current language;
- that the target-only ablation proves mandatory factorization is superior to conventional mutation plus separate analyses;
- novelty merely from effects, capabilities, magnitude bounds, call frames, reversibility, event sourcing, translation validation, or proof-carrying evidence.

## AI-assistance disclosure

The manuscript contains a declaration before the references and an implementation/reproducibility description of AI-assisted work. OpenAI ChatGPT (GPT-5.6 Sol) and Anthropic Claude Opus are described as supporting tools. The author remains responsible for all content; proposed formal claims are accepted only after Lean/CI validation, and no empirical measurements are generated or inferred by AI.

## Related-work status

The related-work section positions Patch against first-class/reified state change, classical/algebraic/quantitative/dependent/temporal effects, effects-as-capabilities, permissions/typestate, refinement verification, explicit changes/patch theory, reversible programming, event sourcing, translation validation/PCC, and provenance debugging. The novelty claim remains architectural and non-subsumptive rather than asserting that richer systems cannot express equivalent state constraints.

## Reproducibility package

The submission should point reviewers to a frozen release/commit rather than a moving default branch. Before actual journal submission:

1. choose the exact final source/evidence commit;
2. run the formal/runtime/security/application checks;
3. regenerate and verify the reproducibility bundle;
4. create a tagged artifact release or archival snapshot;
5. record the immutable artifact identifier/DOI in the manuscript or submission metadata if permitted by review policy.

Core commands:

```bash
npm test
npm run transitive-runtime-certify:mixed-guards
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
npm run bundle:reproducibility
npm run verify:reproducibility
```

## Final journal checks

Before submission, verify that:

- the distinction between expressibility and mutation architecture is unmistakable;
- the by-construction nature of State-Change Factorization is explicit;
- the direct Change-to-contract theorem and its fragment boundary are stated accurately;
- bounded unknown magnitude is consistently fail-closed;
- `application state` cannot be confused with durable storage;
- GUI/toolkit state crosses into application state only through an explicit modeled Change;
- the two-Change transfer example makes the current atomicity/verbosity cost explicit;
- every theorem states its fragment and trust boundary;
- runtime claims are consequences of accepted evidence rather than full compiler correctness;
- the target-only comparison is an ablation rather than a competitive baseline;
- internally authored cases are distinguished from external validation;
- unsupported usability and performance claims are absent;
- the final PDF has no clipped/overflowing content or unresolved references;
- the final archive/DOI identifies the exact reviewed artifact.

## Remaining strengthening work

Three additions would materially strengthen a later revision but are not silently assumed to exist:

- a genuine external/public real-code mutation corpus or third-party integration case;
- controlled fixed-machine assurance-cost measurements with raw samples and dispersion;
- a fair implemented or formal comparison with a representative modern effect/capability approach.

If any is added, update the abstract, evaluation, threats to validity, and conclusion together so the claim surface remains synchronized.

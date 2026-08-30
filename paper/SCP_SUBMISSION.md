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

At actual submission, confirm the originality/concurrent-submission declaration in Editorial Manager from the author's then-current status. Do not infer or pre-fill it.

## Submission-format status

The journal branch uses Elsevier `elsarticle` with SCP front matter and `elsarticle-num`. The current root is `paper/journal.tex`; it composes the stable `main.tex` core with `real-code-study.tex` and synchronizes the Round-6 external-validity wording. Submission-facing LaTeX/BibTeX files remain at one directory level in `paper/`.

Supporting files include `journal.tex`, `main.tex`, `real-code-study.tex`, `related-work.tex`, the two `.bib` files, `highlights.txt`, `cover-letter.md`, and the internal review/disposition notes. The real-code audit artifact is under `studies/real-code-mutations/`.

Paper CI validates the frozen study result, compiles `journal.tex`, rejects unresolved citations/references and `Overfull \hbox`, and publishes the PDF artifact.

## Current manuscript message

The manuscript now combines five evidence layers:

1. mandatory modeled semantic Change for post-creation application-state mutation;
2. a direct Lean bridge from supported committed numeric Changes to directional contract effects and actual before/after magnitude;
3. executable/relational policy-checker equivalence plus scoped range/call/runtime assurance;
4. an explicitly defined target-only mechanism-isolation ablation and two internally authored multi-state application cases;
5. an exploratory public real-code mutation audit that reports both direct-fit evidence and current adaptation/restructuring boundaries.

Do not broaden this into a claim that Patch invents effects, capabilities, quantitative reasoning, first-class state changes, reversibility, event sourcing, the phrase `change contract`, or bounded state specifications.

## Core research questions

The three core RQs remain:

- **RQ1 — Contract linkage:** can a supported committed numeric Change be connected formally to a contract-level operation/magnitude effect and the actual state delta?
- **RQ2 — Assurance and implementation correspondence:** which contract, range, finite-call, and runtime-correspondence properties are machine checked, and where does the proof-free implementation boundary remain?
- **RQ3 — Mechanism isolation:** which authority distinctions disappear when operation and magnitude are erased while reachable write targets are retained?

The public real-code mutation audit is deliberately presented as an **exploratory external-validity audit**, not promoted to a fourth core RQ or a prevalence study.

## Public real-code mutation audit

The Round-6 audit fixes six public JavaScript/TypeScript projects at full immutable Git SHAs and codes exactly three production retained-state mutation observations per project: GitLens, Prettier for VS Code, VS Code ESLint, Obsidian Dataview, Obsidian Tasks, and Node-RED.

Frozen descriptive result for the 18 purposively selected observations:

- 5 direct local current-surface fits;
- 11 adapter cases involving Set/Map/trie, host persistence, or dynamic-target/data-model boundaries;
- 2 source-restructuring cases involving filter replacement and spread/bulk insertion;
- 3 local observations with the same narrow singleton numeric directional constant-magnitude shape as the current Lean Change-to-contract bridge;
- 7 standalone contexts and 11 non-standalone contexts (coupled, host-persisted, sequential, or dynamic/batch targeted).

Every observation can be assigned a coarse Patch operation-family label, but that is **not** a portability result. The direct/adapter/restructure distinction must accompany the result. The three Lean-shape observations are not Lean proofs of the external TypeScript programs.

Because the corpus is purposive, the 18 observations do not estimate ecosystem prevalence, migration effort, security benefit, or developer productivity. The coding is author-led; there is no independent second coder or inter-rater reliability statistic. Exact commit pins, paths, contexts and source anchors make the judgments auditable but not representative.

## Terminology discipline

- `application state` means Patch state retained across statements/events during execution, not durable disk/database storage;
- `same substrate` / `same lineage` means a mandatory semantic mutation route/vocabulary with derived compile-time/runtime representations, not one identical object passed through every phase;
- a `Semantic Change Contract` is the checked combination of an inferred Change Signature and declared Change Capability;
- prior **Software Change Contracts** concern intended cross-version software evolution; Patch does not claim the phrase `change contract` as novel;
- `direct fit` in the external audit is local mutation-shape compatibility, not proof of whole-program translation;
- `Lean-fragment shape match` is resemblance to the theorem's supported shape, not certification of third-party code.

## Upload highlights

The upload-ready versions are in `highlights.txt`:

- Application-state mutation is factored through explicit semantic Changes.
- Change Contracts distinguish target, operation, and bounded magnitude.
- Lean links committed Change magnitude to bounded contract authority.
- Direct-Wasm observations are linked to exact call trees by checked evidence.
- Ablation and public-code audit expose semantic and adaptation boundaries.

## Actual results that may be claimed

The manuscript may claim:

- State-Change Factorization as a by-construction machine invariant and Mutation Transparency;
- the direct Change-to-contract bridge for supported singleton numeric Changes (`effectOf_amount_matches_actual`, `allowedEffectOf_respects_actual_bound`);
- fail-closed bounded unknown magnitude;
- executable/relational checker equivalence (`allowsBool_iff`, `policyAllowsBool_iff`) for the modeled Effect/Rule fragment;
- normalized signature/capability and integer-range theorems for explicit fragments;
- finite transitive exact call-tree refinement for the encoded fragment;
- accepted-evidence runtime-frame correspondence for selected direct-WebAssembly executions, including repeated dynamic invocations;
- the explicitly defined eight-case target-only mechanism-isolation matrix;
- the two internally authored multi-state application cases;
- the 18-observation public mutation-shape audit with its strict direct/adapter/restructure and context coding;
- artifact-level semantic-lineage reuse and commit-bound reproducibility packaging.

The validated formal-policy/bridge state is pinned at `2518a1522461319454449eb6ad85d1ffeeaab53b`.

## Target-only ablation definition

For policy `p` protecting recipe `f`, `A(p)` is the set of policy target/field paths and `R(f)` the transitively reachable `change` target/field paths. The ablation accepts iff a policy exists and `R(f) ⊆ A(p)` for every protected recipe. Operation, magnitude/range and proof of range are erased; target/field identity and transitive call reachability remain. Missing protected recipes and unresolved/recursive calls contribute sentinel escape paths and fail closed. This mirrors `src/security-case-study.js`.

## What must not be claimed

Do not claim:

- that State-Change Factorization is a difficult theorem rather than a machine-checked design invariant;
- production source-to-effect correctness from the normalized signature theorem;
- Change-to-contract coverage beyond its stated singleton numeric fragment;
- end-to-end compiler verification, validator/runtime-capture completeness, complete parser/lowering correctness, or complete sandboxing;
- representative third-party ecosystem coverage or behavioral equivalence of translated external programs from the 18-observation audit;
- that `operation family` means direct portability;
- that a Lean-shape match verifies external code;
- performance/scalability results without controlled data;
- usability/productivity benefits without a human study;
- atomic multi-target Change support;
- superiority over conventional mutation plus separate analyses or modern effect/capability systems;
- novelty merely from effects, capabilities, magnitude bounds, call frames, reversibility, event sourcing, Software Change Contracts, translation validation, or proof-carrying evidence.

## AI-assistance disclosure

The manuscript discloses OpenAI ChatGPT (GPT-5.6 Sol) and Anthropic Claude Opus as supporting tools. The author remains responsible for all content and coding decisions. Formal claims are accepted only after Lean/CI validation. For the public-code audit, AI assistance helped locate and adversarially review candidate classifications; accepted observations are tied to immutable source anchors, and descriptive counts are generated mechanically from the frozen author-controlled coding manifest. No inter-rater reliability claim is made.

## Reproducibility

Study commands:

```bash
npm run evaluate:real-code
npm run evaluate:real-code:check
npm run verify:real-code-sources   # optional network source-anchor check
```

Core artifact commands remain:

```bash
npm test
npm run transitive-runtime-certify:mixed-guards
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
npm run bundle:reproducibility
npm run verify:reproducibility
```

The reproducibility bundle already packages tracked source files, so the study manifest/results/scripts are included when built from the final tracked revision. An archival DOI is not fabricated; a final tagged/archived snapshot may be created before upload.

## Final journal checks

Before submission, verify that the PDF and source keep these boundaries synchronized: by-construction factorization; narrow Change-to-contract theorem; fail-closed unknown magnitude; checker equivalence only for the proved fragment; explicit trust boundaries; target-only comparison as an ablation; internally authored application cases distinguished from the public-source audit; public audit described as purposive rather than representative; direct fit distinguished from operation-family labeling; Lean-shape match distinguished from external verification; Software Change Contracts cited/distinguished; no unsupported performance or usability claims; no clipped/overflowing content or unresolved references.

## Remaining strengthening work

Highest-value later additions are:

- a larger independently coded or preregistered real-code corpus and/or behavior-preserving translation cases;
- controlled fixed-machine assurance-cost measurements with raw samples and dispersion;
- a fair implemented or formal comparison with a representative modern effect/capability approach.

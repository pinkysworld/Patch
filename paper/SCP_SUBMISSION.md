# Science of Computer Programming submission notes

## Proposed article positioning

**Target:** Science of Computer Programming (SCP), Research Papers track

**Best fit:** Experimental Software Technology, with substantial Formal Techniques content

**Working title:**

> Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs

**Core one-sentence contribution:**

> Patch makes a structured semantic Change the mandatory modeled route for post-creation persistent mutation and derives operation- and magnitude-aware authority, provenance and assurance from that semantic mutation route.

## Author and declaration metadata

- **Author:** Michél Nguyen
- **Affiliation:** University of the People
- **Funding:** This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.
- **Competing interests:** The author declares no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

The affiliation is intentionally given using the institution's full standard name. Do not invent a department, campus, grant, sponsor, or institutional role that has not been supplied by the author.

## Submission-format status

The journal branch uses the Elsevier `elsarticle` class with SCP front matter, affiliation, keywords, funding and competing-interest statements, and `elsarticle-num` bibliography style. Submission-facing LaTeX/BibTeX files are kept together in `paper/`, matching Elsevier's requirement that LaTeX source files uploaded through Editorial Manager remain at one folder level.

Supporting files include:

- `main.tex` — journal manuscript;
- `related-work.tex` — related-work/claim-boundary module;
- `references.bib` and `related-extra.bib` — bibliography;
- `highlights.txt` — five concise Elsevier highlights;
- `cover-letter.md` — cover-letter draft with affiliation/funding/competing-interest declarations;
- `INTERNAL_REVIEW.md` — four internal peer-review rounds and dispositions.

The dedicated `.github/workflows/paper.yml` job compiles the Elsevier manuscript, rejects unresolved citations/references, and publishes the generated PDF as a workflow artifact.

## Candidate abstract message

The abstract in `main.tex` is written around four points:

1. ordinary mutable programs often reconstruct semantic meaning around writes;
2. Patch instead factors persistent mutation through structured Changes;
3. formal and runtime evidence establish scoped properties without claiming a fully verified compiler;
4. semantic-authority cases isolate distinctions that disappear when operation and magnitude are removed.

Do not broaden this into a claim that Patch invents effects, capabilities, quantitative reasoning, first-class state changes, reversibility, event sourcing, or bounded state specifications.

## Terminology discipline

- `persistent state` means Patch application state retained across statements/events during execution; it does **not** imply durable storage across process restarts;
- `same substrate` means one mandatory semantic mutation route/vocabulary with compile-time and runtime representations derived from it; it does **not** mean that every phase consumes one identical serialized or in-memory object;
- compact/progressive source syntax is a design description, not a measured usability result.

## Candidate highlights

The upload-ready versions are in `highlights.txt`:

- Persistent mutation is factored through explicit semantic Change objects.
- Change Contracts distinguish target, operation, and bounded magnitude.
- Lean checks scoped contract, range, and finite call-tree properties.
- Direct-Wasm observations are linked to exact call trees by checked evidence.
- An authority ablation isolates operation- and magnitude-aware distinctions.

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
- signature/capability and integer-range theorems for explicit Lean fragments;
- finite transitive exact call-tree refinement for the encoded fragment;
- accepted-evidence runtime-frame correspondence for selected direct-Wasm executions;
- reconstruction of repeated-identical and mixed-guard dynamic invocation frames;
- the eight-case semantic-authority decision matrix;
- safe execution and controlled escalation behavior in checkout/loyalty and usage/quota cases;
- artifact-level substrate-reuse evidence across compiler change analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility packaging.

## What must not be presented as an existing result

Do not claim:

- that State-Change Factorization is a difficult theorem rather than a machine-checked design invariant;
- end-to-end compiler verification;
- validator or runtime-capture completeness;
- complete parser/lowering correctness;
- complete sandboxing;
- third-party ecosystem validation;
- performance overhead, scalability, or asymptotic behavior without a reviewed `controlled` dataset;
- a usability/learnability/productivity benefit without a human study;
- that the target-only ablation proves mandatory factorization is superior to conventional mutation plus separate analyses;
- novelty merely from effects, capabilities, magnitude bounds, call frames, reversibility, event sourcing, translation validation, or proof-carrying evidence.

## Related-work status

The claim boundary explicitly covers first-class/reified state change, classical/algebraic/quantitative/dependent/temporal effects, effects-as-capabilities, permissions/typestate, refinement verification, explicit changes/patch theory, reversible programming, event sourcing, translation validation/PCC, and provenance debugging. Recent work continues to strengthen effect/capability semantics and expressiveness; Patch therefore keeps its novelty claim architectural and non-subsumptive rather than asserting that richer systems cannot express equivalent state constraints.

## Reproducibility package

The submission should point reviewers to a frozen release/commit rather than a moving default branch. Before actual submission:

1. choose the exact source commit;
2. run the formal/runtime/security/application checks;
3. regenerate and verify the reproducibility bundle;
4. create a tagged artifact release or archival snapshot;
5. record the immutable artifact identifier in the manuscript or submission metadata if permitted by review policy.

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

## Final reviewer-style checks

Before submission, answer these questions from the manuscript alone:

- Is the distinction between expressibility and mutation architecture unmistakable?
- Is the by-construction nature of the factorization theorem explicit?
- Is `same substrate` defined as semantic lineage rather than literal object identity?
- Is `persistent state` defined so it cannot be confused with disk/database durability?
- Does the substrate-reuse audit support only architectural coupling, not comparative superiority?
- Is it clear why operation/magnitude authority follows naturally from the Change representation?
- Does every theorem state its fragment and trust boundary?
- Are the runtime claims phrased as consequences of accepted evidence rather than full compiler correctness?
- Is the target-only comparison clearly described as an ablation rather than a competitive baseline?
- Are internally authored application cases clearly distinguished from external validation?
- Are unsupported usability claims absent?
- Are all version numbers that matter for reproduction captured in the frozen artifact rather than cluttering the research narrative?

## Remaining optional strengthening work

Three additions would materially strengthen the paper but are not silently assumed to exist:

- a genuinely external/third-party integration case;
- controlled fixed-machine assurance-cost measurements with raw samples, dispersion, and a reviewed analysis;
- a fair implemented or formal comparison with a representative modern effect/capability approach.

If any is added, update the abstract, evaluation, threats to validity, and conclusion together so the claim surface remains synchronized.

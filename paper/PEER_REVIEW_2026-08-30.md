# Internal peer-review record: Paper 1

Date: 2026-08-30

Manuscript: **Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

Purpose: adversarial pre-submission review of Paper 1 only. The reviews below are deliberately scoped to the current contribution. Relational ChangeSets, least-authority inference, certified adapters, temporal authority, ChangeLens, and safe parallelism are treated as follow-on research and are not promoted into this manuscript.

This document records reviewer-style criticism, disposition, and concrete manuscript action. It is not external peer review and must not be described as such in a submission.

## Round 1: Programming-languages novelty reviewer

### Major concern

The implementation and assurance stack are extensive enough to obscure the actual research contribution. A reviewer could finish the paper knowing that Patch has many certificates and validators while remaining unsure whether the novelty claim is a language architecture, an effect system, a capability system, an audit log, or a verified compiler.

### Recommendation

Make one idea dominant: **State-Change Factorization**. Ordinary modeled persistent mutation is committed through a structured semantic Change, and Semantic Change Contracts are derived from that same mandatory route. Treat the formal and runtime machinery as evidence that this architecture is not merely surface syntax.

Do not claim novelty for first-class state change, effect summaries, capabilities, quantitative effects, provenance, replay, or proof-carrying validation individually.

### Disposition: accepted

Actions:

- retain State-Change Factorization plus Semantic Change Contracts as the headline contribution;
- keep the formal/Wasm bridge as supporting assurance rather than a second novelty headline;
- keep the contribution boundary explicit;
- do not promote Stage-0 research prototypes into Paper 1.

## Round 2: Formal-methods reviewer

### Major concern

The assurance stack is strongest when it is precise about what Lean proves and what remains trusted. Expanding the theorem just to make the paper look more ambitious would create unnecessary proof risk and could weaken credibility if the production boundary is overstated.

### Recommendation

Preserve the explicit fragment theorems. Distinguish clearly between Lean-checked consequences of accepted evidence and verification of the evidence producer. Keep runtime capture, validator/frame reconstruction, unsupported parser semantics, JavaScript-to-WebAssembly lowering, and the WebAssembly engine in the trust boundary.

### Disposition: accepted

Actions:

- no theorem was widened;
- beta.32 runtime-frame correspondence remains a consequence of accepted independently reconstructed evidence;
- later beta.33-beta.35 product work remains outside the beta.32 theorem;
- no full-compiler-verification wording is introduced.

### Rejected suggestion

Adding a new relational/atomicity theorem from the ChangeSets research branch was rejected for this paper. It belongs to the planned follow-on paper and would blur the current theorem boundary.

## Round 3: Empirical software-engineering reviewer

### Major concern

The eight authority micro-cases and two application cases are internally authored. They are useful controlled evidence but do not establish that the mutation architecture resembles mutation found in mature public software. Conversely, adding one hand-picked external example and calling it real-world validation would be too weak.

### Recommendation

Add a small, auditable, commit-bound public-code study with an explicit non-representative sampling claim. Classify mutation *shape* separately from whether Patch actually owns the commit route. Count foreign host-backed state and grouped multi-target updates as boundaries rather than successes.

### Disposition: accepted

Actions:

- added `evaluation/real-code-audit/corpus.csv` with exact project commits, paths, textual anchors, and classifications;
- added a method/claim-boundary README;
- added a 15-site public-code mutation study covering Excalidraw, VS Code, and JupyterLab;
- report descriptive counts only, with no ecosystem prevalence claim;
- distinguish semantic fit from commit-route ownership;
- classify host-backed VS Code `Memento` and JupyterLab `IStateDB` updates as adapter boundaries;
- classify Excalidraw multi-field state bundles as a Paper 1 grouping boundary rather than silently decomposing them and claiming support.

### Rejected suggestion

Reporting “80% real-world coverage” was rejected. The 12/15 single-target count is descriptive of the frozen purposeful sample only and is not a population estimate.

## Round 4: Journal editor and narrative reviewer

### Major concern

The paper risks becoming a project report because product-version details, GUI/runtime compatibility notes, measurement infrastructure, formal layers, and the central research idea all compete for attention. A journal reader should be able to state the contribution in one sentence after reading the abstract and introduction.

### Recommendation

Use an evidence hierarchy:

1. architectural thesis: State-Change Factorization and Semantic Change Contracts;
2. formal and production assurance: evidence that the thesis survives beyond syntax;
3. semantic-authority ablation and application cases: controlled value evidence;
4. public-code mutation-shape evidence: external plausibility and boundary evidence;
5. product/distribution details and unclaimed performance protocol: artifact support, not headline contribution.

Move or compress product engineering detail in the submission-facing manuscript. Do not make an uncollected timing dataset a prerequisite for answering a research question when the paper does not claim performance.

### Disposition: accepted and implemented

Actions:

- replaced the overlapping six-claim/five-contribution framing with four research questions and four aligned contributions near the beginning of the paper;
- moved the public-code evidence into the evaluation sequence rather than embedding it in Related Work;
- RQ4 now concerns public mutation shapes and commit-route boundaries rather than uncollected assurance cost;
- reduced the former multi-paragraph assurance-cost section and measurement table to a short artifact-only measurement protocol;
- compressed detailed beta.35 native GUI, packaging, payload, and version narration into one Product Artifact Boundary section;
- removed product beta numbering from the title-page date;
- updated Limitations and Conclusion so performance is a future claim only if the paper later chooses to make one.

## Round 5: Skeptical novelty and prior-art reviewer

### Major concern

Event sourcing is unusually close to Patch's history/replay motivation because event-sourced systems can treat state-changing events as the authoritative representation from which state is reconstructed. The State-Action-Model (SAM) practitioner pattern is also relevant because it explicitly treats state mutation as a first-class concern and centralizes state mutation in a structured application step. Omitting both would leave avoidable holes in the novelty argument. Strong prior art in effects, capabilities, graded/dependent effects, typestate, permissions, and explicit changes already prevents broad firstness claims.

### Recommendation

Discuss event sourcing directly and acknowledge SAM as conceptual prior art without presenting a practitioner pattern as a peer-reviewed language contribution. The candidate Patch contribution is not “state is represented by changes,” “mutation is first class,” or “mutation is centralized.” It is the language-level conjunction in which ordinary modeled persistent mutation has one semantic Change commit route and operation/magnitude-aware authority is derived from that same route, with a formal and production-assurance story tied to the route.

### Disposition: accepted

Actions:

- added Event Sourcing to Related Work and the architectural comparison;
- added peer-reviewed Journal of Systems and Software references on event-sourced systems and observability;
- added operation-based live executable models as close prior art for explicit execution deltas and moved that work into the formal bibliography/comparison table;
- added a separate SAM paragraph with its practitioner status made explicit;
- narrowed the claim boundary so history/replay, explicit runtime deltas, first-class mutation, and centralized mutation are explicitly not sufficient novelty claims;
- preserved the distinction between these architectures and Patch's language-level semantic mutation plus derived authority coupling.

## Round 6: Science of Computer Programming venue-fit reviewer

### Major concern

A paper that mixes language design, formal verification, product engineering, and a small qualitative audit can look unfocused unless the venue can see a coherent research-paper contribution rather than a software release report.

### Recommendation

Frame the work as an experimental programming-language architecture supported by pragmatic formal techniques. For a venue such as *Science of Computer Programming*, language design/implementation/evaluation and pragmatic formal techniques are directly in scope. The paper should therefore make the language architecture the object of study, use the Lean/runtime stack as validation evidence, and use the public-code evidence to delimit applicability. Product distribution details should remain artifact support.

### Disposition: accepted

Actions:

- the submission-facing narrative now follows architecture -> formal/production assurance -> controlled semantic-authority evaluation -> public-code applicability/boundaries -> artifact reproducibility;
- implementation features not needed to answer RQ1-RQ4 are explicitly outside the contribution hierarchy;
- no later Paper 2 research topic is introduced merely to make Paper 1 appear broader.

## Round 7: Reader-comprehension and empirical-claims reviewer

### Major concern

The phrase “public real-code audit” is too easy to read as a third-party integration, compatibility, or real-world coverage study. A reader can reasonably ask what Excalidraw, VS Code, or JupyterLab have to do with Patch because none of those systems is implemented in Patch. If the connection is not explicit, the evaluation appears detached from the contribution and the 12/15 count can be mistaken for a success rate.

### Recommendation

Recast the study as a **public-code mutation-shape stress test** and state the connection to Patch before reporting any counts. For each frozen mutation site, ask only whether the state transition can be represented by one current single-target Patch-style Change and whether Patch would own the actual commit route. State explicitly that the public projects are neither translated to nor executed by Patch. Remove percentage shares from the paper table and make the counts descriptive rather than evaluative scores.

Use a concrete example. A VS Code call such as `globalState.update(key, true)` has a set-like transition resembling `change flag: set true`, but VS Code Memento still performs the persistent commit. Conversely, a multi-field Excalidraw `setState` stresses a boundary of the current single-target Change abstraction.

### Disposition: accepted and implemented

Actions:

- renamed the manuscript section to `Public-Code Mutation-Shape Stress Test`;
- rewrote RQ4 around representational fit and out-of-model mutation/persistence routes;
- changed the abstract, contribution list, Limitations, and Conclusion so the study is consistently described as representational evidence rather than integration evidence;
- added an explicit statement that Excalidraw, VS Code, and JupyterLab are not translated to or executed by Patch;
- removed the percentage column from the manuscript table;
- added the VS Code Memento example to make the Patch connection concrete;
- renamed the artifact README and clarified the same claim boundary there;
- kept all later adapter and ChangeSet work outside Paper 1.

### Rejected suggestion

Expanding the corpus until it could support ecosystem-prevalence claims was rejected for Paper 1. That would require a predeclared mining methodology, a much broader sample, and a different empirical contribution. Implementing host adapters or porting one of the inspected projects was also rejected as scope expansion rather than necessary evidence for the current paper.

## Consolidated reviewer verdict

The strongest version of Paper 1 is **smaller in claim surface but stronger in evidence**. The manuscript should not try to win by accumulating every Patch research idea. Its defensible novelty case is the architectural conjunction:

> ordinary modeled persistent mutation is factored through a structured semantic Change, and operation- and magnitude-aware summaries and authority are derived from that same mandatory mutation substrate.

The formal development, production runtime correspondence, semantic-authority evaluation, and public-code mutation-shape stress test should all answer whether this conjunction is coherent, useful, and honestly bounded.

The public-code stress test strengthens the paper only as representational and boundary evidence. It finds compact single-target mutation shapes while also exposing host-state ownership and multi-target grouping as concrete limits. It does not show that third-party applications run on Patch. Those limits point toward later research without turning later research into Paper 1.

## Pre-submission gates after these rounds

- central novelty statement appears consistently in abstract, introduction, related work, and conclusion;
- four research questions map cleanly to the evidence sections;
- public stress-test manifest and manuscript counts stay synchronized;
- the manuscript never presents stress-test counts as percentages, coverage, compatibility, or migration success;
- event-sourcing, operation-based live-model, and SAM comparisons remain accurate and non-dismissive;
- no language implies third-party Patch execution or certified host adapters;
- no performance/scalability claim appears without a reviewed controlled dataset;
- product engineering detail remains subordinate to the research narrative;
- all beta.32 theorem and trust-boundary wording remains unchanged unless formal evidence changes;
- later research prototypes remain explicitly outside Paper 1;
- CI and LaTeX build must pass after the editorial restructuring.

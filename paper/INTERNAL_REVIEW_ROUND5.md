# Internal peer review — Round 5

## Reviewer perspective

Skeptical *Science of Computer Programming* reviewer, with emphasis on programming-language novelty, formal scope, evaluation validity, and journal-level completeness.

## Recommendation

**Major revision, with a positive trajectory.**

The manuscript has materially improved since the earlier adversarial review. The previously serious disconnect between the mutation-machine `Change` and the contract-level `Effect` is now addressed by `PatchChangeContract.lean`, and the bounded-unknown-magnitude semantics are aligned between the relational judgment and executable checker. I no longer see a formal contradiction that by itself would justify rejection.

The main remaining weakness has shifted from formal correctness to evaluation independence and positioning. The current mechanism-isolation experiment is valid for the narrow question it asks, but it remains constructed by the authors and the two larger application cases are also internally authored. For a journal paper, especially one positioned partly as Experimental Software Technology, this leaves the practical-generalization claim under-supported.

## Major comment 1 — Evaluation independence is now the main scientific risk

The eight-case target-only ablation deliberately deletes operation, magnitude, and proof-obligation information while retaining reachable targets. It therefore demonstrates that these semantic dimensions affect the selected policy decisions, but it cannot independently establish that the mandatory Change architecture is useful in real software or preferable to a conventional language plus analysis.

The manuscript states this limitation correctly. The problem is no longer overclaiming; it is that the strongest empirical question remains unanswered.

**Requested strengthening:** add at least one independent source of evidence before submission if feasible. The most cost-effective option is a small public real-code mutation corpus. Sample state-mutating sites from existing plugin/extension/automation code and classify them by whether they fit Patch's supported fragment: named target, directional numeric delta, bounded/derivable magnitude, sign-indeterminate update, multi-target/atomic update, collection/text update, external/foreign state, and residual unsupported cases. This does not require a user study.

A second acceptable route is one fair implemented or formal comparative encoding against a representative modern effect/capability/refinement approach. Do not use a rhetorical comparison table in place of an implementation or formalization.

## Major comment 2 — Direct prior terminology: Software Change Contracts

The manuscript uses the central term **Semantic Change Contract**, but prior work already uses **Software Change Contracts** for a formal contract language that specifies intended behavioral/structural changes across program versions (Yi, Qi, Tan, and Roychoudhury; ISSTA 2013 / TOSEM 2015).

The concepts are materially different: that prior work concerns intended software-version changes, whereas Patch constrains runtime application-state mutations. Nevertheless, the terminology is close enough that a reviewer may assume the prior line was overlooked.

**Required change:** cite and distinguish this work explicitly in Related Work. A concise contrast is sufficient: software change contracts constrain intended cross-version program evolution; Patch's contract constrains a runtime semantic state-change effect derived from the mutation route.

Consider whether **Semantic Mutation Contract** would reduce ambiguity. Renaming is optional if the prior work is clearly cited and distinguished.

## Major comment 3 — The executable checker is proved sound, not complete

`PatchChecker.lean` proves `allowsBool_sound` and `policyAllowsBool_sound`: a successful executable check implies the relational `Allows`/`PolicyAllows` judgments. This is useful and correct.

I did not find the converse theorem showing that every relationally allowed rule/effect pair is accepted by `allowsBool`, nor an iff theorem. Because the manuscript sometimes calls this a "verified executable checker," a formal-methods reviewer may ask whether false-negative divergence between the executable and relational semantics has also been ruled out.

**Recommended change:** either prove `allowsBool_complete` / `allowsBool_iff` (and, if useful, the corresponding policy-level completeness result), or consistently call the implementation a **soundness-verified executable checker**. Given the simple case split, the completeness theorem appears inexpensive and would close this question cleanly.

## Major comment 4 — Define the target-only ablation independently of the implementation

The paper currently explains the ablation conceptually: retain reachable changed targets while erasing operation, magnitude, and proof obligations. That is understandable but not precise enough for a reader to reproduce the mechanism from the manuscript alone.

**Requested change:** give a compact formal or pseudocode definition of the target-only decision rule. State exactly how target paths are collected across calls, what constitutes a target match, what information is erased, and whether field paths/call propagation are retained. The eight rows then become instances of a clearly specified comparison rather than results whose baseline semantics live only in the artifact.

## Major comment 5 — Keep the interprocedural/runtime assurance stack tied to the central claim

The finite exact-call and runtime-frame sections are technically interesting, but they occupy substantial manuscript space relative to the central Change-to-contract result. A skeptical reviewer may see them as accumulated project assurance features unless the manuscript makes their necessity explicit.

**Recommended change:** motivate them as the evidence that semantic authority survives interprocedural propagation and repeated dynamic invocation, rather than as separate contributions. If space or focus becomes an issue, move some certificate mechanics to an appendix and keep the theorem statements and one representative mixed-guard result in the main text.

## Minor but submission-relevant comments

1. Remove process-history language such as "previous drafts called it persistent state" from the submitted manuscript. Define `application state` directly.
2. Replace future-facing submission placeholders such as "A final submission should additionally archive..." and "Before submission..." with the actual archived artifact identifier before upload.
3. Related-work paragraph headings currently render with doubled punctuation in several places (for example, "First-class and reified state change.."). Remove the period from the LaTeX paragraph title if the class supplies punctuation.
4. "Two larger application domains" is stronger than the evidence warrants. "Two multi-state application cases" or "two application scenarios" is safer.
5. The AI-assistance discussion appears both in the implementation section and in the end declaration. Consider whether the in-body subsection is scientifically necessary; the end declaration may be sufficient, with only artifact-relevant provenance retained in the methods/reproducibility text.
6. Before submission, freeze and archive the exact artifact/source state. The manuscript currently does the right thing by refusing to invent an archival DOI, but a submitted version should not still describe this as future work.

## Strengths

- The central Change-to-contract bridge is now a genuine formal connection rather than adjacent formal components.
- The bounded unknown-magnitude mismatch identified in the earlier adversarial review has been corrected in both relational and executable semantics.
- The manuscript is unusually disciplined about explicit trust boundaries: source-to-effect extraction, validators, runtime capture, lowering, and the Wasm engine are not silently promoted into verified components.
- The sign-indeterminate operation boundary, GUI/application-state boundary, and multi-target atomicity/verbosity cost are now stated rather than hidden.
- Related work is broad and mostly well positioned as an architectural rather than expressiveness comparison.
- Reproducibility is a strong part of the submission, with commit-bound evidence, generated certificates, and explicit commands.
- The SCP venue fit remains strong because the work combines programming-language design, formal techniques, implementation, and experimental software technology.

## Overall assessment

The paper is no longer in a state where I would recommend rejection because the headline formal story fails to connect its own concepts. The new Change-to-contract theorem materially changes that assessment.

I would still recommend **major revision** as an external reviewer because the evaluation remains almost entirely author-constructed and because a direct prior line using the term "change contracts" is currently missing from the positioning. The highest-value pre-submission improvement is therefore empirical/positioning work, not another layer of formal machinery.

If the manuscript adds (1) one modest independent real-code or fair comparative study, (2) the Software Change Contracts citation/contrast, (3) a self-contained ablation definition, and (4) either checker completeness or more precise soundness wording, I would expect the review posture to move substantially toward minor revision / acceptance rather than major revision.
# Response to external referee-style review

This document records the disposition of the detailed referee-style review supplied by the author on 30 August 2026. The report was produced with Anthropic Claude Opus. It is **not** represented as an independent journal peer-review report; it is used as a structured adversarial review of the manuscript and artifact.

## Overall disposition

The review identified two substantive formal issues (M1 and M2), two important scope/representation issues (M3 and M4), and two requests for new empirical evidence (M5 and M6). The first four are addressed in the research artifact and manuscript. M5 and M6 require genuinely new data and are therefore retained as explicit future strengthening work rather than simulated with weaker evidence.

## M1 — Mutation `Change` and contract `Effect` were formally disconnected

**Review concern:** the mutation-machine `Change`/`Step` development and the contract `Effect`/`Rule` development were adjacent but not connected by a theorem.

**Disposition: addressed formally.**

A new module, `formal/PatchChangeContract.lean`, introduces:

- `effectOf : Change → Option Effect` for a deliberately small singleton numeric Change fragment;
- `actualAmountFor`, which reconstructs a directional amount from the committed `before`/`after` values;
- `effectOf_amount_matches_actual`, connecting the amount in the derived contract effect to the actual committed state delta for a well-formed Change;
- `allowedEffectOf_respects_actual_bound`, which mentions `Change`, `Effect`, and `Rule` in one theorem and establishes that a bounded allowed effect constrains the actual committed before/after magnitude.

The bridge is intentionally narrow. Fields, multi-operation Changes, text/list operations, `clear`, and sign-indeterminate source ranges are outside this theorem rather than silently generalized.

## M2 — Unknown magnitude was admitted by bounded formal rules

**Review concern:** the earlier relational `Allows` and executable `amountAllowsBool` accepted an effect with unknown magnitude even when the rule declared a quantitative maximum, while the production evaluation advertised fail-closed behavior.

**Disposition: addressed semantically and executably.**

`Allows` now uses the discipline:

```text
unknown effect + unbounded rule  -> allowed
unknown effect + bounded rule    -> rejected
known effect   + unbounded rule  -> allowed
known effect   + bounded rule    -> interval containment required
```

`PatchChecker.amountAllowsBool` implements the same cases. Runtime policy-refinement proofs are updated so the stricter discipline is preserved through concrete-to-formal effect refinement.

## M3 — Signature soundness starts from normalized effect atoms

**Review concern:** `CoreStmt.emit` already carries an `Effect`; therefore the formal signature theorem does not prove the source analyzer that derives target, operation, and amount interval from Patch source.

**Disposition: addressed by claim correction, not by pretending the source analyzer is proved.**

`PatchSignature.lean` now states explicitly that `emit` is a normalized post-lowering effect atom. The theorem establishes coverage of normalized formal execution traces. Source-to-effect extraction remains a separately validated, proof-free boundary. The manuscript is revised to make this distinction at the theorem site rather than only in later trust-boundary text.

The simple list-composition capability corollary is treated as composition infrastructure rather than a headline independent theorem.

## M4 — Production operation vocabulary is wider than the Lean bridge

**Review concern:** production analysis may classify a sign-indeterminate numeric `add`/`remove` as `add`/`remove`, whereas the current Lean `ChangeKind` contains `increase`, `decrease`, `set`, and `clear`.

**Disposition: addressed as an explicit fail-closed boundary.**

The manuscript now uses a sign-indeterminate example such as a ranged `delta` crossing zero to show the boundary. Such a source operation may exist in the production language, but it is not claimed by the singleton directional `Change → Effect` theorem. The paper does not imply that every production Change Capability form is represented by the current Lean bridge.

## M5 — Constructed authority ablation has limited ecological validity

**Review concern:** an ablation that deliberately erases exactly the semantic dimensions added by Patch cannot establish real-world prevalence or superiority.

**Disposition: accepted limitation; no synthetic replacement.**

The evaluation is framed as a deterministic mechanism-isolation check. It shows what information is lost when operation/magnitude semantics are erased; it does not estimate how frequently the distinction matters in real software and does not establish superiority over a conventional language plus separate analysis.

A public real-code corpus study is a strong next experiment. It is not claimed to have been performed in the current submission.

## M6 — No fixed-machine cost data

**Review concern:** a small, explicitly scoped fixed-machine timing table would be stronger than methodology alone.

**Disposition: valid request, not fabricated.**

The repository already contains the controlled protocol, but no reviewed fixed-machine paper dataset is currently available. Hosted-CI timing remains unsuitable as a substitute. The paper therefore continues to make no overhead/scalability claim and identifies a controlled fixed-machine run as high-value follow-up work.

## Moderate issues

The following presentation changes are adopted:

- factorization is demoted from a research question to a by-construction design invariant;
- the paper uses three research questions focused on contract linkage, assurance/runtime correspondence, and mechanism isolation;
- a worked GUI/event example makes the transient-UI/application-state boundary explicit;
- an intentionally awkward mutation example reports a real ergonomic cost of removing ordinary persistent reassignment;
- the large related-work matrix is removed;
- related work is rewritten as positive positioning (`X provides A; Patch asks B`) rather than repetitive disclaimers;
- `Semantic Change Contract` is defined once as the inferred Change Signature plus the declared Change Capability policy;
- the abstract is reordered around the idea/result before machinery;
- the weak invocation-frame schematic is removed; the frame reconstruction remains described in text;
- `direct WebAssembly` is standardized as the prose term;
- long Lean identifiers are moved out of theorem statements where possible.

## Submission mechanics

Adopted or prepared:

- University of the People affiliation;
- funding declaration: no specific grant funding;
- competing-interest declaration: none known;
- Data/Code Availability wording that points to the public repository while reserving an immutable archive identifier for the actual submission freeze;
- current Elsevier generative-AI disclosure: manuscript-preparation use is declared before the references; AI-assisted code/formal-proof review is described in the implementation/methodology discussion;
- `paper/main.tex` remains the source for the actual journal PDF and `paper/README.md` states that explicitly.

Not invented:

- author email/corresponding-author address not supplied by the author;
- concurrent-submission status remains to be confirmed at submission;
- no Zenodo DOI or archival identifier is claimed until one actually exists;
- no external-corpus results, fixed-machine timing results, or user-study results are manufactured.

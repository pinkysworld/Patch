# Response to internal peer review — Round 5

This document records the disposition of the fifth skeptical *Science of Computer Programming* reviewer-perspective pass. It is an internal review response, not a journal response letter and not a claim of external peer review.

## M1 — Evaluation independence / external validity

**Reviewer concern.** The target-only ablation is intentionally constructed by erasing the semantic dimensions Patch adds, while both larger application cases are internally authored. This supports mechanism isolation but does not independently establish practicality in real software.

**Disposition: accepted limitation; not fabricated away.**

The manuscript continues to state explicitly that the eight-case study is a mechanism-isolation experiment rather than an ecological benchmark, that the application cases are internally authored, and that the results do not establish superiority over conventional mutation plus separate analyses or richer effect/capability systems.

A public real-code mutation corpus remains the highest-value additional empirical study. It has **not** been inserted without actually performing and reproducing it. Likewise, no synthetic case is relabelled as third-party evidence.

## M2 — Prior Software Change Contracts terminology

**Reviewer concern.** The paper uses *Semantic Change Contract*, while prior work by Yi, Qi, Tan, and Roychoudhury uses *Software Change Contracts* for intended cross-version behavioral/structural changes.

**Disposition: addressed.**

Related Work now cites both the ISSTA 2013 paper and the extended TOSEM 2015 article and distinguishes the objects being contracted:

- Software Change Contracts constrain intended changes across program versions using change-oriented specifications;
- Patch Semantic Change Contracts constrain runtime application-state mutation effects derived from Patch's modeled mutation route.

The manuscript explicitly states that the term `change contract` itself is not claimed as novel. The terminology is retained because the distinction is now explicit and because `Semantic Change Contract` is already defined narrowly as inferred Change Signature plus declared Change Capability policy.

## M3 — Executable checker soundness versus completeness

**Reviewer concern.** `PatchChecker.lean` proved that executable acceptance implies the relational policy judgment, but the converse had not been stated. Calling the checker simply `verified` could leave open whether the executable and relational semantics diverge through false negatives.

**Disposition: addressed formally.**

The formalization now includes:

- `withinBool_complete`;
- `allowsBool_complete`;
- `allowsBool_iff`;
- `anyRuleAllows_complete`;
- `policyAllowsBool_complete`;
- `policyAllowsBool_iff`.

For the modeled Effect/Rule fragment, the one-rule checker therefore returns true iff `Allows` holds, and the complete signature checker returns true iff `PolicyAllows` holds. These results preserve the fail-closed rule that unknown magnitude cannot satisfy a bounded rule.

The complete formal workflow, including every generated static/runtime/call-tree certificate and the unfinished-proof gate, passes with these additions.

## M4 — Define the target-only ablation independently

**Reviewer concern.** The manuscript described the ablation conceptually but left its executable semantics primarily in the artifact.

**Disposition: addressed.**

Section 7.1 now gives a self-contained rule. For policy `p` protecting recipe `f`, `A(p)` is the set of authorized target/field paths and `R(f)` is the set of reachable changed paths obtained by following known helper calls and traversing branches. The target-only ablation accepts exactly when `R(f) ⊆ A(p)` for each protected recipe and a policy exists.

The definition also states what is retained and erased:

- retained: target/field identity and transitive call reachability;
- erased: operation kind, amount, amount range, and proof of range;
- fail closed: missing protected recipes and unresolved/recursive helper calls yield sentinel escape paths.

This mirrors `src/security-case-study.js`, the implementation that produces the reported matrix.

## M5 — Tie finite-call/runtime assurance to the central claim

**Reviewer concern.** The interprocedural and invocation-frame sections risk reading as accumulated assurance features rather than evidence needed by the Change/authority contribution.

**Disposition: addressed.**

The manuscript now motivates the finite-call layer as testing whether semantic target/operation/magnitude authority survives helper propagation. The runtime section is introduced as the dynamic counterpart: repeated invocations of one lexical call chain must remain distinct while retaining the effect/signature relationship. The conclusion repeats this connection rather than listing call/runtime machinery as unrelated functionality.

## Minor comments

- **Process-history wording:** removed `previous drafts called it persistent state`; `application state` is defined directly.
- **Future submission placeholders:** removed/recast. The current revision names its immutable Git commit and does not invent an archival DOI.
- **Doubled Related Work punctuation:** paragraph-title periods removed.
- **Application terminology:** `two larger application domains` replaced with `two multi-state application cases`.
- **AI discussion:** the in-body subsection is limited to research/development provenance; manuscript-preparation use remains in the separate declaration before References.
- **Artifact archive:** an archival DOI is still not fabricated. A final archival snapshot remains an optional submission-strengthening step if one is created before upload.

## Validation status

- Formal checker completeness/equivalence and all existing generated certificates: **validated by the full Lean CI workflow**.
- Manuscript bibliography now includes the direct Software Change Contracts prior line.
- Target-only semantics in the text were checked against `src/security-case-study.js`.
- The journal PDF remains subject to the Paper CI citation/reference and layout-overflow gates after these edits.

## Remaining substantive work

The unresolved Round-5 request is intentionally empirical rather than editorial: a genuine public real-code mutation corpus (or a fair implemented/formal competing-system study) would materially improve external validity. It should only be added if performed reproducibly. Controlled fixed-machine cost measurements remain a second useful empirical extension; hosted CI timings are still not treated as performance evidence.

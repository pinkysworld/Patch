# Internal peer-review round 6 — empirical transfer and claim discipline

This is an internal adversarial reviewer-perspective round, not journal peer review. It evaluates the manuscript after Round 5 and specifically challenges the new public real-code mutation audit before its results are allowed to widen the paper's claims.

## Reviewer profile A — empirical software engineering / PL evaluation

### Major comment A1 — A hand-picked corpus can become confirmation theater

A six-project study cannot support prevalence claims, and post-hoc selection of convenient mutation sites could make almost any language look applicable. The paper must state how projects/sites were selected, freeze the project revisions, cap observations per project, exclude tests/local temporaries, and say explicitly that resulting ratios describe the audit rather than an ecosystem.

**Disposition: adopted.** The study is explicitly a *purposive maximum-variation audit*, fixes six public projects and three production retained-state observations per project, pins each project to a full commit SHA, documents inclusion/exclusion rules, and prohibits prevalence/developer-effort inference.

### Major comment A2 — “Operation vocabulary match” is too weak to mean portability

Nearly any mutation can be described abstractly as set/add/remove/clear. Counting that alone would be misleading. JavaScript `Set`, `Map`, tries, dynamic keyed stores, callback filtering, spread insertion, and host-managed persistence must not be called direct Patch fits merely because a similar verb exists.

**Disposition: adopted.** The coding separates operation family from `local_surface_fit = direct | adapter | restructure`. `direct` is strict. Set/Map/trie semantics, dynamic targets, VS Code globalState, Node-RED context maps, filter replacement, and spread insertion remain adapter/restructure cases.

### Major comment A3 — Whole-update context can invalidate a locally simple translation

A scalar `count++` may be locally trivial yet participate in a consistency invariant with another structure. The study should preserve that surrounding fact instead of splitting only easy statements into favorable rows.

**Disposition: adopted.** Each observation also records a context constraint. GitLens count changes are locally direct numeric shapes but are coded `coupled_multi_target` because they accompany trie insertion/deletion. Dataview deletion likewise records a multi-index/revision coupling. Same-target rebuilds and dynamic batches are also explicit.

### Major comment A4 — Do not turn external-code resemblance into a formal-verification claim

A real-world `x += 1` having the same shape as a Lean theorem does not mean the external TypeScript program is proved or even translated into Patch.

**Disposition: adopted.** The field is named `lean_fragment_shape_match`, and both artifact and manuscript state that it is only a local shape classification. The external programs are neither translated nor certified by Lean.

### Major comment A5 — Source provenance must be independently auditable

A reviewer should be able to verify the exact source evidence without trusting copied snippets in the manuscript.

**Disposition: adopted.** `corpus.json` records repository, full commit SHA, path, context and a short anchor. The source projects are not vendored. `verify-real-code-sources.js` optionally resolves immutable raw GitHub URLs and checks the recorded anchors; deterministic corpus/result validation works offline.

## Reviewer profile B — skeptical programming-languages reviewer

### Major comment B1 — The external audit does not resolve the stronger comparison question

The study can show that some public mutation shapes align with Patch and identify current friction, but it does not show that mandatory Change is better than a conventional language plus effects, permissions, refinement types, instrumentation, or event sourcing.

**Disposition: accepted limitation.** The manuscript must retain its non-superiority claim. A fair implemented/formal comparison with a representative modern effect/capability approach remains future strengthening work.

### Major comment B2 — The empirical result should be framed as mixed evidence, not validation success

Five direct local fits versus thirteen adapter/restructure cases is important negative evidence. The paper should report it plainly. The non-standalone contexts also reveal that atomic multi-target Change, dynamic paths, and richer collection semantics matter in realistic code.

**Disposition: adopted.** The study is presented as an external mutation-shape audit with both positive and negative findings. The paper does not collapse adapter/restructure cases into successes.

### Major comment B3 — Do not let the audit silently widen the core claim surface

The current RQ3 is mechanism isolation and explicitly disclaims ecological inference. The audit must be visible and synchronized with the abstract/conclusion, but making it a new central RQ could imply a stronger generalization study than a six-project purposive audit can support.

**Disposition: adopted with modification.** The manuscript adds a dedicated **Public Real-Code Mutation Audit** section and an explicit exploratory audit finding rather than promoting the study to a fourth core RQ. The three original RQs remain the formal/mechanism questions. This keeps the audit prominent while preserving its deliberately weaker generalization status.

## Reviewer profile C — journal editor / reproducibility reviewer

### Major comment C1 — Generated counts must not be hand-maintained prose only

If the manuscript says 5 direct / 11 adapter / 2 restructure and 3 Lean-shape matches, those counts should be regenerated from the frozen coding manifest and checked in CI.

**Disposition: adopted.** `scripts/evaluate-real-code-mutations.js` validates the protocol and deterministically regenerates `studies/real-code-mutations/results.json`; Paper CI runs the `--check` mode.

### Major comment C2 — Network availability should not make manuscript CI fragile

Verifying external GitHub anchors is useful, but a journal PDF build should not fail because GitHub raw content is temporarily unavailable.

**Disposition: adopted.** Offline corpus/result consistency is mandatory in Paper CI. Pinned-source network verification remains an explicit optional command.

### Major comment C3 — No inter-rater reliability claim is available

The coding is author-led, with AI assistance in locating/challenging cases. Without an independent second coder there is no defensible Cohen's kappa or similar reliability statistic.

**Disposition: adopted.** The study reports this as a classification-validity limitation and makes no inter-rater reliability claim.

## Round-6 decision

The study is worth including because it directly addresses the previous manuscript's strongest external-validity gap while producing mixed, falsifiable evidence rather than a uniformly favorable showcase. It should strengthen the paper only if the manuscript keeps four boundaries explicit:

1. purposive counts are descriptive, not prevalence estimates;
2. local operation-family alignment is weaker than direct source portability;
3. Lean shape matching is not verification of third-party code;
4. the study does not establish superiority, migration cost, performance, usability, or security benefit.

With those boundaries, the empirical audit materially improves the journal manuscript. A larger independently coded corpus would still be a valuable later extension.

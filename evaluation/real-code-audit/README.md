# Public real-code mutation audit

This directory contains the small, commit-bound external-code audit used to strengthen the applicability discussion of **Paper 1**. It is deliberately not presented as a statistically representative mining study, a migration study, or evidence that Patch already integrates with the audited projects.

## Question

The audit asks a narrow question: when mature public applications update state, does the observed mutation shape resemble the single-target semantic `Change` route studied in Paper 1, or does it expose a boundary that the paper must state explicitly?

The classification is architectural rather than syntactic. It does not claim that TypeScript/JavaScript code can be compiled as Patch source and it does not extend the beta.32 Lean theorem.

## Frozen corpus

The manifest freezes concrete source paths and repository commits from three mature public projects with different state styles:

- Excalidraw at `e1bb9ff8f8931e783c11d104abb8967ac6605c9a`, application-owned React/editor state;
- VS Code at `004a1fbb1658e61048b29d76e2ce380adfa18680`, extension Memento/global state;
- JupyterLab at `9312e29b7bbc95ef905b96afe00c93361943f2f6`, application collections plus `IStateDB` persistence.

Candidate files were located with state-specific searches (`setState`, `globalState.update`, and `stateDB.save`) and then frozen in `corpus.csv`. JupyterLab's recents manager is additionally inspected at the local collection operations that precede its host-state save. The manifest stores a textual anchor for each audited site so the classification can be checked against the exact frozen source.

This is purposeful diversity sampling, not random sampling. The corpus was chosen to expose at least three distinct mutation contexts: ordinary application-owned state, collection mutation, and foreign host-backed persistence. It therefore supports qualitative applicability and limitation claims only.

## Classification

Each site receives one primary semantic shape and one state-ownership class.

`single-target-set`, `single-target-add`, and `single-target-remove` identify updates whose state-transition meaning maps naturally to the current Patch semantic verbs at the architectural level. `multi-target-bundle` identifies one source update that changes several related fields together. Paper 1 does not claim atomic multi-target ChangeSets, so these are counted as a boundary rather than silently decomposed and reported as supported.

`application-owned` means the observed state is ordinary application/editor state. `host-backed` means the commit is performed by an external state service such as VS Code `Memento` or JupyterLab `IStateDB`. A host-backed site's semantic shape may still be a simple set, but Patch does not currently own that commit route. Such sites are therefore classified as `adapter-boundary`, not as end-to-end Patch support.

## Frozen observations

The current manifest contains 15 audited sites:

- 12/15 are single-target semantic updates: ten set-like updates, one collection add, and one collection remove;
- 3/15 are multi-target bundles from Excalidraw;
- 8/15 operate on application-owned state;
- 7/15 cross a host-backed persistence boundary;
- 5/15 are both application-owned and single-target and are marked `direct` at the architectural level;
- 7/15 have a simple single-target semantic shape but remain `adapter-boundary` because the actual commit belongs to a foreign host API;
- 3/15 are `boundary` because a source-level update groups multiple related targets and Paper 1 makes no atomic grouping claim.

These counts are descriptive of this frozen corpus only. They must not be generalized to all JavaScript/TypeScript systems.

## What the audit supports

The useful result is not a large coverage percentage. It is the separation of three claims that are easy to conflate:

1. **semantic fit:** many observed sites have a compact set/add/remove transition meaning that can be represented by a semantic delta;
2. **commit-route ownership:** a semantic fit does not make Patch the actual commit route when the state belongs to an external host service;
3. **grouping boundary:** multi-field updates may require atomic or relational grouping if intermediate visibility matters, which is intentionally follow-on work rather than a Paper 1 contribution.

That distinction strengthens Paper 1 because it provides real public examples for both the architectural hypothesis and its present limits.

## Reproduction and review

Review `corpus.csv` against the exact commits and anchors listed there. A future automation may verify anchors and hashes, but the present audit is intentionally simple enough to inspect manually. If the corpus changes, its counts and paper table must be regenerated together and the new source commits must be frozen rather than silently following repository heads.

## Claim boundary

This audit is not evidence of third-party Patch execution, a complete extension ecosystem, certified adapters, atomic ChangeSets, usability, or performance. It does not change any Lean theorem. Relational ChangeSets and certified host adapters remain separate follow-on research topics.
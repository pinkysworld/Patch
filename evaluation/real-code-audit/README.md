# Public-code mutation-shape stress test

This directory contains the small, commit-bound public-code stress test used for **Paper 1**. It is deliberately not a statistically representative mining study, a migration study, an integration test, or evidence that Patch already works with the inspected projects. None of Excalidraw, VS Code, or JupyterLab is translated to or executed by Patch in this study.

## Question

The stress test asks a narrow architectural question: when mature public applications update state, can the observed transition be described by the current single-target Patch `Change` abstraction, or does the example expose a boundary that Paper 1 must state explicitly?

For each site, two questions are kept separate:

1. **representational fit:** can the transition be described as one logical target with a set/add/remove semantic operation?
2. **commit-route ownership:** would Patch actually own that persistent-state commit, or is it performed by a foreign host API?

The classification is architectural rather than syntactic. It does not claim that TypeScript/JavaScript code can be compiled as Patch source and it does not extend the beta.32 Lean theorem.

## Frozen corpus

The manifest freezes concrete source paths and repository commits from three mature public projects with different state styles:

- Excalidraw at `e1bb9ff8f8931e783c11d104abb8967ac6605c9a`, application-owned React/editor state;
- VS Code at `004a1fbb1658e61048b29d76e2ce380adfa18680`, extension Memento/global state;
- JupyterLab at `9312e29b7bbc95ef905b96afe00c93361943f2f6`, application collections plus `IStateDB` persistence.

Candidate files were located with state-specific searches (`setState`, `globalState.update`, and `stateDB.save`) and then frozen in `corpus.csv`. JupyterLab's recents manager is additionally inspected at the local collection operations that precede its host-state save. The manifest stores a textual anchor for each site so the classification can be checked against the exact frozen source.

This is purposeful diversity sampling, not random sampling. The corpus was chosen to expose at least three distinct mutation contexts: ordinary application-owned state, collection mutation, and foreign host-backed persistence. It therefore supports qualitative representational and boundary claims only.

## Classification

Each site receives one primary semantic shape and one state-ownership class.

`single-target-set`, `single-target-add`, and `single-target-remove` identify updates whose state-transition meaning maps naturally to the current Patch semantic verbs at the architectural level. `multi-target-bundle` identifies one source update that changes several related fields together. Paper 1 does not claim atomic multi-target ChangeSets, so these are counted as a boundary rather than silently decomposed and reported as supported.

`application-owned` means the observed state is ordinary application/editor state. `host-backed` means the commit is performed by an external state service such as VS Code `Memento` or JupyterLab `IStateDB`. A host-backed site's semantic shape may still be a simple set, but Patch does not currently own that commit route. Such sites are therefore classified as `adapter-boundary`, not as end-to-end Patch support.

A concrete example is VS Code `globalState.update(key, true)`. Its state-transition shape resembles a Patch operation such as `change flag: set true`. That resemblance is exactly what the representational question records. It does **not** mean Patch performs the update: VS Code Memento still owns the actual persistent commit.

## Frozen observations

The current manifest contains 15 inspected sites:

- 12 are single-target semantic updates: ten set-like updates, one collection add, and one collection remove;
- 3 are multi-target bundles from Excalidraw;
- 8 operate on application-owned state;
- 7 cross a host-backed persistence boundary;
- 5 are both application-owned and single-target and are marked `direct` at the architectural level;
- 7 have a simple single-target semantic shape but remain `adapter-boundary` because the actual commit belongs to a foreign host API;
- 3 are `boundary` because one source-level update groups multiple related targets and Paper 1 makes no atomic grouping claim.

These counts describe only this frozen purposeful sample. They are not coverage percentages and must not be generalized to JavaScript/TypeScript systems or to real-world software overall.

## What the stress test supports

The useful result is the separation of three claims that are easy to conflate:

1. **representational fit:** some observed public-code mutations have a compact set/add/remove transition meaning matching the shape studied by Patch;
2. **commit-route ownership:** representational fit does not make Patch the actual commit route when persistence belongs to an external host service;
3. **grouping boundary:** multi-field updates may require atomic or relational grouping if intermediate visibility matters, which is intentionally follow-on work rather than a Paper 1 contribution.

This strengthens Paper 1 only as a modest external-plausibility and boundary check. It is not evidence that Patch can compile, host, or replace the inspected systems.

## Reproduction and review

Review `corpus.csv` against the exact commits and anchors listed there. A future automation may verify anchors and hashes, but the present stress test is intentionally simple enough to inspect manually. If the corpus changes, its counts and paper table must be regenerated together and the new source commits must be frozen rather than silently following repository heads.

## Claim boundary

This stress test is not evidence of third-party Patch execution, source compatibility, migration feasibility, a complete extension ecosystem, certified adapters, atomic ChangeSets, usability, or performance. It does not change any Lean theorem. Relational ChangeSets and certified host adapters remain separate follow-on research topics.
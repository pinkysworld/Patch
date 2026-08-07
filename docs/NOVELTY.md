# Novelty Boundary

Patch is **not** novel because it has patches, undo, history, change propagation, or friendly English-like keywords. Those ideas all have substantial prior art.

The research hypothesis is narrower:

> **semantic change as the exclusive persistent-mutation primitive of a deliberately low-complexity general-purpose language, with uniform history/inversion/preview/conflict services derived from that semantics rather than separately programmed by the user.**

## Closest families of prior work

### Edit lenses and bidirectional transformations

Edit lenses model edits as first-class operations and translate edits between related structures. Patch differs in goal: it is not primarily a consistency language between source/view structures. It asks whether semantic edits can replace ordinary mutable assignment as the default mutation semantics of a small general-purpose language.

### Incremental computation and change structures

Incremental calculi formalize changes and derivatives so outputs can be updated efficiently from input changes. Patch's change records instead describe programmer-visible state evolution and drive transparency/tooling rather than primarily avoiding recomputation.

### Self-adjusting computation

Self-adjusting systems track dependencies and propagate input mutations. Patch does not currently perform automatic dependency propagation. It makes the original state mutation itself explicit and inspectable.

### Patch theory / version control

Darcs and formal patch theories study composition, commutation, inversion, dependency, and conflict of repository edits. Patch borrows the idea that changes deserve algebraic structure, but applies it to runtime program state and hides the algebra from ordinary beginner code.

### Reversible programming

Patch is not a reversible language. Arbitrary computation need not run backward; only supported state-change primitives get generated inverses.

### Event sourcing

Event-sourced systems derive state from an event log. Patch is related, but the log is a language-semantic consequence of mutation rather than an application architecture the programmer must adopt.

### CRDTs

CRDTs provide convergence for well-defined distributed update types. Patch beta makes no convergence claim. Its conflict relation is intentionally conservative.

### Educational languages

Teaching languages optimize learnability and immediate feedback. Patch's educational hypothesis is specific: explicit `change` blocks may reduce conceptual distance for mutable state while also exposing semantics useful for professional tooling.

## Candidate novelty claim

A defensible paper claim is:

> We present Patch, a general-purpose experimental language in which persistent mutation is expressible only through explicit semantic changes. The same normalized change representation drives state transition, inverse generation, preview, history, and conflict analysis while the surface language exposes only a small beginner-oriented vocabulary. We formalize Mutation Transparency and evaluate whether this mutation model provides structural tooling benefits without increasing novice programming burden.

## What would invalidate the claim?

Before submission we must determine whether an earlier language already satisfies all of the following:

1. general-purpose rather than a version-control, database-view, or synchronization DSL;
2. existing persistent state cannot mutate except through a semantic change construct;
3. the runtime reifies every such mutation into a structured change value;
4. the same semantic representation is used for several derived facilities such as inversion, replay, preview, and conflict reasoning;
5. the user-facing language deliberately hides patch algebra from ordinary programming;
6. the system evaluates this model for novice or low-complexity programming.

Finding a system that meets all six would materially weaken Patch's novelty claim.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar, and arXiv for combinations of: `semantic change programming language`, `first-class edits`, `first-class patches`, `edit-oriented programming`, `change-oriented programming`, `patch algebra mutable state`, `mutation transparency`, `edit lenses`, and `change structures`.

## Current positioning

The strongest paper sits between Programming Languages and HCI/CS Education. The PL side contributes the formal mutation model, change algebra, replay/inversion properties, and implementation. The HCI side contributes low conceptual distance, novice comprehension, and explainability of state evolution.

The novelty must be demonstrated by the combination and evaluation, not asserted from terminology.

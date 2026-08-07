# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, change propagation, a live IDE, or English-like syntax. All of those have substantial prior art.

The current research hypothesis is narrower:

> **ordinary runtime mutation is factored through a semantic Change IR that is the exclusive route for persistent application-state evolution, while the same representation drives execution, inversion, preview, replay foundations, GUI state refresh, history and conflict reasoning without exposing patch algebra to beginners.**

## Important prior-art collisions

### Change-oriented programming environments: ChEOPS and COPE

Change-oriented software engineering and environments such as ChEOPS/COPE make *software-development/source-code changes* first-class so programmers and tools can record, replay, compose and reason about program transformations. This is close enough that Patch must cite it prominently and must not claim to invent “change-oriented programming.”

Patch's intended distinction is the semantic layer being changed: Patch makes **runtime application-state mutation** pass through semantic changes as part of language execution. Its research question is not primarily how a developer edits the program source.

### Edit transactions and live programming

Edit Transactions and related live-programming systems reify controlled updates to the running program/system description. Patch should treat them as close conceptual neighbors. Again, the claimed distinction is that Patch's `change` terms are the ordinary mutation semantics of application values, not primarily scoped edits to program definitions.

### Elm/Redux-style update architectures

Message/reducer architectures centralize application-state transitions and can enable history/debugging. Patch must not claim that explicit state transitions in applications are new. The difference to test is whether the guarantee can be made **language-semantic and complete**: existing persistent bindings cannot bypass the Change IR through an ordinary assignment escape hatch, and the compiler/runtime derives a normalized semantic change representation automatically.

### Edit lenses and bidirectional transformations

Edit lenses model edits as first-class operations and translate edits between related structures. Patch is not primarily a source/view consistency language. It asks whether semantic edits can replace ordinary mutable assignment as the default runtime-state semantics of a small general-purpose language.

### Incremental computation and change structures

Incremental calculi formalize changes and derivatives so outputs can be updated efficiently from input changes. Patch's change values describe programmer-visible state evolution and currently target transparency/tooling rather than primarily avoiding recomputation.

### Patch theory and version control

Darcs and formal patch theories study composition, commutation, inversion, dependency and conflict of repository edits. Patch borrows the broad insight that changes deserve algebraic structure, but applies it to runtime program state and hides the algebra from ordinary source programs.

### Event sourcing and command patterns

Event-sourced systems derive state from an event log, and command objects can encode undoable actions. Patch is related, but the change history is intended to be a consequence of language semantics rather than application architecture that programmers manually implement.

### Reversible programming

Patch is not a reversible language. Arbitrary computation need not run backward. Only supported state-change primitives receive generated inverses.

### CRDTs

CRDTs provide convergence for well-defined distributed update types. Patch beta makes no convergence claim. Its conflict relation is conservative and must be proved only for the cases it classifies as commuting.

## Stronger formal contribution candidate

The strongest PL story is no longer simply “Mutation Transparency.” It is a small **change calculus** plus a compiler factorization result.

### State-Change Factorization

For every well-typed source step that mutates existing persistent state from `S` to `S'`, compilation/execution produces a semantic change `delta` such that:

```text
apply(delta, S) = S'
```

and the state transition is committed only through `apply`.

This is stronger than logging a mutation after it happened: **the semantic change is the mutation mechanism.**

### Mutation Transparency

Every committed post-creation mutation corresponds to an inspectable semantic change carrying the target, base/new versions and normalized operations.

### Inverse correctness

For the declared invertible fragment:

```text
apply(inverse(delta), apply(delta, S)) = S
```

### Preview equivalence

Evaluating a valid change under preview from base state `S` produces the same proposed transition/change as committing it from the same base state, while leaving committed state/history unchanged.

### Replay consistency

For the deterministic fragment, replaying a version-consistent change history from the same initial state reproduces the same final state.

### Commutation soundness

When Patch's analyzer declares two changes independent/commuting from the same base state, applying them in either order yields observationally equivalent resulting state. Unsupported cases must be classified conservatively rather than guessed.

These properties are more useful for a high-venue paper than the existence of an IDE or friendly syntax alone.

## Candidate novelty claim

A defensible submission claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation is compiled into and executed through a normalized semantic Change IR, with no ordinary assignment escape hatch for existing persistent values. The same representation drives state transition, generated inversion, preview, history, replay foundations, GUI state evolution and conservative conflict reasoning, while the source language exposes a small beginner-oriented vocabulary. We formalize state-change factorization and associated change laws, then evaluate whether this design provides structural tooling benefits without increasing novice programming burden.

## What would invalidate or materially weaken the claim?

Before submission we must determine whether an earlier system already satisfies most of the following combination:

1. general-purpose runtime programming rather than primarily source evolution, version control or a database/view DSL;
2. existing persistent application state cannot mutate outside the semantic change mechanism;
3. the mutation transition itself is executed through a reified/normalized change, not merely logged afterward;
4. one representation is reused for multiple facilities such as inversion, preview, replay, UI evolution and conflict analysis;
5. the core properties are formalized/proved rather than presented only as tooling behavior;
6. the language deliberately keeps the patch/change algebra outside the beginner surface;
7. the model is empirically evaluated for practical or novice programming.

Finding a language that meets the central items 1-5 would substantially narrow the novelty claim.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv for combinations of:

`change-oriented programming`, `ChEOPS`, `COPE programming environment`, `first-class changes`, `first-class edits`, `edit transactions`, `runtime state changes programming language`, `semantic mutation`, `change calculus mutable state`, `event sourcing language semantics`, `reducer language state`, `patch algebra mutable state`, `mutation transparency`, `edit lenses`, `change structures`, `reversible updates`, `live programming state history`.

## Current positioning

Patch is still a plausible high-venue research direction, but **not yet a high-venue paper**. The high-end PL story should center on State-Change Factorization + Change IR + mechanized properties + a substantial artifact. Patch Studio, mobile development and GUI compilation make the artifact compelling, but are supporting engineering contributions rather than substitutes for formal novelty.

A second empirical axis can test whether the low-complexity syntax and integrated change debugger improve comprehension. If those results are unusually strong, a PL/HCI venue story may become stronger than a pure PL story.

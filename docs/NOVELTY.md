# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, explicit state transitions, effect inference, capabilities, a live IDE, or English-like syntax. All of those have substantial prior art.

The current research hypothesis has two linked layers:

> **State-Change Factorization:** ordinary persistent mutation is factored through a semantic Change IR that is the exclusive route for post-creation application-state evolution.

and:

> **Semantic Change Contracts:** because mutation already has semantic operation structure, the compiler can infer a Change Signature for a recipe and optionally prove that its possible committed changes are contained in a declared semantic Change Capability policy.

The candidate contribution is the combination, not any one ingredient in isolation.

## Important prior-art collisions

### Plaid: first-class state change

Sunshine et al.'s OOPSLA 2011 paper *First-Class State Change in Plaid* makes changing abstract object states a central programming-language concept and gives formal semantics for state transitions/state composition.

Patch therefore must **not** claim to invent first-class state change, explicit state transitions, typestate-oriented programming, or language-level state evolution.

Patch's intended distinction is a normalized delta/Change IR through which ordinary persistent value mutation itself executes, with operation structure reused for several services and analyses.

Reference: DOI 10.1145/2048066.2048122.

### Worlds: reified program state, speculation and undo

Warth et al.'s *Worlds: Controlling the Scope of Side Effects* (ECOOP 2011) reifies whole program state, supports speculative nested worlds and commit/discard, and naturally enables undo-like behavior.

Patch cannot claim that reifying state, speculative execution, commit/discard, or automatic undo is new.

Reference: DOI 10.1007/978-3-642-22655-7_9.

### Classical effect systems

Lucassen and Gifford's *Polymorphic Effect Systems* (POPL 1988) is essential prior art. Type-and-effect systems infer conservative approximations of side effects and regions of store that expressions may affect.

Patch therefore cannot claim that automatically inferring "what a function may change" is new.

The candidate distinction is granularity derived from Patch's mandatory semantic mutation operations. A Change Signature may distinguish, for the same persistent path:

```text
increase by 5
decrease by 2
set
clear
```

rather than only a generic read/write region effect. Whether this distinction is genuinely new or merely an instance of richer behavioral effects must be tested systematically.

Reference: DOI 10.1145/73560.73564.

### Effects as Capabilities / Effekt

Brachthaeuser, Schuster and Ostermann's OOPSLA 2020 work *Effects as Capabilities* explicitly combines effect information and capabilities. Patch therefore must **not** claim that "effects plus capabilities" is new.

Patch's Change Capability proposal is narrower: a policy constrains which semantic persistent-state transitions a recipe may commit. For example:

```patch
player.score may increase up to 10
```

can reject `set player.score` even though both are writes to the same location.

Reference: DOI 10.1145/3428194.

### Capability, permission and typestate systems

Ownership, capability, permission, typestate and behavioral type systems can restrict what code may do to resources and how state may evolve. Patch must compare against these families before any firstness claim.

The possible distinction is that the authority is checked directly against the semantic deltas already required for normal mutation, rather than adding an independent resource-state protocol to an otherwise conventional assignment model.

### XMF first-class undoability

XMF documents VM-level capture/reversal of state changes. Patch's novelty cannot rest on automatic undo.

### ChEOPS / COPE / Edit Transactions

Change-oriented programming/source-evolution systems make software-development changes first-class. Patch's focus is runtime application-state mutation, not primarily edits to source definitions.

### Elm/Redux-style update architectures and event sourcing

Reducer/message architectures and event sourcing centralize application-state transitions and enable history/debugging. Patch cannot claim centralized updates or event histories are new. Its stronger claim is language-semantic completeness: existing persistent bindings have no ordinary assignment escape hatch around the Change IR.

### Edit lenses, change structures and patch theory

Edit lenses explicitly model edits between related structures; higher-order change structures support incremental computation; formal patch theories study composition, inversion and commutation. Patch borrows the broad insight that changes deserve semantic structure.

### CRDTs

CRDTs provide convergence for specific distributed data types. Patch beta makes no general convergence claim.

## Formal contribution candidates

### State-Change Factorization

For every well-typed supported source step that mutates existing persistent state from `S` to `S'`, execution produces `delta` such that:

```text
apply(delta, S) = S'
```

and the store transition commits only through that semantic change.

### Mutation Transparency

Every committed post-creation mutation has an inspectable semantic change matching the transition.

### Change Signature Soundness

For recipe `f`:

```text
RuntimeChanges(f) subset-of Sig(f)
```

where `Sig(f)` is a conservative semantic effect summary inferred by the compiler.

### Change Capability Soundness

For a capability-protected recipe accepted by the compiler:

```text
Sig(f) subset-of Cap(f)
```

and therefore, if Signature Soundness holds:

```text
RuntimeChanges(f) subset-of Cap(f)
```

The interesting semantic distinction is that rules may constrain operation kind and magnitude, not merely whether a location is writable.

### Other supporting properties

- inverse correctness for the invertible fragment;
- preview non-interference/agreement;
- deterministic replay consistency;
- soundness of certified commuting changes.

## Candidate novelty claim

A defensible current claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation is executed through a normalized semantic Change IR rather than ordinary assignment plus logging. The compiler reuses that mandatory representation to infer semantic Change Signatures and can check optional Change Capabilities that constrain the operation and, when statically provable, magnitude of changes to persistent paths. The same change representation also drives history, inversion, preview, replay foundations, GUI state evolution and conservative conflict reasoning, while the beginner-facing language remains deliberately small.

This is a **candidate claim**, not a priority assertion.

## What would materially weaken the claim?

An earlier general-purpose language/system satisfying most of the following would substantially narrow Patch's contribution:

1. ordinary existing persistent state cannot mutate outside a structured semantic change mechanism;
2. mutation executes through the structured change rather than being logged afterward;
3. the change contains semantic operation structure more precise than only a location write;
4. compiler-inferred component summaries conservatively describe those semantic changes;
5. policies constrain which semantic changes a component may emit, including operation-sensitive restrictions on the same path;
6. one representation is reused for inversion/preview/replay/tooling;
7. the system provides formal soundness evidence and practical evaluation.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv for combinations of:

`first-class state change`, `typestate`, `behavioral types`, `effect systems state updates`, `update effects`, `write effects`, `semantic effects`, `effects as capabilities`, `capability type systems`, `permission systems`, `bounded effects`, `state transition permissions`, `operation capabilities`, `change-oriented programming`, `runtime state changes`, `edit lenses`, `change structures`, `patch algebra mutable state`, `event sourcing language semantics`, `reducer state transitions`.

## Current positioning

The new Change Signature/Capability layer **improves the high-venue story**, but it also broadens the prior-art burden. The paper can no longer simply say "Patch knows what changes." Effect systems have done conservative effect inference for decades, and capability/effect combinations are established research.

The strongest possible story is instead:

1. State-Change Factorization gives Patch an unusually explicit semantic mutation substrate;
2. semantic operation-aware signatures are derived from that substrate;
3. semantic capabilities constrain operation kind/magnitude over the same path;
4. mechanized soundness shows the analysis actually constrains runtime committed changes;
5. evaluation shows useful security/tooling benefits with low programmer burden.

Patch remains a plausible high-venue research direction, but **not yet a high-venue paper**. Product polish, mobile development and GUI compilation strengthen the artifact but do not substitute for formal novelty and measured evidence.

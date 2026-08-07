# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, explicit state transitions, effect inference, capabilities, a live IDE, range analysis, provenance, or English-like syntax. All of those have substantial prior art.

The current research hypothesis has two linked layers:

> **State-Change Factorization:** ordinary persistent mutation is factored through a semantic Change IR that is the exclusive route for post-creation application-state evolution.

and:

> **Semantic Change Contracts:** because mutation already has semantic operation structure, the compiler can infer a Change Signature and optionally prove that possible committed changes are contained in a declared semantic Change Capability policy.

The candidate contribution is the combination and the formal connection between these layers, not any one ingredient in isolation.

## Important prior-art collisions

### Plaid: first-class state change

Sunshine et al.'s OOPSLA 2011 paper *First-Class State Change in Plaid* makes changing abstract object states a central programming-language concept and gives formal semantics for state transitions/state composition.

Patch therefore must **not** claim to invent first-class state change, explicit state transitions, typestate-oriented programming, or language-level state evolution.

Patch's intended distinction is a normalized delta/Change IR through which ordinary persistent value mutation itself executes, with operation structure reused for static policy and runtime/tooling services.

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

and may additionally contain a proved amount interval. Whether this is a genuinely distinctive semantic-contract design or an instance of richer behavioral/graded/refinement effects must be tested systematically.

Reference: DOI 10.1145/73560.73564.

### Effects as Capabilities / Effekt

Brachthaeuser, Schuster and Ostermann's OOPSLA 2020 work *Effects as Capabilities* explicitly combines effect information and capabilities. Patch therefore must **not** claim that "effects plus capabilities" is new.

Patch's Change Capability proposal is narrower and state-transition oriented: a policy constrains which semantic persistent-state transitions code may commit. For example:

```patch
player.score may increase up to 10
```

can reject `set player.score` even though both are writes to the same location.

Reference: DOI 10.1145/3428194.

### Capability, permission, refinement and typestate systems

Ownership, object-capability, permission, typestate, refinement, graded-effect and behavioral type systems can restrict what code may do to resources and how state may evolve. Patch must compare against these families before any priority claim.

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

## Formal contribution status

### State-Change Factorization

For the current Lean machine, every modeled state-changing step is witnessed by a well-formed semantic change and commits through the single change path. This is machine checked.

### Mutation Transparency

Every such formal mutation has an inspectable change witness in resulting history. This is machine checked.

### Change Signature Soundness

For the new structured Lean control-flow core:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
```

is now machine checked. The core contains sequencing, branch choice, and bounded repetition. The static signature may over-approximate untaken branches but cannot miss an emitted runtime semantic effect.

This is a theorem about the formal core, not yet a verification theorem about the full JavaScript analyzer.

### End-to-end Change Capability Soundness

For a protected formal statement whose inferred signature is admitted by a semantic policy, Lean now proves:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

The earlier beta-3 composition theorem took signature coverage as an assumption. Beta 4 proves that coverage from the formal execution semantics and static inference function for the structured core.

### Remaining critical bridge

The next major theorem is **production correspondence**:

> For the supported Patch subset, the JavaScript parser/analyzer/lowering produces semantic effects corresponding to the Lean representation and therefore preserves the proved signature and capability judgments.

Possible implementation strategies include a direct compiler correspondence proof, translation validation, or a small verified checker over emitted Change IR evidence.

## Supporting properties, not primary novelty claims

- magnitude/range analysis for bounded semantic changes;
- inverse correctness for the invertible fragment;
- preview non-interference/agreement;
- deterministic replay consistency;
- soundness of certified commuting changes;
- causal provenance and `why` explanations.

These can strengthen the artifact and evaluation without being claimed as individually new.

## Candidate paper claim

A defensible beta-4 claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation is executed through a normalized semantic Change IR rather than ordinary assignment plus logging. The same mutation representation supports operation-sensitive and magnitude-aware semantic Change Contracts. For a mechanized structured core, we prove that runtime semantic changes are covered by the inferred Change Signature and that a protected execution cannot emit a semantic change outside its admitted capability policy. The production language retains a deliberately small surface syntax; compiler-to-formal correspondence remains an explicit next obligation.

This is a **candidate contribution claim**, not a priority assertion.

## What would materially weaken the claim?

An earlier general-purpose language/system satisfying most of the following would substantially narrow Patch's contribution:

1. ordinary existing persistent state cannot mutate outside a structured semantic change mechanism;
2. mutation executes through the structured change rather than being logged afterward;
3. the change contains semantic operation structure more precise than only a location write;
4. compiler-inferred component summaries conservatively describe those semantic changes;
5. policies constrain which semantic changes a component may emit, including operation-sensitive and quantitative restrictions on the same path;
6. the runtime/signature/policy chain has formal soundness evidence;
7. one representation is reused for inversion/preview/replay/provenance/tooling;
8. the system demonstrates practical advantages with measured evaluation.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv for combinations of:

`first-class state change`, `typestate`, `behavioral types`, `graded effects`, `quantitative effects`, `refinement effects`, `effect systems state updates`, `update effects`, `write effects`, `semantic effects`, `effects as capabilities`, `capability type systems`, `permission systems`, `bounded effects`, `state transition permissions`, `operation capabilities`, `change-oriented programming`, `runtime state changes`, `edit lenses`, `change structures`, `patch algebra mutable state`, `event sourcing language semantics`, `reducer state transitions`.

## Current positioning

Beta 4 materially improves the high-venue story because the central signature-coverage link is no longer merely aspirational in the formal core. But the prior-art burden remains substantial.

The strongest story is:

1. State-Change Factorization supplies an explicit mandatory mutation substrate;
2. operation- and magnitude-aware semantic signatures are derived from that substrate;
3. semantic capabilities constrain those same changes;
4. Lean proves runtime-signature-policy containment for a structured core;
5. compiler correspondence transfers that result to a useful executable subset;
6. security/engineering case studies show concrete benefit with low programmer burden.

Patch remains a plausible high-venue research direction, but **not yet a submission-ready high-venue paper**. Product polish, mobile development and GUI compilation strengthen the artifact but do not substitute for formal correspondence and measured evidence.

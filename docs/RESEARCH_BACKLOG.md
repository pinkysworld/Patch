# Patch Research Backlog

Status: active research roadmap, 2026-08-30

This backlog tracks research contributions that should grow **Patch the language and Patch Studio together**. It is intentionally separate from the RAD product backlog: a feature belongs here only when it can support a defensible research question, formal result, empirical study, or novel programming-environment interaction.

## Non-negotiable research principle: easy by default, powerful by opt-in

Patch must remain usable by a child or first-time programmer.

The beginner path stays small:

```patch
create number score = 0
change score:
  add 1
show score
```

Research features must obey these rules:

1. **No mandatory ceremony.** Ordinary programs do not need capabilities, invariants, proofs, adapters, budgets, or formal syntax.
2. **Natural words before notation.** Prefer readable forms such as `change together`, `keep ... the same`, and `make sure ...` over proof-oriented surface syntax.
3. **Progressive disclosure.** Patch Studio may reveal authority, proofs, invariants and causal structure only when the user asks for them or when a diagnostic needs them.
4. **One new concept at a time.** A beginner can learn `create -> change -> show` before recipes, contracts, atomic groups or provenance.
5. **Advanced features lower to the same semantic Change lineage.** Research power belongs in the compiler/runtime/Studio model, not in extra beginner-facing syntax.
6. **Friendly diagnostics.** Errors first explain what happened in ordinary language; formal details are an expandable second layer.
7. **Simplicity is measured.** New language proposals should track keyword count, required annotations, minimal-example length, and whether existing beginner examples remain unchanged.

See `docs/LANGUAGE_SIMPLICITY.md` for the gate applied to language proposals.

---

# R-A — Relational Atomic ChangeSets

Priority: **P0 research**
Paper potential: **very high**

## Research question

Can multiple state updates be committed as one semantic unit while a relational contract constrains the relationship between their before/after states?

## Motivation

The current language deliberately exposes one semantic Change per target. The public real-code mutation audit also found coupled multi-target mutation contexts. A transfer, cache/index update or quota adjustment can therefore be locally simple while requiring a relation across several updates.

## Beginner-facing design direction

Ordinary `change` remains unchanged. The optional advanced form should read naturally, for example:

```patch
change together called transfer:
  change source_balance:
    remove amount
  change destination_balance:
    add amount

  keep source_balance + destination_balance the same
  make sure source_balance >= 0
```

The exact syntax is **not frozen** until parser/runtime and usability constraints are tested. Internally this lowers to a ChangeSet with staged Changes plus relational checks.

## Semantic goals

- all-or-none commit;
- ordered member Changes with one ChangeSet identity;
- relational constraints over pre/post state;
- atomic undo/redo;
- history/provenance preserves both group and member Changes;
- capabilities can eventually constrain the complete ChangeSet relation;
- Lean model for atomicity, invariant preservation and relational authority.

## Stage plan

- [x] Stage 0 pure ChangeSet semantic prototype (`src/change-set.js`);
- [x] Stage 0 Change Plan model for Studio (`src/change-plan.js`);
- [x] tests for atomic success/failure, invariant preservation and inverse restoration;
- [ ] parser syntax behind an experimental language-version gate;
- [ ] interpreter integration with grouped history/undo/redo;
- [ ] Change IR version bump with explicit `CHANGE_SET`;
- [ ] compiler analysis derives member effects and relational requirements;
- [ ] Lean ChangeSet model and atomicity theorem;
- [ ] Lean invariant-preservation theorem for supported expressions;
- [ ] Patch Studio Change Plan / Invariant Inspector;
- [ ] external evaluation using coupled cases from the real-code audit.

Potential paper:

> **ChangeSets: Relational and Atomic State Mutation in Change-Oriented Programming**

---

# R-B — Least-Authority Change Capability Inference

Priority: **P0/P1 research**
Paper potential: **very high**

Infer the smallest capability sufficient for a recipe over:

- target/path;
- operation direction;
- bounded magnitude;
- transitive helper calls;
- eventually relational ChangeSet authority.

Studio features:

- **Generate minimum capability**;
- **Shrink to least authority**;
- authority-excess diagnostics;
- visual Authority Heatmap on call trees and Forms.

Formal target: define capability ordering `C1 <= C2`, prove inferred capability sufficient, and prove minimality for the supported fragment.

Potential paper:

> **Inferring Least Mutation Authority from Semantic Changes**

---

# R-C — Certified Change Adapters

Priority: **P1 research**
Paper potential: **very high**

The real-code audit found many mutation shapes that are locally add/remove/set-like but require adapters because the host representation is a Set, Map, trie, dynamic keyed store, or host-managed persistence.

Goal: a versioned adapter contract translating foreign mutable operations into Patch semantic Changes without pretending foreign representation semantics are identical to Patch lists/Things.

Examples under study:

- unique sets;
- maps/keyed stores;
- tries;
- VS Code global/workspace state;
- Node-RED context stores;
- database/host persistence adapters.

Research questions:

- what adapter obligations are sufficient for sound semantic Change reconstruction?
- can adapters carry executable validation evidence?
- can the current real-code audit be re-evaluated with adapters without hiding restructuring cost?

Potential paper:

> **Certified Semantic Adapters for Foreign Mutable State**

---

# R-D — Consumable Change Budgets / Temporal Authority

Priority: **P1/P2 research**
Paper potential: **high**

Extend per-Change magnitude authority to authority consumed across a session or causal scope.

Possible beginner-readable direction:

```patch
budget reward_session:
  score may increase total up to 100
```

Studio: Authority Meter showing used and remaining authority.

Formal questions include budget monotonicity, non-overspend, scope reset and composition across calls/ChangeSets.

Potential paper:

> **Consumable Mutation Authority for Change-Oriented Programs**

---

# R-E — ChangeLens: Semantic Causal Debugging

Priority: **P1/P2 research**
Paper potential: **high**

Turn Patch history/provenance into a semantic debugger centered on Changes rather than stack frames.

Studio goals:

- `Why is X this value?` causal tree;
- Change timeline grouped by ChangeSet/call/event;
- state-without-this-change preview;
- minimal causal Change slices for a violated predicate;
- semantic undo preview before commit.

A paper should contribute an actual causal-slicing/counterfactual algorithm rather than merely a graphical history viewer.

Potential paper:

> **ChangeLens: Semantic Causal Slicing for Mutable Programs**

---

# R-F — Change Commutativity and Safe Parallelism

Priority: **P2 research**

Use explicit semantic operations to decide when Changes commute and when independent ChangeSets can be reordered or executed concurrently.

Starting point: `changesConflict` already distinguishes some commuting numeric additions. Research extensions should consider fields, relational constraints, capabilities and deterministic replay.

---

# Patch Studio research surfaces

These are research-facing views, not reasons to complicate source syntax:

## Change Plan / Invariant Inspector

Show before -> operation -> after for every member of a planned ChangeSet, plus relational checks.

## Authority Heatmap

Visualize target/operation/magnitude authority through recipe and event call graphs. Highlight authority declared but never required.

## ChangeLens

Show semantic cause/history, causal slices and counterfactual previews.

## Adapter Inspector

Show which part of a foreign-state bridge is trusted, validated or formally covered.

## Research mode vs beginner mode

Patch Studio should not expose all of the above by default. The normal workspace remains a simple Editor + Designer + Run workflow. Advanced semantic panels appear through an explicit **Explain / Research** surface or context-sensitive diagnostics.

---

# Proposed paper sequence

1. **Current SCP journal paper** — mandatory semantic Change, Change Contracts, formal bridge, runtime correspondence, real-code audit.
2. **Relational ChangeSets** — atomic multi-target mutation, relational invariants, Lean proofs, Change Plan Studio surface.
3. **Least-Authority Inference** — minimal target/operation/magnitude authority and Authority Heatmap.
4. **Certified Change Adapters** — Set/Map/host state and re-evaluation on public software.
5. **ChangeLens** — semantic causal debugging and a developer study.

The sequence is intentionally cumulative: each paper asks a new research question while keeping one coherent Change-Oriented Programming foundation.

# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This manuscript is tied to **Patch 0.2.0-beta.5**. It remains a research-artifact manuscript rather than a submission-ready top-venue paper. Beta 4 established machine-checked Change Signature Soundness for a structured Lean core. Beta 5 begins connecting that theorem to the production JavaScript compiler through an explicit conservative validation boundary.

Implemented mechanisms now include:

- compiler front end and normalized Change IR 0.5;
- automatically inferred semantic Change Signatures;
- Change Capabilities over target/path, semantic operation and optional numeric magnitude;
- ranged numeric recipe parameters and interval analysis for bounded dynamic changes;
- runtime range guards;
- simple transitive recipe-effect analysis;
- source/recipe/GUI-event provenance on committed changes;
- initial `why value` / `why predicate` history explanations;
- a production-to-formal `formalBridge` artifact embedded in Change IR;
- supported-case independent signature reconstruction/comparison;
- `patch formal` CLI coverage reporting;
- `.patchapp`, bootstrap WebAssembly and browser-first Patch Studio;
- GUI preview/Designer and Change Contract view;
- Windows/macOS/Linux CI;
- a separate Lean 4 formal-verification CI gate.

## Mechanized core

The formal project is pinned to Lean 4.30.0 and consists of:

- `formal/PatchFormal.lean` for State-Change Factorization, machine state, semantic effects, intervals and policy relations;
- `formal/PatchSignature.lean` for a structured executable control-flow core, static signature inference and end-to-end contract theorems.

Formal CI builds both libraries and rejects `sorry`/`admit` placeholders.

The current Lean core proves:

1. **State-Change Factorization** for the formal machine step;
2. **Mutation Transparency** as a corollary;
3. transitivity of interval containment;
4. **Semantic Change Contract composition**;
5. **Change Signature Soundness** for a structured core with sequencing, branching and bounded repetition;
6. **end-to-end Capability Soundness** for that formal core.

## Current formal chain

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

Lean derives the first inclusion from the formal execution relation and static `inferSignature` function.

## Beta 5 production bridge

The production compiler now emits a `formalBridge` section in Change IR. For each program/recipe entry, a second path reconstructs a Lean-like structured core directly from the real AST and derives an independent formal-style signature. For entries inside the current subset, this is compared against the normal production Change Signature. A mismatch aborts compilation.

The current bridge covers direct supported changes, sequencing, branch alternatives, literal bounded repetition and supported range-derived amounts. It explicitly marks calls, dynamic repetition, undo/redo, return flow and GUI/event execution outside the current correspondence subset.

This is **translation-validation / conformance evidence**, not yet a machine-checked implementation proof. Both comparison paths currently execute in JavaScript. The next major formal milestone is a verified checker or correspondence theorem over a stable production semantic evidence format.

## Range analysis and provenance

Range analysis and `why`-style debugging are supporting mechanisms, not firstness claims.

A recipe can declare:

```patch
make reward(player, bonus number 0..10):
```

and interval analysis can prove expressions such as `bonus * 2` stay inside a policy bound when the declared range is sufficient.

Committed changes also retain source, recipe and GUI-event context. `why score` shows recorded transitions behind a value; `why score > 100` replays semantic history to find the first recorded false-to-true transition when possible.

## High-venue gate

Patch remains a credible high-venue direction. Before an OOPSLA/PLDI/ICFP-level submission, the project should still add:

- systematic literature review across effects, capabilities, behavioral/refinement systems, update calculi, translation validation, provenance and reversible systems;
- a machine-checked production-analyzer/Lean correspondence or verified checker boundary for a useful subset;
- mechanized interval-analysis soundness if magnitude-aware capabilities remain central;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- two or three convincing security/engineering case studies, ideally including one entirely inside the validated subset;
- benchmark evaluation;
- controlled comprehension evidence only if novice simplicity remains a central empirical claim.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript has an inline display bibliography, so BibTeX is not required for the current artifact version.

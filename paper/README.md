# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This manuscript is tied to **Patch 0.2.0-beta.4**. It remains a research-artifact manuscript rather than a submission-ready top-venue paper, but beta 4 closes one of the most important formal gaps from beta 3.

Implemented mechanisms now include:

- compiler front end and normalized Change IR;
- automatically inferred semantic Change Signatures;
- Change Capabilities over target/path, semantic operation and optional numeric magnitude;
- ranged numeric recipe parameters and interval analysis for bounded dynamic changes;
- runtime range guards;
- simple transitive recipe-effect analysis;
- source/recipe/GUI-event provenance on committed changes;
- initial `why value` / `why predicate` history explanations;
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

The central statement is now machine checked for the formal core:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

Unlike beta 3, Lean no longer receives the first inclusion merely as an assumption for this core. It derives it from the execution relation and the static `inferSignature` function.

The remaining high-value bridge is **production-compiler correspondence**: the JavaScript analyzer/lowering must be related to the Lean effect vocabulary and inference judgments strongly enough to transfer this result to a useful executable Patch fragment.

## Range analysis and provenance

Range analysis and `why`-style debugging are supporting mechanisms, not firstness claims.

A recipe can declare:

```patch
make reward(player, bonus number 0..10):
```

and interval analysis can prove expressions such as `bonus * 2` stay inside a policy bound when the declared range is sufficient.

Committed changes also retain source, recipe and GUI-event cause context. `why score` shows recorded transitions behind a value; `why score > 100` replays the semantic history to find the first recorded false-to-true transition when possible.

The paper explicitly distinguishes this historical provenance from general causal inference.

## High-venue gate

Patch remains a credible high-venue direction. Before an OOPSLA/PLDI/ICFP-level submission, the project should still add:

- systematic literature review across effects, capabilities, behavioral/refinement systems, update calculi, provenance and reversible systems;
- production-analyzer/Lean correspondence or a verified checker boundary;
- mechanized interval-analysis soundness if magnitude-aware capabilities remain central;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- two or three convincing security/engineering case studies;
- benchmark evaluation;
- controlled comprehension evidence only if novice simplicity remains a central empirical claim.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript has an inline display bibliography, so BibTeX is not required for the current artifact version.

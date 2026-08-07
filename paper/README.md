# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This manuscript is now tied to **Patch 0.2.0-beta.3**. It remains a research-artifact manuscript rather than a submission-ready top-venue paper, but beta 3 materially advances the formal side of the project.

Implemented mechanisms now include:

- compiler front end and normalized Change IR;
- automatically inferred semantic Change Signatures;
- Change Capabilities over target/path, semantic operation and optional numeric magnitude;
- ranged numeric recipe parameters and interval analysis for bounded dynamic changes;
- runtime range guards preserving current signature assumptions;
- simple transitive recipe-effect analysis;
- source/recipe/GUI-event provenance on committed changes;
- initial `why value` / `why predicate` history explanations;
- `.patchapp`, bootstrap WebAssembly and browser-first Patch Studio;
- GUI preview/Designer and Change Contract view;
- Windows/macOS/Linux CI;
- a separate Lean 4 formal-verification CI gate.

## Mechanized core

`formal/PatchFormal.lean` is a real Lean 4.30.0 project. The formal CI builds it and rejects `sorry`/`admit` placeholders.

The current Lean core proves:

1. **State-Change Factorization** for the formal machine step;
2. **Mutation Transparency** as a corollary;
3. transitivity of interval containment;
4. **Semantic Change Contract composition**: if runtime changes are covered by a signature and the signature is admitted by a policy, runtime changes are admitted by the policy.

This is intentionally not described as verification of the complete JavaScript compiler. The missing high-value theorem is **implementation/signature correspondence**: the executable analyzer must be connected to the formal definition strongly enough to prove that generated signatures really cover runtime changes in a useful Patch core.

## Current formal chain

The intended end-to-end statement remains:

```text
RuntimeChanges(f) subset-of Signature(f)
Signature(f) subset-of Capability(f)
-------------------------------------
RuntimeChanges(f) subset-of Capability(f)
```

Lean currently proves the composition step once the first inclusion is assumed. Beta 3's executable interval analyzer supplies useful evidence for bounded changes, but its soundness is not yet mechanized.

## Range analysis and provenance

Range analysis and `why`-style debugging are supporting mechanisms, not firstness claims.

A recipe can now declare:

```patch
make reward(player, bonus number 0..10):
```

and interval analysis can prove expressions such as `bonus * 2` stay inside a policy bound when the declared range is sufficient.

Committed changes also retain source, recipe and GUI-event cause context. `why score` shows recorded transitions behind a value; `why score > 100` replays the semantic history to find the first recorded false-to-true transition when possible.

The paper explicitly distinguishes this historical provenance from general causal inference.

## High-venue gate

Patch remains a credible high-venue direction. Before an OOPSLA/PLDI/ICFP-level submission, the project should still add:

- systematic literature review across effects, capabilities, behavioral types, update calculi, provenance and reversible systems;
- executable-to-formal correspondence or a verified checker boundary;
- machine-checked Change Signature soundness for a useful core;
- mechanized interval-analysis soundness if bounded capabilities remain a central theorem;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- benchmark/security evaluation;
- controlled comprehension evidence if novice simplicity remains part of the contribution.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript has an inline display bibliography, so BibTeX is not required for the current artifact version.

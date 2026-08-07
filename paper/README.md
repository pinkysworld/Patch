# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This is a substantial beta/design manuscript tied to the Patch 0.2.0-beta.2 artifact. It is not yet a submission-ready empirical paper. Implemented mechanisms are separated from theorem targets, performance hypotheses, security claims and human-comprehension hypotheses.

The current artifact includes:

- compiler front end lowering Patch to normalized Change IR;
- automatically inferred semantic Change Signatures for recipes;
- optional compile-time Change Capabilities with operation/path rules and numeric bounds;
- conservative transitive analysis through simple recipe calls;
- `patch changes` CLI inspection and Patch Studio Change Contract view;
- `.patchapp` portable bundle format;
- valid bootstrap WebAssembly `.wasm` backend carrying Patch source + Change IR;
- Patch Studio browser-first PWA with iPhone/iPad support;
- first visual form-Designer toolbox and Patch UI browser runtime/preview;
- hardened Windows/macOS/Linux CI and deterministic public-site validation.

## Formal story

The manuscript now has two linked formal contribution candidates.

### State-Change Factorization

Every supported post-creation persistent state transition from `S` to `S'` factors through a semantic change `delta` such that:

```text
apply(delta, S) = S'
```

The transition commits through that change representation rather than through hidden assignment followed by logging.

### Semantic Change Contracts

For a recipe `f`, the compiler infers a conservative semantic Change Signature `Sig(f)`. A protected recipe declares a semantic policy `Cap(f)`.

The desired proof chain is:

```text
RuntimeChanges(f) subset-of Sig(f)
Sig(f) subset-of Cap(f)
--------------------------------
RuntimeChanges(f) subset-of Cap(f)
```

The current implementation demonstrates the analysis and conservative checking but does not yet constitute a machine-checked proof of these properties.

## Prior-art boundary

The paper explicitly does **not** claim to invent first-class state change, effect inference, capabilities, typestate, undo, patches or event histories.

The comparison set now includes at least:

- Plaid / First-Class State Change (OOPSLA 2011);
- Worlds / reified program state (ECOOP 2011);
- Lucassen and Gifford's Polymorphic Effect Systems (POPL 1988);
- Effects as Capabilities / Effekt (OOPSLA 2020);
- capability, permission and typestate systems;
- XMF first-class undoability;
- ChEOPS/COPE and Edit Transactions;
- reducer/event architectures and event sourcing;
- edit lenses, change structures, patch theory and CRDTs.

The candidate distinction is the combination of mandatory semantic-delta execution, operation-aware inferred signatures, semantic capability policies over those deltas, reuse of one Change IR across runtime/tooling facilities, and a deliberately low-complexity source language.

## High-venue position

Patch remains a credible high-venue research direction, but the current manuscript should **not** yet be submitted to a top PL venue.

A serious OOPSLA/PLDI/ICFP-level attempt should wait for:

- a systematic literature review across effect/capability/behavioral-state systems;
- a small formal calculus centered on State-Change Factorization;
- machine-checked State-Change Factorization, Change Signature soundness and Change Capability soundness for a useful core;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- benchmark and semantic-security evaluation;
- ideally a preregistered novice-comprehension study if accessibility remains part of the paper story.

## Build

With a standard LaTeX installation:

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript contains its display bibliography directly, so BibTeX is not required. `references.bib` is maintained as structured citation metadata for later venue formatting.

## Next manuscript work

The next research rounds should focus on:

1. mechanizing the factorization and semantic-capability core in Lean 4;
2. typed/range-aware signature inference so bounded dynamic changes can be proved;
3. systematic comparison against richer effect/capability and behavioral type systems;
4. direct Change IR-to-Wasm execution;
5. a reproducible security/capability benchmark corpus;
6. controlled comprehension results if retained.

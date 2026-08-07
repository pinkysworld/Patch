# Paper

Working manuscript:

**Patch: Change-Oriented Programming with Transparent State Evolution**

## Status

This is a substantial beta/design manuscript, not yet a submission-ready empirical paper. Implemented claims are tied to the repository artifact. Human-comprehension, large-program, native-compiler performance and cross-platform native-GUI claims remain research questions or implementation goals until measured.

The 0.2 artifact has moved materially beyond the original 0.1 manuscript:

- compiler front end lowering Patch to normalized Change IR;
- `.patchapp` portable bundle format;
- valid bootstrap WebAssembly `.wasm` backend carrying Patch source + Change IR;
- Patch Studio browser-first PWA with iPhone/iPad support;
- first visual form-Designer toolbox that edits normal Patch source;
- Patch UI core (`window`, `text`, `button`, `input`, `when ... clicked`) with browser runtime/preview;
- hardened Windows/macOS/Linux CI and deterministic public-site validation.

The manuscript's strongest prospective PL formulation is now **State-Change Factorization**, not the generic claim that change-oriented programming, first-class state change, undo, or patches are new:

> Every supported post-creation persistent state transition from `S` to `S'` factors through a semantic change `delta` such that `apply(delta, S) = S'`, and the transition commits through that change representation rather than through hidden assignment followed by logging.

Supporting theorem/evaluation targets are Mutation Transparency, inverse correctness, preview equivalence, deterministic replay consistency, and soundness of declared commuting changes.

## Closest prior art now explicitly tracked

The novelty review must directly compare Patch with at least:

- **Plaid / First-Class State Change** (OOPSLA 2011), which makes abstract object-state transitions a language concept;
- **Worlds: Controlling the Scope of Side Effects** (ECOOP 2011), which reifies whole program state and supports speculative state/undo;
- XMF's VM-level first-class undoability;
- ChEOPS/COPE change-oriented programming environments centered on software/source transformations;
- Edit Transactions for controlled live-program updates;
- reducer/message architectures such as Elm/Redux-style state evolution;
- edit lenses, change structures, patch theory, event sourcing, reversible programming and CRDTs.

These systems weaken broad claims such as “first language with state changes” or “first language with automatic undo.” They do **not obviously subsume** the narrower proposed combination in which ordinary persistent mutation itself must execute through a structured delta that is reused across multiple runtime/tooling facilities. That narrower claim still needs systematic verification.

## High-venue position

Patch remains a credible high-venue research direction, but the current manuscript should **not** yet be sent to a top PL venue. Product polish, mobile IDE support and GUI compilation plans strengthen the artifact but do not replace a formal contribution.

A serious OOPSLA/PLDI/ICFP-level attempt should wait until the repository contains:

- systematic prior-art analysis including Plaid, Worlds, ChEOPS/COPE/Edit Transactions and reducer/event architectures;
- a small formal calculus centered on State-Change Factorization;
- machine-checked core properties where practical;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- benchmark and application evaluation;
- ideally a preregistered novice-comprehension study if accessibility remains part of the paper story.

## Build

With a standard LaTeX installation:

```bash
cd paper
pdflatex main.tex
pdflatex main.tex
```

The manuscript contains its display bibliography directly so BibTeX is not required; `references.bib` is maintained as structured citation metadata for later venue formatting.

## Next manuscript revision

The next full `main.tex` revision should reorganize the paper around:

1. State-Change Factorization and Change IR semantics;
2. formal change laws and mechanization;
3. compiler + Patch Studio artifact;
4. direct comparison with Plaid, Worlds, source-change systems, reducers/event sourcing, lenses and patch theory;
5. direct Wasm/native execution results once available;
6. controlled comprehension results if retained.

Until those results exist, the repository should continue to distinguish implemented mechanisms from hypotheses and planned targets.

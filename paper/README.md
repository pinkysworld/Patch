# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This manuscript is tied to **Patch 0.2.0-beta.6**. It remains a research-artifact manuscript rather than a submission-ready top-venue paper. Beta 4 established machine-checked Change Signature Soundness for a structured Lean core, beta 5 added production-to-formal translation validation, and beta 6 adds a small executable Lean policy checker with generated production certificates.

Implemented mechanisms now include:

- compiler front end and normalized Change IR 0.5;
- automatically inferred semantic Change Signatures;
- operation- and magnitude-aware Change Capabilities;
- ranged numeric recipe parameters and interval analysis;
- runtime range guards;
- simple transitive production recipe-effect analysis;
- source/recipe/GUI-event provenance and initial `why` queries;
- production-to-formal `formalBridge` evidence embedded in Change IR;
- `patch formal` coverage reporting;
- **`formal/PatchChecker.lean` executable verified semantic policy checker**;
- **`patch certify` generated Lean certificates** for protected bridge-supported recipes;
- source SHA-256 binding in generated certificate artifacts;
- `.patchapp`, bootstrap WebAssembly and browser-first Patch Studio;
- GUI preview/Designer and Change Contract view;
- Windows/macOS/Linux CI;
- explicit Lean proof + generated-certificate CI.

## Mechanized core

The formal project is pinned to Lean 4.30.0 and consists of:

- `formal/PatchFormal.lean` for State-Change Factorization, machine state, semantic effects, intervals and policy relations;
- `formal/PatchSignature.lean` for structured execution, static signature inference and runtime/signature soundness;
- `formal/PatchChecker.lean` for executable policy checking and checker-soundness theorems.

Formal CI explicitly builds all three modules:

```bash
lake build PatchFormal PatchSignature PatchChecker
```

It then compiles a certificate generated from real Patch source. This stronger beta-6 gate also exposed and fixed latent Lean 4.30 compatibility issues that the previous bare Lake invocation had not actually compiled.

## Current formal chain

The formal core establishes:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

Beta 6 adds an executable checker result as a proved entry point:

```text
checkProtected(stmt, policy) = true
=> PolicyAllows(inferSignature(stmt), policy)
```

and therefore:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

The key checker theorem is `checkedExecutionCannotEscape`.

## Production bridge and certificate boundary

The production compiler emits a `formalBridge` section in Change IR. A second path reconstructs a Lean-like structured core directly from the real AST and compares its formal-style signature with the ordinary production Change Signature.

For a protected recipe inside this bridge subset:

```bash
patch certify program.patch --out Program.patchcert.lean
```

emits the formal statement, policy rules, source SHA-256, Patch IR version, a computed protectedness theorem and a runtime policy-containment theorem. Lean independently compiles that artifact against `PatchChecker`.

This is **stronger than trusting the JavaScript policy checker**, but it remains deliberately narrower than full compiler verification. The JavaScript source/AST-to-formal-`CoreStmt` translation is still an unproved boundary.

## Prior-art boundary

Translation validation and proof-carrying/certifying architectures are established research areas. The paper therefore treats Necula's PLDI 2000 translation-validation work and POPL 1997 Proof-Carrying Code as prior art, not as Patch novelty.

The candidate contribution remains the mandatory semantic Change IR and the operation-/magnitude-aware state-transition contracts derived from it, with the verified checker serving as assurance infrastructure.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level submission, the project should still add:

- systematic literature review across effects, quantitative/refinement systems, capabilities, update calculi, translation validation, proof-carrying systems, provenance and reversible systems;
- stronger source/Change-IR-to-formal correspondence for a useful subset;
- mechanized production interval-analysis soundness if magnitude-aware capabilities remain central;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- two or three convincing security/engineering case studies, including at least one entirely inside the certifiable subset;
- benchmark and certificate/checker overhead evaluation;
- controlled comprehension evidence only if novice simplicity remains a central empirical claim.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript currently uses an inline display bibliography, so BibTeX is not required for the artifact PDF. `references.bib` is maintained in parallel for later venue-template migration.

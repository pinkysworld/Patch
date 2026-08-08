# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

This manuscript is tied to **Patch 0.2.0-beta.7**. It remains a research-artifact manuscript rather than a submission-ready top-venue paper. Beta 4 established machine-checked Change Signature Soundness for a structured Lean core, beta 5 added production-to-formal translation validation, beta 6 added a verified executable semantic policy checker, and beta 7 adds **Lean-validated proof-free production evidence with machine-checked evidence/formal-signature correspondence**.

Implemented mechanisms now include:

- compiler front end and normalized Change IR 0.5;
- automatically inferred semantic Change Signatures;
- operation- and magnitude-aware Change Capabilities;
- ranged numeric recipe parameters and interval analysis;
- runtime range guards;
- source/recipe/GUI-event provenance and initial `why` queries;
- production-to-formal `formalBridge` coverage metadata;
- `patch formal` coverage reporting;
- `formal/PatchChecker.lean` executable verified semantic policy checker;
- **`formal/PatchEvidence.lean` proof-free evidence schema, validation and decoder**;
- **`checkedEvidenceSignatureCorresponds` machine-checked correspondence theorem**;
- **`checkedEvidenceExecutionCannotEscape` evidence-level runtime policy theorem**;
- `patch certify` certificates containing proof-free evidence, a separate production Change Signature claim, policy, source SHA-256 and evidence-schema version;
- `.patchapp`, bootstrap WebAssembly and browser-first Patch Studio;
- Windows/macOS/Linux CI plus explicit Lean evidence/certificate CI.

## Mechanized core and evidence boundary

The formal project is pinned to Lean 4.30.0 and consists of:

- `formal/PatchFormal.lean` for State-Change Factorization, machine state, semantic effects, intervals and policy relations;
- `formal/PatchSignature.lean` for structured execution, static signature inference and runtime/signature soundness;
- `formal/PatchChecker.lean` for executable policy checking and checker-soundness theorems;
- `formal/PatchEvidence.lean` for proof-free production evidence, Lean-side validation/decoding, formal-signature reconstruction and correspondence checking.

Formal CI explicitly builds all four modules:

```bash
lake build PatchFormal PatchSignature PatchChecker PatchEvidence
```

It then compiles a certificate generated from real Patch source.

## Current formal chain

The formal core establishes:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

Beta 7 adds the production-evidence boundary:

```text
proof-free EvidenceStmt
        -> Lean validation / decoding
        -> CoreStmt
        -> formal inferSignature
        -> compare with separate production signature claim
        -> verified semantic policy check
```

For a successfully decoded evidence artifact and successful correspondence check, Lean proves the canonical formal signature equals the separately emitted production claim. For a successfully policy-checked decoded artifact, Lean composes the result with formal execution soundness so modeled runtime effects cannot escape policy.

## Important remaining trust boundary

Beta 7 is stronger than beta 6 because the producer no longer injects the `CoreStmt` directly into the trusted formal statement. Lean derives it from proof-free evidence and validates raw interval ordering itself.

It is still **not full compiler verification**. The remaining critical boundary is:

```text
Patch source / production AST
   -> proof-free EvidenceStmt
   -> production Change Signature claim
   -> policy extraction
```

The next major formal milestone is a source/AST-to-`EvidenceStmt` extraction theorem for a useful supported fragment, followed by production interval-analysis soundness and runtime-trace correspondence.

## Prior-art boundary

Translation validation and proof-carrying/certifying architectures are established research areas. The paper therefore treats Necula's PLDI 2000 translation-validation work and POPL 1997 Proof-Carrying Code as prior art, not as Patch novelty.

The candidate contribution remains the mandatory semantic Change IR and operation-/magnitude-aware state-transition contracts derived from it. The verified evidence decoder/checker is assurance infrastructure supporting that semantic claim.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level submission, the project should still add:

- systematic literature review across effects, quantitative/refinement systems, capabilities, update calculi, translation validation, proof-carrying systems, provenance and reversible systems;
- a meaningful source/AST-to-evidence correspondence proof for a useful subset;
- mechanized production interval-analysis soundness if magnitude-aware capabilities remain central;
- direct compiled execution rather than only the bootstrap Wasm carrier;
- two or three convincing security/engineering case studies, including at least one entirely inside the evidence-certified subset;
- benchmark and evidence/certificate/checker overhead evaluation;
- controlled comprehension evidence only if novice simplicity remains a central empirical claim.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript currently uses an inline display bibliography, so BibTeX is not required for the artifact PDF. `references.bib` is maintained in parallel for later venue-template migration.

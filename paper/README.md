# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is now **Patch 0.2.0-beta.19 / Change IR 0.8**. The paper is still a working manuscript, not a submission-ready top-venue paper.

The research story now has three distinct assurance layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean formal core** — factorization, Mutation Transparency, Change Signature Soundness, policy containment and integer range-analysis soundness for explicit formal fragments.
2. **Source translation validation** — beta.19 independently re-parses the exact Patch source without importing `parser.js` or consuming the production AST, reconstructs SourceStmt/range claims, and compares them with the production AST-derived `formalSource` artifact before protected certification.
3. **Direct-runtime validation** — an independent Change-IR execution model reconstructs ordered transitions and concrete semantic effects and compares them with observed direct-Wasm execution, Change Signatures and Change Capabilities.

None of these is described as complete compiler verification.

## Beta.19 source-validation milestone

Before beta.19, the remaining frontend assurance boundary included:

```text
Patch source bytes
   -> production parser / AST
   -> formal SourceStmt + range claims
```

Beta.19 adds:

```text
exact Patch source bytes
   -> independent raw-source parser
   -> raw SourceStmt + raw range claims
                 |
                 +---- exact structural comparison ----+
                                                       |
production AST -> formalSource ------------------------+
```

The independent path does not import the production parser or consume the production AST. `patch certify` now refuses to certify a supported protected recipe unless this source/range comparison succeeds.

Tamper tests cover disagreements in both SourceStmt structure and range claims.

This is **translation validation**, not a machine-checked parser-correctness theorem. Both frontend paths are still JavaScript implementations.

## Current formal chain

```text
exact source
   -> production formalSource --------+
   -> independent raw-source witness --+-> equality validation
                                        |
                                        v
formal RangeExpr
   -> Lean analyzeRange + rangeAnalysisSound
   -> SourceStmt
   -> Lean source semantic normalization
   -> EvidenceStmt
   -> CoreStmt
   -> formal inferSignature
   -> compare separate production Change Signature claim
   -> verified semantic policy check
   -> formal SourceExecutes policy containment
```

Formal modules:

```text
PatchFormal.lean      factorization, state, intervals, effects, policies
PatchSignature.lean   CoreStmt execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free semantic evidence + correspondence
PatchSource.lean      source vocabulary + source/evidence/signature checks
PatchRange.lean       integer evaluator + range-analysis soundness
```

## Executable artifact status

The artifact is no longer interpreter-only. It includes:

- direct numeric Patch → WebAssembly compilation;
- direct control flow and acyclic numeric recipes;
- ranged runtime guards;
- independent direct-Wasm transition/effect validation;
- standalone single-file Web Apps;
- Windows/macOS/Linux Console packages;
- Windows/macOS/Linux standalone Window packages through the current desktop player;
- portable C99 for the compiled numeric Console subset;
- compile/run gates for that C99 on Linux, macOS and FreeBSD 15.1;
- FreeBSD Console builds from Patch Studio.

These product/platform capabilities support artifact evaluation but are not individually novelty claims.

## Remaining high-value research gaps

The strongest next steps are:

- connect independently reconstructed runtime effect occurrences to Lean `SourceExecutes` / `Executes`;
- introduce a typed expression/core IR or another smaller independently checkable lowering input;
- extend formal recipe-call/substitution semantics for the direct subset;
- build semantic-security/engineering case studies;
- measure analysis, source-validation, evidence/certificate, checker and backend overhead;
- perform a systematic related-work review and reproducibility pass.

If source simplicity remains a headline empirical claim, user evidence should be collected only with an appropriate study design and ethics/consent process.

## Prior-art discipline

Patch does not claim novelty for interval analysis, abstract interpretation, source calculi, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C code generation, provenance, undo or cross-platform packaging.

The candidate contribution remains the combination of **mandatory semantic mutation factorization** and operation-/magnitude-aware state-transition authority derived from the same representation, supported by a progressively tighter formal/validation connection to the implementation.

## Manuscript source

`main.tex` is the working article source. Its next editorial pass should consolidate beta.9–beta.19 into one coherent implementation-assurance section rather than narrating every beta chronologically. The claims in `docs/FORMAL_MODEL.md` and `docs/NOVELTY.md` are the current source of truth for the exact proof/validation boundary.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

`references.bib` is maintained for later venue-template migration.

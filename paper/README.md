# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is now **Patch 0.2.0-beta.20 / Change IR 0.8**. The paper remains a working manuscript, not a submission-ready top-venue paper.

The research story now has four distinct assurance layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean formal core** — factorization, Mutation Transparency, Change Signature Soundness, policy containment and integer range-analysis soundness for explicit formal fragments.
2. **Source translation validation** — an independent raw-source path reconstructs SourceStmt/range claims without importing `parser.js` or consuming the production AST and compares them with the production formal-source artifact before protected certification.
3. **Direct-runtime validation** — an independent Change-IR execution model reconstructs ordered transitions and concrete semantic effects and compares them with observed direct-Wasm execution, Change Signatures and Change Capabilities.
4. **Beta.20 runtime → Lean correspondence** — for a narrower linear protected subset, proof-free concrete effect occurrences reconstructed from one direct-Wasm execution are checked by Lean against an actual formal `SourceExecutes` trace through `EffectRefines` and the pointwise `TraceRefines` relation.

None of these is described as complete compiler verification.

## Beta.20 runtime-correspondence milestone

For the motivating example:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

the static formal source model admits the abstract effect:

```text
score increase [0,10]
```

The direct Wasm run reports target/before/after. The independent runtime validator reconstructs:

```text
score increase [8,8]
```

The generated runtime certificate then asks Lean to establish that the concrete occurrence refines a formal execution effect. `PatchRuntime.lean` defines executable effect/trace refinement checks and proves them sound, reconstructs the exact trace of the current linear evidence subset, and proves:

```text
checkSourceRuntimeEvidence source observed = true
-------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

The runtime certificate is bound by SHA-256 to the exact source bytes and the observed direct transition trace.

This is a restricted correspondence theorem, not a theorem that the direct-Wasm compiler or runtime observer is correct.

## Current formal chain

Static:

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
   -> verified semantic policy check
```

Runtime:

```text
direct Wasm execution
   -> observed before/after transitions
   -> independent semantic-effect reconstruction
   -> concrete proof-free EvidenceEffect list
   -> Lean runtime-effect decoding/refinement
   -> TraceRefines
   -> formal SourceExecutes witness
```

Formal modules:

```text
PatchFormal.lean      factorization, state, intervals, effects, policies
PatchSignature.lean   CoreStmt execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free semantic evidence + correspondence
PatchSource.lean      source vocabulary + source/evidence/signature checks
PatchRange.lean       integer evaluator + range-analysis soundness
PatchRuntime.lean     concrete runtime refinement + SourceExecutes correspondence
```

Formal CI generates and compiles both `GeneratedCertificate.lean` and `GeneratedRuntimeCertificate.lean` with the pinned Lean toolchain.

## Current runtime-certificate boundary

Beta.20 intentionally certifies only:

- protected recipes already covered by the formal source model and raw-source validation;
- linear formal source (`skip`, change, sequence);
- one observed invocation per protected recipe;
- concrete integer increase/decrease magnitudes.

Branches, repeats, multiple invocations and floating-point/non-integer concrete magnitudes are rejected at this boundary. Direct Wasm supports more than the runtime theorem currently covers.

## Executable artifact status

The artifact includes:

- direct numeric Patch → WebAssembly compilation;
- direct control flow and acyclic numeric recipes;
- ranged runtime guards;
- independent direct-Wasm transition/effect validation;
- beta.20 Lean-checkable runtime correspondence for a linear protected subset;
- standalone single-file Web Apps;
- Windows/macOS/Linux Console packages;
- Windows/macOS/Linux standalone Window packages through the current desktop player;
- portable C99 for the compiled numeric Console subset;
- compile/run gates for C99 on Linux, macOS and FreeBSD 15.1;
- FreeBSD Console builds from Patch Studio.

These product/platform capabilities support artifact evaluation but are not individually novelty claims.

## Remaining high-value research gaps

The strongest next steps are:

- extend runtime correspondence to explicit branch/repeat path witnesses and multiple invocation identifiers;
- prove a concrete-runtime capability result by combining `EffectRefines` with formal capability admission;
- introduce a typed expression/core IR or another smaller independently checkable lowering input;
- extend formal recipe-call/substitution semantics for the direct subset;
- build semantic-security/engineering case studies;
- measure analysis, source-validation, static/runtime certificate, checker and backend overhead;
- perform a systematic related-work review and reproducibility pass.

If source simplicity remains a headline empirical claim, user evidence should be collected only with an appropriate study design and ethics/consent process.

## Prior-art discipline

Patch does not claim novelty for interval analysis, abstract interpretation, source calculi, refinement/simulation relations, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C code generation, provenance, undo or cross-platform packaging.

The candidate contribution remains the combination of **mandatory semantic mutation factorization** and operation-/magnitude-aware state-transition authority derived from the same representation, supported by a progressively tighter formal/validation connection to the implementation.

## Manuscript source

`main.tex` is the working article source. It should describe beta.20 as one coherent assurance architecture rather than narrating every beta chronologically. No empirical performance or user-study results should be stated until they have actually been collected.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

`references.bib` is maintained for later venue-template migration.

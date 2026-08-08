# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is now **Patch 0.2.0-beta.21 / Change IR 0.8**. The paper remains a working manuscript, not a submission-ready top-venue paper.

The research story has four distinct assurance layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean formal core** — factorization, Mutation Transparency, Change Signature Soundness, policy containment and integer range-analysis soundness for explicit formal fragments.
2. **Source translation validation** — an independent raw-source path reconstructs SourceStmt/range claims without importing `parser.js` or consuming the production AST, then compares them with the production formal-source artifact before protected certification.
3. **Direct-runtime validation** — an independent Change-IR execution model reconstructs ordered transitions/concrete effects and compares them with observed direct-Wasm execution, Change Signatures and Change Capabilities.
4. **Runtime → Lean correspondence** — proof-free concrete effects plus an untrusted control-flow `RuntimePath` are checked by Lean against an actual formal `SourceExecutes` trace. Beta.21 covers supported branch/repeat paths and repeated protected recipe invocations.

None of these is described as complete compiler verification.

## Beta.21 runtime-correspondence milestone

The CI example now deliberately contains branch selection, a literal repeat and two calls to the same protected recipe:

```patch
create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    repeat 2:
      change score:
        add bonus

do reward(4)
do reward(0)
```

For the first call, the runtime-certificate producer independently reconstructs two concrete `increase [4,4]` occurrences and proposes a proof-free path corresponding to `branchThen` plus two repeat iterations. For the second call it proposes `branchElse` and an empty occurrence list.

The formal path vocabulary in `PatchRuntime.lean` is:

```text
RuntimePath.leaf
RuntimePath.seq
RuntimePath.branchThen
RuntimePath.branchElse
RuntimePath.repeatZero
RuntimePath.repeatSucc
```

The producer's path is **not trusted as a proof**. Lean checks it against the decoded formal `CoreStmt`. `decodeCorePath_sound` establishes:

```text
decodeCorePath path stmt = some trace
-------------------------------------
Executes stmt trace
```

The runtime checker then proves through `checkSourceRuntimeEvidence_sound`:

```text
checkSourceRuntimeEvidence source observed path = true
------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

A concrete singleton amount may refine a larger abstract formal interval. The generated runtime certificate remains bound by SHA-256 to exact source bytes and the observed direct transition trace.

This is restricted runtime correspondence, not a theorem that the direct-Wasm compiler, observer or JavaScript reconstruction code is correct.

## Current formal chain

Static:

```text
exact source
   -> production formalSource --------+
   -> independent raw-source witness --+-> equality validation
                                        |
                                        v
formal RangeExpr -> Lean rangeAnalysisSound
SourceStmt -> Lean normalization -> EvidenceStmt -> CoreStmt
          -> formal Signature -> verified policy checker
```

Runtime:

```text
direct Wasm execution
   -> observed before/after transitions
   -> independent semantic-effect reconstruction
   -> concrete proof-free EvidenceEffect list

same execution
   -> untrusted RuntimePath reconstruction

EvidenceEffect + RuntimePath
   -> Lean path/effect decoding
   -> Executes / SourceExecutes
   -> TraceRefines
```

Formal modules:

```text
PatchFormal.lean      factorization, state, intervals, effects, policies
PatchSignature.lean   CoreStmt execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free semantic evidence + correspondence
PatchSource.lean      source vocabulary + SourceExecutes
PatchRange.lean       integer evaluator + range-analysis soundness
PatchRuntime.lean     EffectRefines + RuntimePath + runtime correspondence
```

Formal CI generates and compiles both `GeneratedCertificate.lean` and `GeneratedRuntimeCertificate.lean` with the pinned Lean toolchain. The generated runtime certificate exercises branch/repeat/multiple-invocation behavior rather than only the former linear case.

## Current runtime-certificate boundary

Beta.21 supports protected recipe bodies covered by the formal SourceStmt fragment with:

- direct `add/remove/set/clear` changes;
- sequence;
- branch choice through `RuntimePath.branchThen` / `branchElse`;
- literal repeat through exact `repeatSucc` / `repeatZero` witnesses;
- multiple direct protected recipe invocations, each checked separately;
- concrete magnitudes in the current formal integer fragment.

Still outside this theorem are recipe-call/substitution nodes *inside* the protected formal body, GUI/event execution, broader source constructs and floating-point correspondence.

## Executable artifact status

The artifact includes:

- direct numeric Patch → WebAssembly compilation for the supported Console subset;
- direct control flow, acyclic numeric recipes and ranged guards;
- independent direct-Wasm transition/effect validation;
- path-witnessed Lean runtime correspondence for supported protected invocations;
- standalone Console Web Apps;
- **Standalone Window Web Apps** through a separate generated browser Window runtime;
- corrected Studio Window preflight for Windows/macOS/Linux packages;
- Windows/macOS/Linux Console and standalone Window packages;
- portable C99 and Linux/macOS/FreeBSD 15.1 gates;
- browser-first Patch Studio with versioned network-first JavaScript/HTML refresh.

These product/platform capabilities support artifact evaluation but are not novelty claims.

## Remaining high-value research gaps

The strongest next steps are:

- formal recipe-call/substitution semantics for the existing non-recursive direct subset;
- a concrete-runtime capability result combining `EffectRefines` with formal capability admission;
- a typed expression/core IR or another smaller independently checkable lowering input;
- semantic-security/engineering case studies;
- measured analysis, source-validation, certificate, checker and backend overhead;
- systematic related-work review and reproducibility work.

If source simplicity remains a headline empirical claim, user evidence should be collected only with appropriate study design and ethics/consent procedures.

## Prior-art discipline

Patch does not claim novelty for interval analysis, abstract interpretation, source calculi, refinement/simulation relations, execution-path witnesses, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C generation, provenance, undo, GUI packaging or cross-platform builds.

The candidate contribution remains the combination of **mandatory semantic mutation factorization** and operation-/magnitude-aware state-transition authority derived from the same representation, supported by an increasingly tight but explicitly bounded formal/validation connection to the implementation.

## Manuscript source

`main.tex` is the working article source. Beta.21 should be presented as a coherent assurance architecture rather than a chronological beta diary. No empirical performance or user-study results should be stated until actually collected.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

`references.bib` is maintained for later venue-template migration.

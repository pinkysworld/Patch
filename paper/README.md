# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Status

The research artifact is now tied to **Patch 0.2.0-beta.9**. It is not yet a submission-ready top-venue paper.

Beta 9 closes one of the major formal gaps left by beta 8: the project now has a machine-checked interval-analysis soundness theorem for a useful integer expression fragment. `formal/PatchRange.lean` defines both concrete evaluation and abstract interval analysis for integer literals, ranged variables, addition, subtraction, negation, and multiplication by a non-negative integer constant. Lean proves that every concrete result lies inside the inferred interval when the concrete environment respects the declared ranges.

The motivating capability example is now represented directly in the formal story:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

For the modeled fragment, `bonus * 2` is formally bounded by `0..10`.

Implemented research mechanisms now include:

- normalized Change IR 0.7;
- semantic Change Signatures and operation-/magnitude-aware Change Capabilities;
- ranged numeric parameters and production interval analysis;
- State-Change Factorization and Mutation Transparency proofs;
- structured `CoreStmt`, formal `Executes`, and Change Signature Soundness;
- executable verified semantic policy checker;
- proof-free `EvidenceStmt` validated/decoded by Lean;
- formal `SourceStmt` preserving `add/remove/set/clear`;
- Lean source semantic normalization and source/evidence equality checking;
- `checkSourceSignature_sound` and `checkedSourceExecutionCannotEscape`;
- **formal `RangeExpr`, concrete integer evaluator and executable interval analyzer**;
- **machine-checked `rangeAnalysisSound` theorem**;
- **independent production `RangeExpr` extraction and production/formal range-agreement checking**;
- generated range/source/evidence/signature/policy certificates;
- Windows/macOS/Linux CI plus explicit Lean 4.30 range/source/evidence/certificate CI.

## Formal modules

```text
PatchFormal.lean      factorization, state, intervals, effects, policies
PatchSignature.lean   CoreStmt execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free semantic evidence + signature correspondence
PatchSource.lean      source mutation vocabulary + source/evidence correspondence
PatchRange.lean       integer evaluator + machine-checked range-analysis soundness
```

Formal CI explicitly builds all six modules. It then generates and compiles a certificate from `examples/range-soundness.patch`, whose protected recipe uses a ranged parameter and `bonus * 2`.

## Current checked chain

For the beta.9-certified fragment:

```text
formal RangeExpr
      -> Lean analyzeRange
      -> rangeAnalysisSound
      -> formal SourceStmt(add/remove/set/clear)
      -> Lean semantic normalization
      -> EvidenceStmt
      -> Lean decoding to CoreStmt
      -> formal inferSignature
      -> compare separate production Change Signature claim
      -> verified semantic policy check
      -> formal SourceExecutes runtime containment
```

The production side deliberately maintains separate claim paths. `src/range-analysis.js` computes the ordinary production interval. `src/formal-range.js` independently extracts the supported integer expression and computes a formal-style interval. Certification requires agreement before Lean receives the formal range claim.

## Precise range theorem

Schematically, Lean proves:

```text
EnvRespects(ranges, values)
analyzeRange(expr, ranges) = some interval
evalRangeExpr(expr, values) = some value
------------------------------------------------
value is inside interval
```

This is a theorem over the entire modeled expression grammar, not a finite test suite.

The first verified fragment is intentionally narrow. It excludes division, decimal/floating-point semantics, and general multiplication where neither operand is a non-negative integer literal. Those constructs are not silently described as verified.

## Remaining trust boundary

Beta 9 is **not full compiler verification**. Still unproved:

```text
Patch source bytes
   -> JavaScript parser / production AST
   -> independent RangeExpr / SourceStmt extraction
```

and:

```text
production runtime expression/state execution
   -> formal evalRangeExpr / SourceExecutes correspondence
```

The independent extractor and range-agreement check reduce the frontend trust boundary but do not prove the JavaScript parser or runtime correct.

## Prior-art boundary

Patch does not claim novelty for interval analysis, abstract interpretation, source calculi, compiler verification, translation validation, Proof-Carrying Code, effects, capabilities, quantitative analysis, provenance, undo or evidence checking. Those are established areas.

The candidate contribution remains the mandatory semantic mutation factorization and the derivation of operation-/magnitude-aware state-transition authority from that same representation. The formal range theorem strengthens the assurance argument for magnitude-aware contracts rather than serving as a firstness claim about range analysis.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, the project should still add:

- systematic related-work review;
- stronger production AST → `RangeExpr` / `SourceStmt` correspondence assurance;
- production-runtime/formal-evaluation and trace correspondence;
- direct compiled execution;
- two or three convincing semantic-security/engineering case studies;
- range/source/evidence/certificate/checker and runtime overhead measurements;
- reproducibility bundle;
- user evidence only if beginner simplicity remains a headline empirical claim.

The next most valuable formal step is no longer the basic range theorem. It is **closing the production correspondence gap**, first for supported AST extraction and then for production runtime traces.

## Manuscript integration

`main.tex` remains the working article source. Beta 9 results should be represented as a formal range-analysis subsection and reflected in the limitations/evaluation sections before an external submission snapshot is produced. `docs/RANGE_SOUNDNESS.md` contains the precise beta.9 theorem and current boundary for that integration.

## Build

```bash
cd paper
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript currently uses an inline bibliography, so BibTeX is not required for the artifact PDF. `references.bib` is maintained in parallel for later venue-template migration.

# Patch roadmap

Current development beta: **0.2.0-beta.28**

Checked items are implemented and must pass the final exact-head pull-request gates before merge. Unchecked items are not presented as finished features.

## Completed milestones

### 0.1–beta.9: language, Studio, semantic contracts and formal core
- [x] beginner-facing `create`, `change`, `show`, conditions, repeat, things and recipes
- [x] history, inverse generation, undo/redo, preview, watch and provenance foundations
- [x] compiler frontend, normalized Change IR, `.patchapp`, bootstrap Wasm and Patch Studio
- [x] first Window Designer slice
- [x] semantic Change Signatures + magnitude-aware Change Capabilities
- [x] ranged parameters / interval analysis
- [x] Lean State-Change Factorization, Mutation Transparency and Change Signature Soundness
- [x] verified semantic-policy checker and formal source/evidence correspondence
- [x] machine-checked integer `rangeAnalysisSound`

### beta.10–beta.18: executable backends and platform artifacts
- [x] direct numeric Wasm backend with no interpreter fallback
- [x] direct conditions, literal repeats, acyclic numeric recipes and ranged guards
- [x] interpreter/direct differential tests + independent transition/effect validation
- [x] standalone Web App
- [x] Windows/macOS/Linux Console + Window packages
- [x] remote Studio desktop builds
- [x] portable C99 backend + FreeBSD 15.1 compile/run gate

### beta.19–beta.24: source/runtime assurance + semantic Window input
- [x] independent raw-source SourceStmt/range extraction
- [x] proof-free runtime effects + `RuntimePath`
- [x] direct runtime → `SourceExecutes` correspondence
- [x] concrete runtime Change Capability containment
- [x] independent raw GuardTree/control-flow validation
- [x] guard-aware branch truth for a safe-integer recipe-parameter fragment
- [x] `input changed` exposes transient event-local `value`
- [x] persistent GUI updates still require semantic `change`
- [x] Studio/Web/Desktop Window input parity tests

### beta.25: formal acyclic recipe-call composition
- [x] Change IR **0.10** with separate `formalCalls` artifact
- [x] finite per-recipe `CallStmt` environment
- [x] bounded safe-integer argument intervals + finite call-graph ranks
- [x] conservative rejection of duplicates, unknown calls, unbounded params and cycles
- [x] `PatchCalls.lean`, `ArgsFit`, `BodyComposes`, `checkRecipeEnv`
- [x] rank-decreasing `CallExec`
- [x] `callSignatureSoundness`
- [x] `checkedRecipeExecutionCannotEscape`
- [x] production-generated `GeneratedCallCertificate.lean` accepted by pinned Lean

Beta.25 establishes **abstract interval/signature composition**, not concrete value substitution.

### beta.26: exact safe-integer binding + direct leaf-effect refinement
- [x] proof-free `src/concrete-call-witness.js`
- [x] exact caller values + expected positional callee `BindingList`
- [x] duplicate parameter names rejected explicitly at concrete binding boundary
- [x] `PatchCallSubstitution.lean` + `concreteCallBinding_sound`
- [x] `PatchCallRefinement.lean` + concrete value through beta.25 intervals
- [x] `PatchCallEffect.lean` + existing `EffectRefines`
- [x] `checkedConcreteBoundEffectRefinesCallerSignature`
- [x] generated `GeneratedConcreteCallCertificate.lean`
- [x] standard Formal CI + focused concrete-call Lean gate
- [x] Windows/macOS/Linux concrete certificate generation

### beta.27: arithmetic concrete-call certificate coverage
- [x] `src/concrete-call-certificate.js` certificate version **0.3**
- [x] preserve `RangeExpr.lit`, `var`, `add`, `sub`, `neg`, `scale`
- [x] `examples/formal-calls-arithmetic.patch`
- [x] `bonus + 1` exact inter-recipe argument binding
- [x] `amount * 2` exact direct quantitative leaf amount
- [x] Lean independently re-evaluates arithmetic under exact bound `IntEnv`
- [x] generated `GeneratedArithmeticCallCertificate.lean`
- [x] standard Formal CI and Windows/macOS/Linux certificate generation

Beta.27 is a **coverage extension of the already mechanized integer `RangeExpr` semantics**, not a new arithmetic theorem or novelty claim.

### beta.28: exact structured callee traces

Structured exact body semantics:
- [x] `formal/PatchCallBody.lean`
- [x] `BoundStmt.skip`
- [x] direct quantitative `BoundStmt.emit`
- [x] `BoundStmt.seq`
- [x] literal/static `BoundStmt.repeat`
- [x] relational `BoundExec`
- [x] executable `evalBoundStmt`
- [x] `evalBoundStmt_sound`
- [x] proof-free list comparison through verified `effectEqBool`
- [x] `evalBoundStmtEqBool_sound`
- [x] `BoundBodyCovered` + executable coverage checker
- [x] `TraceRefinesSignature`
- [x] `boundExecRefinesSignature`
- [x] `checkedEvaluatedBoundBodyRefinesSignature`

Interprocedural import:
- [x] `formal/PatchCallBodyImport.lean`
- [x] whole concrete callee trace imported through beta.25 `SignatureCovers`
- [x] `checkedConcreteCallBodyRefinesCallerSignature`
- [x] exact call binding and full supported callee trace established in one certificate theorem

Production evidence and reproducibility:
- [x] `src/concrete-call-body.js`
- [x] `src/concrete-call-body-certificate.js`
- [x] `examples/formal-callee-trace.patch`
- [x] `callee-trace-certify:example`
- [x] generated `GeneratedConcreteCallBodyCertificate.lean`
- [x] focused beta.28 pinned-Lean workflow
- [x] standard Formal CI integration
- [x] standard Windows/macOS/Linux certificate generation
- [x] conservative rejection of branches, nested calls, dynamic repeats and unsupported amount expressions

Beta.28 proves complete exact semantic-effect traces for the supported **sequence/static-repeat direct quantitative callee-body fragment**. It does not prove arbitrary structured source execution or production-Wasm call equivalence.

## Current product priorities

### Studio / Designer
- [x] semantic input `changed` without hidden persistent assignment
- [x] control selection and property inspector
  - [x] parsed source-backed selection for Text/Button/Input controls
  - [x] id/text-expression edits write back to `main.patch`
  - [x] id renames propagate to matching event headers
  - [x] invalid/duplicate ids fail closed
  - [x] Delete removes associated event-handler blocks
  - [x] keyboard selection, Source jump and offline inspector assets
- [ ] drag positioning/resizing
- [ ] richer controls/event editing
- [ ] project import/export
- [ ] immediate mode and provenance timeline

### Desktop quality
- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] FreeBSD Console through portable C99
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend
- [ ] FreeBSD Window package
- [ ] signing/notarization/installers
- [ ] build service without personal GitHub token

## Research hardening priorities

Completed:
- [x] State-Change Factorization + Mutation Transparency
- [x] Change Signature Soundness
- [x] verified semantic policy checker
- [x] source/evidence correspondence + integer range soundness
- [x] source/guard translation validation
- [x] direct runtime transition/effect validation
- [x] guarded runtime/capability correspondence
- [x] finite rank-decreasing recipe-call semantic-signature composition
- [x] exact safe-integer inter-recipe binding checked by Lean
- [x] direct bound quantitative leaf effect refined into caller semantic signature
- [x] full already-mechanized integer `RangeExpr` fragment carried through concrete call certificates
- [x] **structured callee-body execution under exact bindings for direct emits + sequence + static repeat**
- [x] **complete exact semantic-effect trace imported into caller signature for that fragment**

Highest-value remaining research work:
- [ ] branch/guard-aware exact callee traces
- [ ] nested-call and complete transitive concrete call-trace semantics
- [ ] connect concrete call certificates to observed direct-Wasm call execution
- [ ] semantic-security/plugin case studies
- [ ] certificate/checker/backend overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## High-venue artifact gate

- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness + formal capability containment
- [x] verified semantic policy checker
- [x] machine-checked integer range fragment
- [x] independent SourceStmt/range and GuardTree translation validation
- [x] direct compiled execution + independent effect validation
- [x] guarded runtime/capability correspondence
- [x] abstract acyclic recipe-call signature composition
- [x] exact safe-integer concrete call binding
- [x] arithmetic `RangeExpr` concrete certificate coverage
- [x] exact direct leaf effect refinement through caller signature
- [x] structured exact callee trace for sequence/static-repeat bodies
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input preserves explicit persistent `change`
- [ ] guard-aware exact callee traces
- [ ] transitive/nested concrete call traces
- [ ] call-aware direct-Wasm runtime correspondence
- [ ] security/engineering case studies
- [ ] overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## Design constraints

1. Advanced machinery stays ignorable by beginners.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Console and GUI applications share state/change semantics.
4. High-venue claims come from formal properties and measured evidence, not product polish.
5. Unsupported assurance cases fail conservatively instead of silently weakening the claim.
6. `why` is recorded provenance, not universal causality.
7. Translation validation does not imply JavaScript parser correctness.
8. Runtime/call witnesses remain proof-free evidence; Lean checks only explicitly supported obligations.
9. Beta.25 call claims are abstract interval/signature-level.
10. Beta.26 adds exact binding/direct leaf refinement.
11. Beta.27 broadens the certificate to the existing integer `RangeExpr` fragment.
12. Beta.28 adds exact whole-trace semantics for direct quantitative sequence/static-repeat callee bodies, not branches, nested calls or Wasm equivalence.
13. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
14. Direct-Wasm/C99 support is narrower than the full Patch language.
15. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

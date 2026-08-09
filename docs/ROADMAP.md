# Patch roadmap

Current development beta: **0.2.0-beta.30**

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
- [x] preserve `RangeExpr.lit`, `var`, `add`, `sub`, `neg`, `scale`
- [x] `examples/formal-calls-arithmetic.patch`
- [x] exact arithmetic call arguments and direct quantitative amounts
- [x] Lean independently re-evaluates arithmetic under exact bound `IntEnv`
- [x] generated `GeneratedArithmeticCallCertificate.lean`

Beta.27 is a coverage extension of the already mechanized integer `RangeExpr` semantics, not a separate arithmetic novelty claim.

### beta.28: exact structured callee traces
- [x] `formal/PatchCallBody.lean`
- [x] `BoundStmt.skip`, quantitative `emit`, `seq`, literal/static `repeat`
- [x] relational `BoundExec` + executable `evalBoundStmt`
- [x] `evalBoundStmt_sound`
- [x] proof-free effect-list comparison through verified `effectEqBool`
- [x] `BoundBodyCovered` + executable coverage checker
- [x] `TraceRefinesSignature`
- [x] `checkedEvaluatedBoundBodyRefinesSignature`
- [x] `formal/PatchCallBodyImport.lean`
- [x] whole concrete callee trace imported through beta.25 `SignatureCovers`
- [x] `checkedConcreteCallBodyRefinesCallerSignature`
- [x] generated `GeneratedConcreteCallBodyCertificate.lean`

### beta.29: guard-aware exact structured callee traces
- [x] `BoundStmt.branch GuardExpr thenBranch elseBranch`
- [x] reuse verified `GuardExpr` / `evalGuard`
- [x] evaluate guards under beta.26 exact `envOfBindings`
- [x] exact true/false branch selection in `evalBoundStmt`
- [x] both branch arms remain statically covered by the callee signature
- [x] `src/concrete-call-body.js` witness format **0.2**
- [x] `src/concrete-call-body-certificate.js` certificate format **0.2**
- [x] `examples/formal-callee-guard.patch`
- [x] generated `GeneratedGuardedCallBodyCertificate.lean`
- [x] focused pinned-Lean beta.29 gate plus beta.28 regression
- [x] state-dependent exact guards, nested calls and dynamic repeat fail closed

Beta.29 proves exact selected semantic-effect traces for the supported **GuardExpr + sequence/static-repeat direct quantitative callee-body fragment**, while requiring static signature coverage for both branch arms.

### beta.30: finite transitive exact call-tree traces

Formal call-tree semantics:
- [x] preserve beta.29 `BoundStmt` as the call-free regression layer
- [x] add `formal/PatchCallTree.lean`
- [x] `CallTreeStmt.base`, `seq`, literal/static `repeat`, exact `branch` and nested `call`
- [x] make exact `BindingList` an execution index so nested calls can switch to a newly checked callee environment
- [x] recursively re-evaluate nested `RangeExpr` arguments through existing `concreteCallBinding`
- [x] exact nested branch/repeat/effect evaluation
- [x] make semantic signature an indexed coverage relation so nested bodies are checked against their own callee signatures
- [x] mechanically require strict beta.25 rank decrease at every nested call-tree edge
- [x] recursively import nested traces through one `SignatureCovers` edge at a time
- [x] `callTreeCoveredBool` + soundness
- [x] `evalCallTreeStmtEqBool` + soundness
- [x] `checkedEvaluatedCallTreeRefinesSignature`
- [x] `checkedConcreteTransitiveCallTreeRefinesCallerSignature`

Production evidence:
- [x] `src/transitive-call-body.js` preserves recursive call-tree structure rather than flattening nested effects
- [x] `src/transitive-call-body-certificate.js`
- [x] `examples/formal-transitive-calls.patch` with `caller → outer → middle → leaf`
- [x] strongest example preserves two nested call levels and exact trace `score +4, coins +3`
- [x] Lean checks strict rank decrease for the outer certified edge and every nested edge
- [x] Lean connects concrete outer values through beta.25 abstract intervals into declarations
- [x] generated `GeneratedTransitiveCallBodyCertificate.lean` is regenerated and accepted by pinned Lean in CI
- [x] standard Formal CI verifies beta.30
- [x] Windows/macOS/Linux standard CI generates beta.30 evidence
- [x] beta.29 certificate retained as regression evidence in the focused beta.30 gate
- [x] Change IR remains **0.10** because beta.30 is an assurance/certificate layer, not a production IR schema change

Beta.30 proves complete finite selected transitive semantic-effect traces for the supported rank-decreasing safe-integer call-tree fragment. This is supporting assurance, not a new firstness claim.

Explicit beta.30 exclusions remain:
- root-program certification;
- recursive/cyclic call trees;
- dynamic repeat;
- persistent-state exact guard variables;
- returns;
- expressions outside the verified safe-integer `RangeExpr`/`GuardExpr` fragments;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

## Current product priorities

### Studio / Designer
- [x] semantic input `changed` without hidden persistent assignment
- [x] source-backed control selection and property inspector
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
- [x] project-specific sealed Console executable packaging
- [x] sandboxed/validated prebuilt Window runtime path
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend
- [ ] FreeBSD Window package
- [ ] signing/notarization/installers
- [ ] direct-native AOT backend

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
- [x] structured callee-body execution for direct emits + sequence + static repeat
- [x] guard-aware exact selected callee traces + both-arm static coverage
- [x] **finite nested/transitive exact call-tree traces**
- [x] **mechanically checked rank decrease and edge-by-edge signature import across the certified call tree**

Highest-value remaining research work:
- [ ] connect finite transitive concrete call certificates to observed direct-Wasm call execution
- [ ] extend direct-Wasm/runtime correspondence to the certified call-tree fragment
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
- [x] exact structured and guard-selected callee traces
- [x] **finite transitive/nested concrete call traces**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input preserves explicit persistent `change`
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
12. Beta.28 adds exact whole-trace semantics for direct quantitative sequence/static-repeat callee bodies.
13. Beta.29 adds exact formal-guard branch selection over recipe parameters.
14. Beta.30 adds finite recursive call-tree evaluation with exact nested binding, rank decrease and edge-by-edge signature import; it still excludes runtime-Wasm call equivalence.
15. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
16. Direct-Wasm/C99 support is narrower than the full Patch language.
17. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

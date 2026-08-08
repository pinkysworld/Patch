# Patch roadmap

Current development beta: **0.2.0-beta.24**

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

### beta.19: independent source translation validation
- [x] independent raw-source SourceStmt/range parser without `parser.js`
- [x] structural/range comparison against production formalSource
- [x] certificate gate + tamper tests

### beta.20–beta.21: runtime → formal correspondence
- [x] `PatchRuntime.lean`
- [x] `EffectRefines`, `TraceRefines` and proof-free runtime occurrence decoding
- [x] `RuntimePath`: leaf/seq/branchThen/branchElse/repeatZero/repeatSucc
- [x] `decodeCorePath_sound`
- [x] branch/repeat/multiple protected invocation runtime certificates
- [x] correct Window build routing + Standalone Window Web App

### beta.22: Window hardening + concrete runtime capability containment
- [x] executable generated-HTML differential Window tests
- [x] multi-operation Change semantics aligned with `PatchInterpreter`
- [x] shared Window runtime-support preflight
- [x] duplicate/missing control-event validation
- [x] button `clicked` as first portable event subset
- [x] `PatchRuntimeCapability.lean`
- [x] `allowsRefinedEffect`, `traceRefinesPreservesPolicy`
- [x] `checkedConcreteRuntimeCannotEscape`
- [x] generated runtime certificates include/Lean-check the declared policy

### beta.23: guard-aware runtime correspondence

Compiler/translation-validation:
- [x] Change IR **0.9** with `guardValidation`
- [x] formalSource **0.3** parallel `guardTree` / `guardClaims` representation
- [x] conservative `formal-guard.js` integer/Boolean guard normalizer
- [x] independent raw-source GuardTree/control-flow parser
- [x] GuardTree/guard-claim/recipe-variable comparison against production extraction
- [x] guard extraction tamper tests
- [x] guard support remains separate from existing static SourceStmt support

Runtime evidence / Lean:
- [x] RuntimePath witness schema 0.2 records concrete protected-recipe parameter environments
- [x] runtime certificate requires independent guard validation
- [x] generated certificates contain SourceStmt, GuardTree, IntEnv, observed effects, RuntimePath and policy
- [x] `PatchGuarded.lean`, `GuardExpr`, `evalGuard`, `GuardTree`, `GuardShape`, `GuardPathValid`
- [x] Then/Else witnesses checked against concrete guard truth
- [x] `checkGuardedSourceRuntimeEvidence_sound`
- [x] `checkedGuardedConcreteRuntimeCannotEscape`
- [x] generated guard-aware direct-runtime certificate accepted by pinned Lean

### beta.24: semantic Window input events

State/change semantics:
- [x] `input changed` exposes transient event-local `value`
- [x] editing a control does not directly assign persistent Patch state
- [x] persistent input updates still require ordinary semantic `change`
- [x] interpreter-backed event execution records normal Change history/provenance when source commits

Cross-target implementation:
- [x] `src/window-events.js` shared transient-payload adapter
- [x] Patch Studio interactive Window preview routes DOM input through the adapter
- [x] generated Windows/macOS/Linux desktop player routes the same payload contract
- [x] Standalone Window Web runtime 0.3 implements the same transient-value rule
- [x] shared Window preflight supports exactly button `clicked` and input `changed`
- [x] unsupported event/control pairs still fail before packaging

Regression/release hardening:
- [x] unit test: changed value can be observed without persistent mutation
- [x] unit test: explicit `change ... set = value` persists and creates Change history/provenance
- [x] generated single-file Window HTML fake-DOM test for observation-only input
- [x] generated single-file Window HTML fake-DOM test for explicit semantic persistence
- [x] cross-target source gates require Studio/Web/Desktop wiring
- [x] PWA cache includes `window-events.js`
- [x] Window event adapter is included in syntax/site consistency gates

Beta.24 is product/semantic-consistency evidence for State-Change Factorization; it does not add a new primary formal novelty claim.

## Current product priorities

### Studio / Designer
- [x] explicit semantic `input changed` event value without hidden persistent assignment
- [ ] control selection and property inspector
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
- [x] independent raw-source SourceStmt/range translation validation
- [x] direct runtime transition/effect validation
- [x] path-witnessed SourceExecutes/runtime refinement
- [x] concrete runtime Change Capability containment
- [x] **guard-aware branch truth for the safe-integer recipe-parameter fragment**
- [x] **independent GuardTree/control-flow translation validation**

Highest-value remaining research work:
- [ ] **formal recipe-call/substitution semantics** for the already implemented acyclic direct subset
- [ ] smaller independently checked lowering boundary beyond current JS translation validation
- [ ] semantic-security/plugin case studies
- [ ] backend/source-validation/certificate/checker overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## High-venue artifact gate

- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness + formal capability containment
- [x] verified semantic policy checker
- [x] machine-checked useful integer range fragment
- [x] independent SourceStmt/range translation validation
- [x] direct compiled execution + independent effect validation
- [x] branch/repeat/multi-invocation RuntimePath correspondence
- [x] concrete runtime capability containment
- [x] guard-aware branch truth correspondence for an explicit fragment
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input path preserves explicit persistent `change` rather than adding hidden assignment
- [ ] formal recipe-call/substitution correspondence
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
8. RuntimePath and invocation environments are proof-free evidence; Lean checks them against formal artifacts.
9. Beta.23 guard-aware claims cover safe-integer recipe parameters, not arbitrary persistent-state guards or floating-point semantics.
10. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
11. Direct-Wasm/C99 support is narrower than the full Patch language.
12. Window packages are standalone but not yet native-widget generation.
13. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

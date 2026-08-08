# Patch roadmap

Current development beta: **0.2.0-beta.25**

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

### beta.19–beta.23: translation validation and runtime/formal correspondence
- [x] independent raw-source SourceStmt/range extraction
- [x] proof-free runtime effects + `RuntimePath`
- [x] direct runtime → `SourceExecutes` correspondence
- [x] concrete runtime Change Capability containment
- [x] independent raw GuardTree/control-flow validation
- [x] guard-aware branch truth for a safe-integer recipe-parameter fragment
- [x] `PatchGuarded.lean` + generated guard-aware runtime certificates

### beta.24: semantic Window input events
- [x] `input changed` exposes transient event-local `value`
- [x] editing a control does not directly assign persistent Patch state
- [x] persistent input updates require ordinary semantic `change`
- [x] Studio, standalone Window Web and desktop Window players share the contract
- [x] fake-DOM generated-HTML tests distinguish observation-only input from explicit persistence
- [x] portable event surface is button `clicked` + input `changed`

### beta.25: formal acyclic recipe-call composition

Production artifact:
- [x] Change IR **0.10** with separate `formalCalls` artifact
- [x] finite per-recipe CallStmt environment
- [x] safe-integer parameter intervals and formal argument-interval extraction
- [x] rank assignment for the finite acyclic call graph
- [x] duplicate recipes, unknown callees, unbounded parameters and recursion/cycles rejected conservatively
- [x] direct semantic effects and imported callee signatures recorded separately

Lean:
- [x] `PatchCalls.lean`
- [x] `CallStmt`, `RecipeDef`, `RecipeEnv`
- [x] `ArgsFit` + `argsFitBool_sound`
- [x] executable semantic effect/signature containment checks
- [x] `BodyComposes` + `checkCallStmt_sound`
- [x] `checkRecipeEnv` + `checkRecipeEnv_sound`
- [x] rank-decreasing `CallExec`
- [x] `callSignatureSoundness`
- [x] `checkedRecipeExecutionCannotEscape`

Production → Lean connection:
- [x] `src/call-certificate.js`
- [x] generated `GeneratedCallCertificate.lean`
- [x] production-generated finite `RecipeEnv` accepted by Lean `native_decide`
- [x] generated environment derives `EnvironmentChecked`
- [x] Windows/macOS/Linux producer generation in normal CI
- [x] CLI dispatcher exposes `patch call-certify`

Claim boundary:
- [x] abstract argument interval fit and semantic-signature composition
- [ ] **concrete argument expression evaluation + exact parameter binding/substitution semantics**
- [ ] concrete call-runtime correspondence to the production Wasm execution

Beta.25 therefore closes the first formal interprocedural composition gap without claiming that concrete value substitution is already verified.

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
- [x] guard-aware branch truth + independent GuardTree validation
- [x] **finite rank-decreasing recipe-call semantic-signature composition**
- [x] **production-generated call environment checked by Lean**

Highest-value remaining research work:
- [ ] **concrete recipe argument evaluation / parameter binding / substitution semantics**
- [ ] compose concrete call substitution with the existing abstract call-signature theorem
- [ ] semantic-security/plugin case studies
- [ ] backend/source-validation/certificate/checker overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## High-venue artifact gate

- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness + formal capability containment
- [x] verified semantic policy checker
- [x] useful machine-checked integer range fragment
- [x] independent SourceStmt/range and GuardTree translation validation
- [x] direct compiled execution + independent effect validation
- [x] branch/repeat/multi-invocation RuntimePath correspondence
- [x] concrete runtime capability containment
- [x] guard-aware branch truth correspondence for an explicit fragment
- [x] **abstract acyclic recipe-call signature composition with generated Lean certificate**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input path preserves explicit persistent `change`
- [ ] concrete interprocedural parameter substitution correspondence
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
8. RuntimePath, invocation environments and formalCalls are proof-free evidence; Lean checks the supported claims built from them.
9. Beta.23 guard-aware claims cover a safe-integer parameter fragment, not arbitrary persistent-state guards or floating-point semantics.
10. Beta.25 call claims are interval/signature-level; concrete value substitution is future work.
11. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
12. Direct-Wasm/C99 support is narrower than the full Patch language.
13. Window packages are standalone but not yet native-widget generation.
14. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

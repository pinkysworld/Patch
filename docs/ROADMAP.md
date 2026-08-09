# Patch roadmap

Current development beta: **0.2.0-beta.26**

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
- [x] Change IR **0.10** with separate `formalCalls` artifact
- [x] finite per-recipe `CallStmt` environment
- [x] safe-integer parameter/argument intervals
- [x] finite acyclic call-graph rank assignment
- [x] conservative rejection of duplicates, unknown calls, unbounded params and cycles
- [x] `PatchCalls.lean`, `ArgsFit`, `BodyComposes`, `checkRecipeEnv`
- [x] rank-decreasing `CallExec`
- [x] `callSignatureSoundness`
- [x] `checkedRecipeExecutionCannotEscape`
- [x] generated `GeneratedCallCertificate.lean` accepted by pinned Lean
- [x] cross-platform call-certificate producer + `patch call-certify`

Beta.25 establishes **abstract interval/signature composition**, not concrete value substitution.

### beta.26: concrete safe-integer call binding + direct leaf-effect refinement

Concrete production evidence:
- [x] `src/concrete-call-witness.js`
- [x] proof-free caller bindings, formal argument expressions, exact values and expected callee bindings
- [x] beta.25 abstract argument intervals carried alongside exact values
- [x] conservative inter-recipe variable-pass-through subset
- [x] branch-following witness generation for supported concrete calls
- [x] out-of-range calls rejected no later than the normal compiler boundary

Lean binding/refinement:
- [x] `PatchCallSubstitution.lean`
- [x] serializable `BindingList` + `envOfBindings` into the established functional `IntEnv`
- [x] exact `evalCallArgs`
- [x] exact positional `bindCallParams`
- [x] `ConcreteArgsFit`
- [x] `concreteCallBinding_sound`
- [x] `PatchCallRefinement.lean`
- [x] `valueFitsWithin`
- [x] `concreteArgsFitThroughAbstract`
- [x] `concreteThroughAbstractBool_sound`

Direct concrete semantic effect:
- [x] `PatchCallEffect.lean`
- [x] exact singleton effect amount from a bound safe-integer variable
- [x] `evalBoundQuantitativeEffect_sound` using existing `EffectRefines`
- [x] executable `evalBoundQuantitativeEffectEqBool` without adding global `DecidableEq Effect`
- [x] `checkedConcreteBoundEffectRefinesCallerSignature`
- [x] concrete direct leaf effect composed with beta.25 callee-to-caller signature containment

Production → Lean connection:
- [x] `src/concrete-call-certificate.js`
- [x] generated `GeneratedConcreteCallCertificate.lean`
- [x] Lean re-evaluates inter-recipe variable arguments and reconstructs exact positional bindings
- [x] Lean checks exact values through beta.25 abstract intervals to declarations
- [x] generated `reward -> add_points` leaf effects refine imported caller-signature effects
- [x] focused beta.26 Lean gate green without `sorry`/`admit`
- [x] standard Formal CI includes beta.26 modules/certificate
- [x] normal Windows/macOS/Linux CI generates the concrete-call certificate

Claim boundary:
- [x] concrete inter-recipe variable argument evaluation + exact parameter binding
- [x] exact value → beta.25 interval → declared parameter composition
- [x] conservative direct quantitative leaf effect → caller-signature refinement
- [ ] root-program concrete call certification
- [ ] richer arithmetic argument/substitution certification
- [ ] arbitrary callee body/control-flow execution under exact bindings
- [ ] full transitive concrete call trace correspondence
- [ ] production direct-Wasm call execution equivalence

Beta.26 therefore closes a concrete binding/effect gap while explicitly stopping short of end-to-end call or compiler verification.

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
- [x] finite rank-decreasing recipe-call semantic-signature composition
- [x] production-generated abstract call environment checked by Lean
- [x] **exact safe-integer inter-recipe variable binding checked by Lean**
- [x] **direct bound quantitative leaf effect refined into caller semantic signature**

Highest-value remaining research work:
- [ ] richer concrete `RangeExpr` call argument certification
- [ ] arbitrary structured callee-body execution under exact bindings
- [ ] connect concrete call certificates to observed direct-Wasm call execution
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
- [x] abstract acyclic recipe-call signature composition with generated Lean certificate
- [x] concrete safe-integer nested call binding for an explicit subset
- [x] exact direct leaf effect refinement through caller signature
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input path preserves explicit persistent `change`
- [ ] structured concrete callee execution beyond one direct leaf effect
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
8. RuntimePath, invocation environments, formalCalls and concrete call witnesses are proof-free evidence; Lean checks only the explicitly supported claims built from them.
9. Beta.23 guard-aware claims cover a safe-integer parameter fragment, not arbitrary persistent-state guards or floating-point semantics.
10. Beta.25 call claims are abstract interval/signature-level.
11. Beta.26 concrete call claims cover variable pass-through binding and a direct quantitative leaf-effect subset, not arbitrary substitution/runtime equivalence.
12. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
13. Direct-Wasm/C99 support is narrower than the full Patch language.
14. Window packages are standalone but not yet native-widget generation.
15. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

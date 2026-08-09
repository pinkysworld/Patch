# Patch roadmap

Current development beta: **0.2.0-beta.27**

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

Beta.26's production encoder deliberately certifies inter-recipe **variable pass-through** arguments and one direct quantitative leaf-effect subset.

### beta.27: arithmetic concrete-call certificate coverage

Production-to-formal expression preservation:
- [x] `src/concrete-call-certificate.js` certificate version **0.3**
- [x] recursively encode `RangeExpr.lit`
- [x] recursively encode `RangeExpr.var`
- [x] recursively encode `RangeExpr.add`
- [x] recursively encode `RangeExpr.sub`
- [x] recursively encode `RangeExpr.neg`
- [x] recursively encode `RangeExpr.scale` by non-negative integer literal
- [x] preserve unsupported boundary for division, decimals and general variable multiplication

Exact arithmetic call/effect certificate:
- [x] `examples/formal-calls-arithmetic.patch`
- [x] `bonus + 1` exact inter-recipe argument binding
- [x] `amount * 2` exact direct quantitative leaf amount
- [x] JavaScript claimed singleton amount remains proof-free
- [x] Lean independently re-evaluates arithmetic under exact bound `IntEnv`
- [x] exact value still checked through beta.25 abstract interval → callee declaration
- [x] exact arithmetic leaf effect still checked through `EffectRefines` → caller signature
- [x] subtraction/unary-negation concrete binding regression test
- [x] division remains conservatively rejected

Reproducibility/gates:
- [x] `arithmetic-call-certify:example`
- [x] generated `GeneratedArithmeticCallCertificate.lean`
- [x] dedicated `Patch Beta27 Arithmetic Calls` pinned-Lean workflow
- [x] standard Formal CI generates/checks both beta.26 and beta.27 concrete certificates
- [x] normal Windows/macOS/Linux CI generates both concrete certificate variants

Beta.27 is a **coverage extension of the already mechanized integer `RangeExpr` semantics**, not a new arithmetic theorem or novelty claim.

## Current product priorities

### Studio / Designer
- [x] semantic input `changed` without hidden persistent assignment
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
- [x] source/guard translation validation
- [x] direct runtime transition/effect validation
- [x] guarded runtime/capability correspondence
- [x] finite rank-decreasing recipe-call semantic-signature composition
- [x] exact safe-integer inter-recipe binding checked by Lean
- [x] direct bound quantitative leaf effect refined into caller semantic signature
- [x] **full already-mechanized integer `RangeExpr` fragment carried through concrete call certificates**

Highest-value remaining research work:
- [ ] **structured callee-body execution under exact bindings** beyond one direct leaf effect
- [ ] complete transitive concrete call-trace semantics
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
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] GUI input preserves explicit persistent `change`
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
8. Runtime/call witnesses remain proof-free evidence; Lean checks only explicitly supported obligations.
9. Beta.25 call claims are abstract interval/signature-level.
10. Beta.26 adds exact binding/direct leaf refinement.
11. Beta.27 broadens the certificate to the existing integer `RangeExpr` fragment; it does not prove arbitrary callee execution or Wasm equivalence.
12. GUI control editing is transient; persistent GUI state changes only through semantic `change`.
13. Direct-Wasm/C99 support is narrower than the full Patch language.
14. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

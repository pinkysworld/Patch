# Patch roadmap

Current development beta: **0.2.0-beta.22**

Checked items are implemented and must pass the final pull-request gates before merge. Unchecked items are not presented as finished features.

## Completed milestones

### 0.1–beta.2: language, compiler, Studio and semantic contracts
- [x] beginner-facing `create`, `change`, `show`, conditions, repeat, things and recipes
- [x] history, inverse generation, undo/redo, preview, watch and provenance foundations
- [x] compiler front end, normalized Change IR, `.patchapp`, bootstrap Wasm and browser-first Studio
- [x] first Window Designer slice
- [x] semantic Change Signatures and magnitude-aware Change Capabilities

### beta.3–beta.9: formal core and quantitative assurance
- [x] ranged parameters and interval analysis
- [x] Lean State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness and formal capability containment
- [x] production/formal semantic bridge
- [x] verified semantic-policy checker
- [x] proof-free EvidenceStmt decoding and SourceStmt correspondence
- [x] machine-checked integer `rangeAnalysisSound`

### beta.10–beta.15: direct WebAssembly and independent runtime validation
- [x] direct numeric Wasm backend with no interpreter fallback
- [x] numeric state/change/show, arithmetic, conditions, literal repeat and recipes
- [x] ranged runtime guards
- [x] interpreter/direct differential tests
- [x] independent Change-IR transition/effect reconstruction
- [x] runtime effects checked against Change Signatures and Change Capabilities

### beta.16–beta.18: standalone apps, cross-platform builds and FreeBSD
- [x] standalone Console Web App
- [x] Windows/macOS/Linux Console and Window packages
- [x] remote Studio desktop build workflow
- [x] portable C99 backend and FreeBSD 15.1 compile/run gate
- [x] FreeBSD Console from Patch Studio

### beta.19: independent raw-source extraction validation
- [x] Change IR 0.8 `sourceValidation`
- [x] Independent raw-source parser without `parser.js`
- [x] independent SourceStmt/range reconstruction and structural comparison
- [x] certificate gate and tamper tests
- [x] explicit translation-validation framing

### beta.20: first runtime → Lean source-execution correspondence
- [x] `PatchRuntime.lean`
- [x] `EffectRefines`, `TraceRefines` and proof-free runtime occurrence decoding
- [x] linear `checkSourceRuntimeEvidence_sound`
- [x] direct-Wasm runtime certificate bound to source + observed-trace hashes
- [x] `patch runtime-certify`

### beta.21: Window build routing + path-witnessed runtime correspondence
- [x] correct normalized `code == "WINDOW"` Studio preflight
- [x] **Standalone Window Web App** instead of routing GUI source into Console Direct Wasm
- [x] Direct WebAssembly remains explicitly Console-only
- [x] network-first Studio HTML/JS refresh with beta cache fallback
- [x] proof-free `RuntimePath`: leaf/seq/branchThen/branchElse/repeatZero/repeatSucc
- [x] Lean `decodeCorePath_sound`
- [x] branch/repeat/multiple protected invocation runtime certificates

### beta.22: Window runtime hardening + concrete runtime capability containment

Product/build work:
- [x] generated Window Web runtime evaluates later operations in one `change` against the already-updated target, matching `PatchInterpreter`
- [x] Window Web create-type checks match interpreter behavior
- [x] Window Web Thing-field validity checks match interpreter behavior
- [x] single-quoted expression decoding aligned with the shared expression semantics
- [x] executable generated-HTML differential regression harness
- [x] actual Counter button-click rerender regression test
- [x] shared Window runtime-support preflight
- [x] reject duplicate control ids and handlers for nonexistent controls
- [x] conservatively expose button `clicked` as the current portable event subset
- [x] browser preflight and target-side desktop packager both repeat Window support validation

Formal/runtime work:
- [x] `PatchRuntimeCapability.lean`
- [x] `allowsRefinedEffect`: authority is downward closed under `EffectRefines`
- [x] `traceRefinesPreservesPolicy`
- [x] `checkedConcreteRuntimeCannotEscape`
- [x] generated runtime certificates now contain and Lean-check the declared policy
- [x] each accepted concrete protected invocation gets a concrete-runtime capability theorem
- [x] formal CI builds the new module and generated certificate with no `sorry`/`admit`

See [RUNTIME_CORRESPONDENCE.md](RUNTIME_CORRESPONDENCE.md).

## Current product priorities

### Studio / Designer
- [ ] explicit semantic input/change event value without hidden assignment
- [ ] control selection and property inspector
- [ ] drag positioning/resizing
- [ ] richer controls and event editing
- [ ] project import/export
- [ ] immediate mode and provenance timeline

### Desktop platform quality
- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] FreeBSD Console package through portable C99
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend
- [ ] FreeBSD Window package
- [ ] signing/notarization/installers
- [ ] build service without a personal GitHub token

## Research hardening priorities

Completed:
- [x] factorization + Mutation Transparency
- [x] Change Signature Soundness
- [x] verified policy checker
- [x] source/evidence/signature correspondence
- [x] integer range soundness
- [x] independent raw-source translation validation
- [x] direct runtime transition/effect validation
- [x] linear then path-witnessed runtime → SourceExecutes correspondence
- [x] **concrete decoded runtime effects formally contained by declared Change Capabilities**

Highest-priority remaining work:
- [ ] **typed, guard-aware execution core** so branch witness validity includes evaluation of the original Boolean guard rather than only structural branch choice
- [ ] formal recipe-call/substitution semantics inside the source model
- [ ] smaller independently checked lowering boundary
- [ ] semantic-security case studies and benchmark suite
- [ ] backend/certificate/checker overhead evaluation
- [ ] systematic related-work review and reproducibility bundle

## Research artifact gate

Before a high-venue submission:
- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness and formal capability containment
- [x] verified semantic policy checker
- [x] useful machine-checked integer range fragment
- [x] independent raw-source translation validation
- [x] direct compiled numeric execution + independent effect validation
- [x] RuntimePath-checked branch/repeat/multi-invocation correspondence
- [x] **concrete runtime capability containment theorem**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [ ] guard-aware typed execution correspondence
- [ ] recipe-call/substitution correspondence
- [ ] security/engineering case studies
- [ ] overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## Design constraints

1. Advanced machinery remains ignorable by a beginner.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Console and GUI applications share state/change semantics.
4. High-venue claims come from formal properties and measured evidence, not product polish.
5. Capability/range analysis fails conservatively when safety cannot be proved.
6. `why` describes recorded provenance, not universal causality.
7. Raw-source extraction is translation-validated; JavaScript parser correctness is not machine proved.
8. Direct-Wasm/C99 support is narrower than the full language; unsupported constructs fail explicitly.
9. `RuntimePath` is untrusted evidence; Lean validates it.
10. Current `CoreStmt.branch` is nondeterministic and does **not** retain source guard semantics; guard-aware execution is future work.
11. Window desktop packages are standalone but are not native-widget generation.
12. Window Web Apps use a generated browser runtime, not direct Wasm lowering.
13. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

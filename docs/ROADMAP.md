# Patch roadmap

Current development beta: **0.2.0-beta.21**

Checked items are implemented on the current beta.21 branch and must still pass the final pull-request gates before merge. Unchecked items are not presented as finished features.

## Completed milestones

### 0.1–beta.2: language, compiler, Studio and semantic contracts

- [x] beginner-facing `create`, `change`, `show`, conditions, repeat, things and recipes
- [x] history, inverse generation, undo/redo, preview, watch and provenance foundations
- [x] compiler front end and normalized Change IR
- [x] `.patchapp`, bootstrap Wasm and browser-first Patch Studio
- [x] first Window Designer slice
- [x] semantic Change Signatures and magnitude-aware Change Capabilities

### beta.3–beta.9: formal core and quantitative assurance

- [x] ranged parameters and interval analysis
- [x] Lean State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness and formal capability containment
- [x] production/formal semantic bridge
- [x] verified Lean semantic-policy checker
- [x] proof-free EvidenceStmt decoding
- [x] SourceStmt → EvidenceStmt / signature correspondence
- [x] formal source-runtime capability containment
- [x] machine-checked integer `rangeAnalysisSound`

### beta.10–beta.15: direct WebAssembly and independent runtime validation

- [x] direct numeric Wasm backend with no interpreter fallback
- [x] numeric state/change/show, arithmetic, conditions, literal repeat and recipes
- [x] ranged parameter guards at Wasm function boundaries
- [x] stable transition callback and target table
- [x] interpreter/direct output, state and trace differential tests
- [x] independent Change-IR transition execution model
- [x] concrete `increase/decrease/set/clear` and magnitude reconstruction
- [x] runtime effects checked against Change Signatures and Change Capabilities

### beta.16–beta.18: standalone apps, cross-platform builds and FreeBSD

- [x] standalone single-file Console Web App
- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] remote Studio build workflow from current unsaved source
- [x] desktop builds usable from iPhone/iPad Studio
- [x] portable C99 backend and Linux/macOS/FreeBSD 15.1 compile/run gates
- [x] FreeBSD Console target from Patch Studio

### beta.19: independent raw-source extraction validation

- [x] Change IR **0.8** with `sourceValidation` artifact
- [x] independent raw-source parser that does not import `parser.js`
- [x] independent SourceStmt/source-verb/range-claim reconstruction
- [x] comparison against AST-derived `formalSource`
- [x] source/range tamper tests and certificate gate
- [x] explicit translation-validation framing rather than parser-verification claims

### beta.20: first direct runtime → Lean source-execution correspondence

- [x] `PatchRuntime.lean`
- [x] `EffectRefines` and executable sound refinement checking
- [x] proof-free concrete runtime occurrence decoding
- [x] Patch-owned `TraceRefines` relation
- [x] linear execution reconstruction and `checkSourceRuntimeEvidence_sound`
- [x] direct-Wasm runtime certificate bound to source + observed-trace hashes
- [x] `patch runtime-certify`
- [x] formal CI verification of a generated runtime certificate
- [x] CI trigger cleanup to avoid duplicate feature-branch push matrices

### beta.21: Window build routing + path-witnessed runtime correspondence

Product/build work:

- [x] fix Studio Window preflight to inspect normalized `code == "WINDOW"` instead of nonexistent `instruction.op`
- [x] shared `src/window-build.js` validation helper + regression test using the Counter source
- [x] **Standalone Window Web App** backend instead of routing Window source into Console Direct Wasm
- [x] keep Direct WebAssembly explicitly Console-only with a useful compatibility message
- [x] Console/Window web routing based on project kind, including CLI inference
- [x] service-worker beta.21 cache + network-first HTML/JavaScript refresh to reduce stale Studio code
- [x] CI build gate for a real `examples/counter-window.patch --target web`

Formal/runtime work:

- [x] proof-free `RuntimePath` vocabulary: `leaf`, `seq`, `branchThen`, `branchElse`, `repeatZero`, `repeatSucc`
- [x] Lean `decodeCorePath` validates a proposed path against `CoreStmt`
- [x] `decodeCorePath_sound` connects an accepted path to the existing `Executes` relation
- [x] `checkSourceRuntimeEvidence` now consumes the explicit `RuntimePath`
- [x] `checkSourceRuntimeEvidence_sound` still yields a real `SourceExecutes` trace and `TraceRefines`
- [x] untrusted JavaScript runtime-path witness producer
- [x] multiple observed protected-recipe invocations segmented and certified separately
- [x] branch/repeat/multiple-invocation regression tests
- [x] generated CI runtime certificate now exercises branch + repeat + two invocations

See [RUNTIME_CORRESPONDENCE.md](RUNTIME_CORRESPONDENCE.md).

## Current product priorities

### Studio / Designer

- [ ] control selection and property inspector
- [ ] drag positioning and resizing
- [ ] event editing and richer controls
- [ ] stronger two-way input binding
- [ ] project import/export
- [ ] immediate mode and provenance timeline

### Desktop platform quality

- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] FreeBSD Console package through portable C99
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend
- [ ] local CLI Window packaging through the same dedicated Window builder
- [ ] FreeBSD Window package
- [ ] Windows signing
- [ ] macOS Developer ID signing/notarization
- [ ] installers/application resources
- [ ] build service without a personal GitHub token

### Additional Unix targets

- [x] generic C99 fallback architecture for the numeric Console subset
- [x] FreeBSD 15.1 compile/run gate
- [ ] OpenBSD compile/run gate before claiming support
- [ ] NetBSD compile/run gate before claiming support
- [ ] portable Unix GUI package path
- [ ] WASI command target for raw standalone Wasm execution

## Research hardening priorities

Completed:

- [x] State-Change Factorization + Mutation Transparency
- [x] Change Signature Soundness
- [x] verified policy checker
- [x] SourceStmt/EvidenceStmt/signature correspondence
- [x] machine-checked integer range-analysis soundness
- [x] independent raw-source translation validation
- [x] direct compiled numeric execution and independent effect validation
- [x] first linear runtime → SourceExecutes correspondence
- [x] **branch/repeat path-witnessed runtime correspondence and multiple protected invocations**

Highest-priority remaining work:

- [ ] typed expression/core IR or another independently checked lowering input
- [ ] formal recipe-call/substitution semantics inside the source model
- [ ] investigate a smaller verified/checkable frontend beyond JavaScript translation validation
- [ ] stable machine-readable certificate/container format
- [ ] semantic-security case studies and benchmark suite
- [ ] backend/certificate/checker overhead evaluation
- [ ] systematic related-work review and reproducibility bundle

## Research artifact gate

Before a high-venue submission:

- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness and formal capability containment
- [x] verified semantic policy checker
- [x] machine-checked useful integer range fragment
- [x] independent raw-source → SourceStmt/range translation validation
- [x] direct compiled numeric state/control/recipe execution
- [x] independent ordered transition and semantic-effect validation
- [x] Lean-checked runtime occurrence → SourceExecutes correspondence
- [x] **branch/repeat/multi-invocation RuntimePath checking**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [ ] typed expression/core IR or independently checked lowering input
- [ ] formal recipe-call/substitution correspondence
- [ ] benchmark suite and semantic-security case studies
- [ ] overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## Design constraints

1. Advanced machinery remains ignorable by a beginner.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Patch Studio remains practical on phone, tablet and desktop.
4. Console and GUI applications share state/change semantics.
5. High-venue claims come from formal properties and measured evidence, not product polish.
6. Bootstrap Wasm is never described as direct Wasm lowering.
7. Capability/range analysis fails conservatively when safety cannot be proved.
8. `why` describes recorded provenance, not universal causality.
9. Raw-source extraction is translation-validated; JavaScript parser correctness is not machine proved.
10. Range soundness applies only to the explicitly modeled integer fragment.
11. Direct-Wasm/C99 support is narrower than the full Patch language; unsupported constructs fail explicitly.
12. Differential/translation-validation tests are evidence, not compiler-correctness theorems.
13. `RuntimePath` is untrusted evidence; only Lean acceptance provides the formal execution witness.
14. Runtime guards complement compile-time analysis; they do not prove lowering correctness.
15. Window desktop packages are standalone but are not native-widget generation.
16. Window Web Apps use a generated browser runtime; they are not direct Wasm lowering.
17. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.

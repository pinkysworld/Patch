# Patch roadmap

Current development beta: **0.2.0-beta.20**

Checked items are implemented and tested in the repository or are part of the current beta.20 branch pending the final merge gate. Unchecked items are not presented as finished features.

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
- [x] transition/signature/capability tamper tests

### beta.16–beta.18: standalone apps, cross-platform builds and FreeBSD

- [x] standalone single-file Web App
- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] remote Studio build workflow from current unsaved source
- [x] desktop builds usable from iPhone/iPad Studio
- [x] portable C99 backend for the conservative numeric Console subset
- [x] C99 compile/run on Linux and macOS
- [x] FreeBSD 15.1 compile/run with base-system `cc`
- [x] FreeBSD Console target from Patch Studio

### beta.19: independent raw-source extraction validation

- [x] Change IR **0.8** with `sourceValidation` artifact
- [x] small indentation-aware raw-source validator that does not import `parser.js`
- [x] independent reconstruction of formal SourceStmt structure and source mutation verbs
- [x] independent reconstruction of formal integer range claims from raw expression text
- [x] structural comparison against AST-derived `formalSource`
- [x] SourceStmt and range-claim tamper tests
- [x] `patch formal` reports raw-source validation coverage
- [x] `patch certify` requires protected recipes to pass raw-source validation
- [x] public docs explicitly call this **translation validation**, not parser verification

### beta.20: direct runtime → Lean source-execution correspondence

- [x] new `PatchRuntime.lean` formal module
- [x] `EffectRefines` relation for concrete runtime occurrences versus abstract formal effects
- [x] executable `effectRefinesBool` with soundness theorem
- [x] proof-free runtime occurrence decoding
- [x] pointwise trace-refinement checker with soundness theorem
- [x] exact linear formal-evidence trace decoder with `Executes` soundness theorem
- [x] `checkSourceRuntimeEvidence` over formal `SourceStmt`
- [x] `checkSourceRuntimeEvidence_sound` deriving an actual formal `SourceExecutes` trace
- [x] direct-Wasm runtime certificate producer bound to source and observed-trace SHA-256 hashes
- [x] independent semantic-effect reconstruction before runtime evidence is emitted
- [x] `patch runtime-certify`
- [x] dedicated runtime-correspondence example and negative boundary tests
- [x] formal CI generation/verification path for `GeneratedRuntimeCertificate.lean`
- [x] CI trigger cleanup: full Patch/Lean push matrices run on `main`, while feature work is checked through pull requests instead of duplicate branch-push runs

See [RUNTIME_CORRESPONDENCE.md](RUNTIME_CORRESPONDENCE.md).

## Current product priorities

### Studio / Designer

- [ ] control selection and property inspector
- [ ] drag positioning and resizing
- [ ] event editing and richer controls
- [ ] two-way input binding
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
- [ ] Windows signing
- [ ] macOS Developer ID signing/notarization
- [ ] installer formats and application resources
- [ ] organization-level build service without a personal GitHub token

### Additional Unix targets

- [x] generic C99 fallback architecture for the numeric Console subset
- [x] FreeBSD 15.1 compile/run gate
- [ ] OpenBSD compile/run gate before claiming OpenBSD support
- [ ] NetBSD compile/run gate before claiming NetBSD support
- [ ] portable Unix GUI package path
- [ ] WASI command target for raw standalone Wasm execution

## Research hardening priorities

Completed:

- [x] factorization formal core
- [x] Change Signature Soundness
- [x] verified policy checker
- [x] proof-free evidence boundary
- [x] SourceStmt/EvidenceStmt/signature correspondence
- [x] machine-checked integer range-analysis soundness
- [x] production source/AST extraction assurance through independent raw-source translation validation
- [x] direct compiled numeric execution and ranged guards
- [x] independent transition/effect/contract validation
- [x] **first production/direct-runtime/formal effect correspondence for linear protected recipes**

Highest-priority remaining work:

- [ ] **extend runtime effect occurrences to explicit branch/repeat path witnesses and multiple recipe invocations**
- [ ] typed expression/core IR or another independently checked lowering input
- [ ] extend formal call/substitution semantics for the direct recipe subset
- [ ] investigate a smaller verified/checkable frontend beyond JavaScript source translation validation
- [ ] stable machine-readable certificate/container format
- [ ] semantic-security case studies and benchmark suite
- [ ] backend/certificate/checker overhead evaluation
- [ ] systematic related-work review and reproducibility bundle

## Research artifact gate

Before a high-venue submission:

- [x] State-Change Factorization and Mutation Transparency
- [x] Change Signature Soundness and formal capability containment
- [x] verified semantic policy checker
- [x] proof-free semantic evidence decoded by Lean
- [x] source-core correspondence checks
- [x] machine-checked range-analysis soundness for a useful integer fragment
- [x] independent raw-source → SourceStmt/range translation validation
- [x] direct compiled numeric state/control/recipe execution
- [x] independent ordered transition and semantic-effect validation
- [x] **Lean-checked linear runtime occurrence → SourceExecutes correspondence**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [ ] branch/repeat/multi-invocation runtime correspondence
- [ ] typed expression/core IR or independently checked lowering input
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
9. Raw-source extraction is independently translation-validated, but JavaScript parser correctness is **not machine proved**.
10. Range soundness applies only to the explicitly modeled integer fragment.
11. Division/floating point/general multiplication are not silently labeled formally verified.
12. Direct-Wasm/C99 support is narrower than the full Patch language; unsupported constructs fail explicitly.
13. Differential/translation-validation tests are evidence, not compiler-correctness theorems.
14. Runtime guards complement compile-time analysis; they do not prove lowering correctness.
15. Window packages are standalone on Windows/macOS/Linux but are not native-widget generation.
16. FreeBSD is Console-only; OpenBSD/NetBSD are not claimed until separately tested.
17. Beta.20 runtime correspondence is linear and integer-only; branches, repeats, multiple invocations and floating-point correspondence are rejected rather than overclaimed.

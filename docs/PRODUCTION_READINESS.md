# Patch production-readiness plan

Patch already has broad semantic/formal coverage and cross-platform build smoke tests. Production readiness is a different goal: users need stable artifacts, diagnostics, compatibility rules, safe upgrades and support boundaries even when they never use the research features.

This plan deliberately separates **P0 reliability work** from research novelty.

Current product baseline: **0.2.0-beta.35+**, Change IR **0.10**, Patch Studio project bundle **v3**, Native GUI IR **1.3**, sealed Window payload **v13** / runtime **v1.4**. Native GUI IR **1.2** / payload **v12** / runtime **v1.3** remains the frozen TreeView compatibility line. Those two live contracts are imported through `src/native-current-contract.js` and `src/native-frozen-contract.js`; see `docs/NATIVE_COMPATIBILITY.md`. The beta.32 formal runtime-correspondence boundary remains unchanged by later product work.

## P0: required before calling Patch production-ready

### Release integrity
- [x] deterministic SHA-256 release manifest tooling
- [x] versioned GitHub Release workflow that builds from an exact tag/commit
- [x] checksums attached beside every distributed tagged-release artifact
- [x] release manifest includes source commit and Patch version
- [x] release notes generated from reviewed changes
- [x] reproducibility check: rebuilding the same source/toolchain produces equivalent logical payloads where platform packaging permits

Tagged releases are fail-closed. `v<package version>` must point at the checked-out `GITHUB_SHA`; the workflow tests that exact source, builds the portable/Web/Wasm/C99/npm release bundle, generates `release-manifest.json` and `SHA256SUMS.txt`, independently re-hashes every artifact, verifies the recorded Patch version and source commit, and only then creates the release. Beta/pre-release package versions are published as GitHub prereleases.

Logical reproducibility is tested separately from native toolchain reproducibility. `scripts/logical-release-fingerprint.js` rebuilds portable PatchApp, bootstrap/direct Wasm, C99 and Console/Window Web artifacts. The regression suite launches two separate Node processes and requires identical byte-length/SHA-256 fingerprint documents. Final PE/Mach-O/ELF/signing/toolchain metadata remains outside that logical-byte claim.

### Compatibility and project lifecycle
- [x] document pre-1.0 compatibility policy
- [x] versioned Patch Studio project bundle format
- [x] project import/export
- [x] migrations for old project bundle schema versions
- [x] explicit refusal for unsupported future schema versions
- [x] source-language compatibility regression corpus
- [x] multi-file project bundle with deterministic composition and provenance
- [x] full-project recovery snapshots

Patch Studio project bundle **v3** is the current canonical browser project. It carries bounded multi-file Patch sources, deterministic composition/provenance, project identity, Console/Window kind, selected build target and selected native-build mode. Older v1/v2 bundles and legacy browser state migrate explicitly. Unknown future bundle versions remain fail-closed.

Programmatic sample/Designer mutations and normal typing use shared source/project signals, so the canonical store, recovery, visual Designer, Change Contract, Project Tree and native-build panel observe one project state. Recovery snapshots preserve the full v3 project rather than only `main.patch`.

`compat/source-0.2/` remains the executable source-compatibility baseline for forms Patch deliberately retains. Current compilers must keep those fixtures compiling with the recorded observable behavior unless a future compatibility change is handled explicitly.

### Diagnostics and supportability
- [x] `patch doctor` structured diagnostics core
- [x] expose `patch doctor --json` through the installed CLI
- [x] `patch doctor` compiler-backend self-check for interpreter, direct Wasm/C99 numeric subset and Thing fail-closed
- [x] `patch doctor` host-compiles and runs the numeric C99 program on Unix when a C compiler is present
- [x] stable machine-readable diagnostic/error codes for compiler/build failures
- [x] `PATCH2003` for direct Wasm/C99 numeric-subset fail-closed errors
- [x] one-click Copy diagnostics in Patch Studio
- [x] crash/build report bundle with Patch version, target, diagnostics and redacted logs
- [x] no telemetry by default; any future telemetry must be explicit opt-in

Patch diagnostics use the versioned `patch-diagnostic` envelope and stable `PATCHxxxx` code families. Parser failures retain exact line numbers and normalized diagnostics derive locations without embedding user source unnecessarily. Studio multi-file projects map composed compiler lines back to owning `file:line` through existing composition segments.

Patch Studio diagnostics are local-only. Reports record Patch version, project kind, selected build target, compiler state, source/project size and hash, PWA/browser state and bounded redacted errors. The source body is not uploaded; source echoes, common token forms, email addresses and user-home path components are redacted. Neither Copy diagnostics nor `.patchreport` creation has a network upload path.

### Distribution safety
- [ ] real credentialed Windows code-signing evidence
- [ ] real credentialed macOS signing + notarization evidence
- [ ] installer/package formats with explicit uninstall path
- [ ] verify release signatures/checksums before update/install across future installer/update channels
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 asset digests before sealing
- [x] document Linux packaging expectations
- [ ] fresh remote build service that does not require users to paste a personal GitHub token

`docs/LINUX_PACKAGING.md` defines the current GTK3/Console runtime assumptions, ABI limitations, unsigned status, user-space removal behavior and package formats Patch does not yet claim. This documentation item is separate from the still-open installer/uninstall milestone.

The runtime-integrity mechanism protects the **current payload v17/runtime v1.8 Ready path**. Pages requires `studio-runtime-v0.6` plus these native releases:

- `native-win32-runtime-v1.8`;
- `native-macos-runtime-v1.8`;
- `native-linux-runtime-v1.8`.

Pages downloads the exact runtime assets, reads GitHub's recorded `sha256:` digest, independently re-hashes the bytes and writes a verified `runtime-manifest.json`. Patch Studio hashes the selected runtime again with Web Crypto before browser-side sealing and fails closed on mismatch. The service worker treats same-origin `/runtimes/` requests as fresh-first while online so an older cache cannot silently override the current deployment.

This is byte-consistency validation for the existing Release/Pages/browser path. It does not claim Authenticode, Developer ID/notarization or a separate signing authority.

The repository contains fail-closed Windows Authenticode and macOS Developer ID/notarization machinery for final project artifacts. Those signing items remain open until real credentials are configured and a final artifact passes the complete signing/verifying workflow. `PATCH-SIGNING.json` cannot claim required signing from requested mode alone; platform verification evidence is required first.

Ready Windows, macOS and Linux application downloads already work without a personal GitHub token. The remaining fresh-build item is specifically a service that performs a new remote project-specific build without user-supplied credentials.

### Native Window release contract

The current token-free Ready/offline Window line is **Native GUI IR 1.7 / sealed payload v17 / runtime v1.8** on Windows, macOS and Linux. It preserves responsive Anchor/Dock behavior, Table/Grid, persistent list-backed multi-select ListBox, Menu separators/shortcuts/state, hierarchical TreeView, Slider, Chrome Stage 1, Shape and PaintBox Stage 1 while adding native PaintBox `draw image`.

Slider `changed` exposes only a finite numeric transient value inside the declared range. TreeView `changed` exposes a transient root-to-node text-list path. Table row selection and list-backed ListBox selection are likewise transient event values. Persistent application state still changes only through explicit semantic `change`.

Older contracts remain frozen compatibility lines rather than being redefined:

- Native GUI IR 1.2 / payload v12/runtime v1.3: TreeView, Slider fail-closed;
- payload v11/runtime v1.2: Menu+list;
- payload v10/runtime v1.1: persistent list/multi-select;
- payload v9/runtime v1.0: Table;
- payload v8/runtime v0.9: responsive base;
- payload v7/runtime v0.8: older accessibility/result-dialog line.

The v1.4 Slider runtime workflow builds, seals and executes a canonical Slider app on Windows, macOS and Linux before publishing current runtime assets. The smoke validates real `TRACKBAR`, `NSSlider` and `GtkScale` controls, bounded numeric event dispatch and preservation of the established Table/ListBox/Menu/Tree action executor. The downloadable offline compiler independently links and executes responsive, Table, ListBox, Menu, TreeView and Slider examples on its supported desktop hosts.

### Security and maintenance
- [x] security reporting policy
- [x] dependency/toolchain update policy
- [x] automated dependency/security scanning for build-time tooling
- [x] security-sensitive code review checklist
- [x] threat model for Studio, remote builds and generated desktop apps

GitHub Actions are monitored through Dependabot and JavaScript/TypeScript is scanned by CodeQL `security-extended`. Normal CI executes `scripts/security-policy-check.js`, which rejects dangerous workflow patterns such as `pull_request_target`, `permissions: write-all`, network-download-to-shell patterns and branch-like/floating Action refs. Patch currently has no external npm dependencies, so no synthetic lockfile is maintained.

## P1: strongly recommended for serious users

### Stable developer experience
- [x] documented CLI exit-code contract
- [x] `--json` output for check/build/formal/certify commands
- [ ] source maps / line-accurate diagnostics across all backends
- [x] deterministic artifact naming across Studio/project packaging paths
- [x] project-level build configuration instead of target settings scattered through UI state

`docs/CLI_CONTRACT.md` freezes the coarse exit taxonomy as `0 = success`, `1 = CLI usage`, `2 = processing/build/validation failure`. `check`, `formal`, `certify` and `build` expose the versioned `patch-cli-result` v1 envelope. Human-readable behavior remains the default without `--json`.

Backend source mapping is incremental rather than complete. Studio diagnostics and compiler/build errors map composed project lines to owning `file:line`. Direct-Wasm and several C99 fail-closed errors retain original Patch line hints. Generated C/C++/Rust compiler/linker locations are deliberately not reinterpreted as Patch source lines. The P1 item therefore remains open for remaining native/toolchain/runtime/packaging error classes.

### Resilience
- [x] atomic Studio saves and recovery snapshots
- [x] corrupted-project detection
- [x] rollback to last known-good project snapshot
- [x] managed local snapshot list with manual create/export/delete/clear actions
- [x] cloud-build cancellation and timeout UX
- [x] retry semantics for remote builds without reusing a request

The versioned Studio store uses a pending-write key before promoting canonical project state. Recovery keeps a bounded snapshot ring and supports manual snapshot creation, restore, export, delete and clear. Current v3 snapshots carry the full multi-file project.

Optional GitHub Actions builds have a Studio deadline, exact-run cancellation and retry. A cancellation requested before GitHub exposes the run is remembered and sent when the request-specific run appears. Retry uses the captured build snapshot and a fresh request id. Tokens and retry snapshots remain in page memory only. Recommended Ready/no-token builds are unaffected.

Pages deployment uses one `pages` concurrency group, but only direct source-push runs cancel an older in-progress deploy. Runtime workflow completions queue rather than cancelling a valid source-triggered deployment.

### Testing
- [x] deterministic parser/compiler grammar fuzzing
- [x] property-based change/history/undo tests
- [x] differential interpreter to direct-Wasm to executable C99 tests for every currently documented shared numeric semantic subset
- [x] golden release artifact tests
- [x] upgrade/migration tests across project schema versions
- [x] Windows/macOS/Linux sealed TreeView runtime compatibility smoke matrix
- [x] Windows/macOS/Linux sealed Slider runtime v1.4 smoke matrix
- [x] offline compiler Window smoke matrix for responsive/Table/ListBox/Menu/TreeView/Slider paths

CI runs deterministic valid and guaranteed-invalid generated programs through parser/compiler and supported lowering paths. Seed and failing source are printed for replay.

The executable differential corpus compares interpreter output/state against direct Wasm and compiled C99 for their documented shared subset. This is deterministic differential testing, not a claim of compiler correctness proof.

The Change/History property suite checks forward operations, stored inverses, `invertChange`, composed changes, complete Undo/Redo and redo invalidation after a new post-Undo commit.

Golden tests pin logical artifact format/version boundaries separately from permanent byte hashes so reviewed deterministic code-generation changes do not masquerade as nondeterminism.

Project migration tests preserve documented state through older bundle migrations and reject unsupported future versions/build modes rather than silently guessing.

## P2: polish and ecosystem

- [ ] extension/plugin capability model
- [ ] package/library story
- [x] native Win32/AppKit/GTK GUI lowering and sealed runtime paths
- [x] native hierarchical TreeView parity on Win32/AppKit/GTK
- [x] native Slider parity on Win32/AppKit/GTK through the versioned v1.4 line
- [ ] genuinely new data/control types beyond the current Table/ListBox/TreeView/Slider vocabulary
- [ ] FreeBSD native GUI backend
- [x] Patch Studio keyboard/focus/responsive accessibility baseline
- [x] generated standalone Window Web accessibility baseline
- [x] generated native Window app accessibility engineering baseline
- [ ] manual assistive-technology/browser accessibility audit before a stable release
- [ ] localization
- [ ] long-term support/release channels after 1.0

Automated accessibility coverage is an engineering baseline, not a WCAG conformance claim. Manual Narrator, VoiceOver, Orca and browser/assistive-technology testing remains a separate open release gate.

## Release rule

A production release candidate should be cut only from a commit where:

1. normal cross-platform CI is green;
2. all formal/certificate gates relevant to that version are green;
3. current native packaging and compatibility smoke tests are green;
4. release artifacts are generated from that exact commit;
5. release manifests/checksums match distributed bytes;
6. compatibility/security documentation matches shipped behavior;
7. current runtime releases exist before Pages deploys a browser compiler that consumes them.

Formal verification strengthens Patch's semantic claims, but it does not replace operational release engineering.

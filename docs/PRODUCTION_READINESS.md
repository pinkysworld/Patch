# Patch production-readiness plan

Patch production readiness is about dependable artifacts, diagnostics, compatibility, upgrades and support boundaries. It is deliberately separate from research novelty and from the narrower beta.32 formal assurance claim.

Current product baseline: **0.2.0-beta.36**, Change IR **0.10**, Patch Studio project bundle **v4**, Component Registry **0.9**, Native GUI IR **1.9**, sealed Window payload **v19** and desktop runtime **v1.10**. `src/native-current-contract.js` owns that product-facing native boundary. Older versioned native lines remain explicit compatibility contracts rather than being silently reinterpreted.

## P0 reliability status

### Release integrity

Implemented:

- [x] deterministic SHA-256 release manifest tooling;
- [x] exact tag/source binding for versioned releases;
- [x] checksums beside distributed release artifacts;
- [x] release manifests carrying source commit and Patch version;
- [x] logical reproducibility checks for portable/Web/Wasm/C99 artifacts;
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 asset digests before sealing;
- [x] immutable Current Ready native runtime v1.10 release assets for Windows, macOS and Linux.

Current Ready runtime tags are:

- `native-win32-runtime-v1.10`;
- `native-macos-runtime-v1.10`;
- `native-linux-runtime-v1.10`.

Pages requires those three releases plus `studio-runtime-v0.6`, downloads the exact runtime assets, verifies GitHub's recorded `sha256:` digests against the bytes and publishes `runtime-manifest.json`. Patch Studio independently re-hashes the selected runtime with Web Crypto before sealing. This is byte-consistency validation, not a code-signing or independent trust-root claim.

### Compatibility and project lifecycle

Implemented:

- [x] documented pre-1.0 compatibility policy;
- [x] versioned project bundle format;
- [x] project import/export and recovery snapshots;
- [x] deterministic multi-file composition with provenance;
- [x] migrations from project bundle v1, v2 and v3 to current **v4**;
- [x] explicit refusal of unsupported future project versions;
- [x] source-language compatibility regression corpus;
- [x] bounded project resources with deterministic metadata.

Patch Studio project bundle **v4** is authoritative for current browser and Offline Studio projects. It carries bounded multi-file Patch source, project identity, build settings and project resources. Ordinary `.patch` source remains authoritative for Forms, controls and behavior. Unknown future bundle versions fail closed.

### Current native Window contract

The Current Ready token-free Window line is **Native GUI IR 1.9 / payload v19 / runtime v1.10** on Windows, macOS and Linux. It preserves all earlier responsive, Table, list, Menu, TreeView, Slider, Chrome, Shape and PaintBox behavior and adds the promoted resource layers:

- Button ImageList bindings through the preserved IR 1.8 / BIMG transport;
- application and Form icons through IR 1.9 / WICO;
- deterministic Windows PE application-icon embedding;
- macOS `.icns` plus `CFBundleIconFile`;
- Linux hicolor icon plus `.desktop` metadata.

Toolkit interaction remains transient. Persistent Patch state changes only through explicit semantic `change`.

The Offline Compiler defaults to payload **v19/runtime v1.10**. Explicit `--gui-payload-version 17` remains supported with the real runtime **v1.8** compatibility underlay. The frozen TreeView line remains payload v12/runtime v1.3, and older Table/list/Menu compatibility lines remain independently versioned.

### Diagnostics and supportability

Implemented:

- [x] `patch doctor` structured diagnostics and `--json` output;
- [x] stable `PATCHxxxx` diagnostic families;
- [x] direct Wasm/C99 subset fail-closed diagnostics including `PATCH2003`;
- [x] project composition mapping back to owning `file:line`;
- [x] Copy diagnostics and bounded redacted `.patchreport` support in Studio;
- [x] no telemetry by default.

Generated backend/toolchain locations are not falsely presented as Patch source positions when a reliable source mapping does not exist.

### Distribution safety

Still open before a stable production release:

- [ ] real credentialed Windows code-signing evidence;
- [ ] real credentialed macOS signing + notarization evidence;
- [ ] installer/package formats with an explicit uninstall path;
- [ ] signature/checksum verification across future installer/update channels;
- [ ] fresh project-specific remote build service that does not require a user-supplied personal GitHub token;
- [ ] FreeBSD native Window/GUI backend.

Ready Windows, macOS and Linux downloads themselves do not require users to paste a GitHub token. Windows and macOS signing machinery remains fail-closed until real credentials and final verification evidence exist.

### Security and maintenance

Implemented:

- [x] security reporting policy;
- [x] dependency/toolchain update policy;
- [x] CodeQL security scanning;
- [x] security-sensitive review checklist;
- [x] threat model for Studio, optional remote builds and generated applications;
- [x] CI policy checks against dangerous workflow patterns.

Patch currently has no external npm runtime dependencies. Security automation does not imply that the compiler or generated applications are formally verified.

## P1 serious-user readiness

Implemented or substantially implemented:

- [x] documented CLI exit-code contract;
- [x] machine-readable command results for core compiler/formal commands;
- [x] deterministic artifact naming;
- [x] project-level build configuration;
- [x] atomic Studio saves and bounded recovery snapshots;
- [x] corrupted-project quarantine and rollback;
- [x] optional cloud-build cancellation, timeout and fresh-request retry semantics;
- [x] deterministic parser/compiler fuzzing;
- [x] interpreter/direct-Wasm/C99 differential testing for the documented shared numeric subset;
- [x] golden logical artifact tests;
- [x] project migration tests;
- [x] cross-platform native runtime and Offline Compiler smoke matrices through Current Ready v1.10.

Still open:

- [ ] complete source mapping for remaining native/toolchain/packaging error classes;
- [ ] broader installer/update resilience evidence;
- [ ] long mixed-operation Studio recovery/Undo stress coverage where still missing.

## P2 polish and ecosystem

Open product work includes:

- [ ] extension/plugin capability model;
- [ ] package/library ecosystem;
- [ ] richer standard component set and container semantics;
- [ ] FreeBSD native GUI;
- [ ] localization;
- [ ] stable long-term release channels;
- [ ] manual assistive-technology/browser accessibility audit before a stable release.

Automated accessibility coverage is an engineering baseline, not a WCAG conformance claim. Manual Narrator, VoiceOver, Orca and browser/assistive-technology validation remains a separate release gate.

## Formal assurance boundary

The native product promotion to IR 1.9/payload v19/runtime v1.10 does **not** widen the beta.32 formal runtime-correspondence claim. Product version growth must not be read as proof-coverage growth. Current research/assurance boundaries remain documented in `docs/FORMAL_MODEL.md`, `docs/RUNTIME_CORRESPONDENCE.md` and the paper materials.

## Release rule

A production release candidate should be cut only from a commit where:

1. normal cross-platform CI is green;
2. formal/certificate gates relevant to the claimed assurance boundary are green;
3. Current Ready native packaging and compatibility smoke tests are green;
4. release artifacts are generated from the exact reviewed source commit;
5. release manifests and checksums match distributed bytes;
6. compatibility, security and distribution documentation matches shipped behavior;
7. runtime releases exist and their digests are verified before Pages deploys a browser compiler that consumes them;
8. any claimed platform signing or notarization has real verification evidence.

Formal verification strengthens Patch's semantic claims, but it does not replace operational release engineering.

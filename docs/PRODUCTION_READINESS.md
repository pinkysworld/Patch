# Patch production-readiness plan

Patch already has broad semantic/formal coverage and cross-platform build smoke tests. Production readiness is a different goal: users need stable artifacts, diagnostics, compatibility rules, safe upgrades and support boundaries even when they never use the research features.

This plan deliberately separates **P0 reliability work** from research novelty.

## P0 — required before calling Patch production-ready

### Release integrity
- [x] deterministic SHA-256 release manifest tooling
- [x] versioned GitHub Release workflow that builds from an exact tag/commit
- [x] checksums attached beside every distributed tagged-release artifact
- [x] release manifest includes source commit and Patch version
- [x] release notes generated from reviewed changes
- [ ] reproducibility check: rebuilding the same source/toolchain produces equivalent logical payloads where platform packaging permits

Tagged releases are fail-closed. `v<package version>` must point at the checked-out `GITHUB_SHA`; the workflow tests that exact source, builds the portable/Web/Wasm/C99/npm release bundle, generates `release-manifest.json` and `SHA256SUMS.txt`, independently re-hashes every artifact, verifies the recorded Patch version and source commit, and only then calls `gh release create --verify-tag --generate-notes`. Beta/pre-release package versions are published as GitHub prereleases.

### Compatibility and project lifecycle
- [x] document pre-1.0 compatibility policy
- [x] versioned Patch Studio project bundle format
- [x] project import/export
- [ ] migrations for old project bundle schema versions
- [x] explicit refusal for unsupported future schema versions
- [ ] source-language compatibility regression corpus

Patch Studio project bundle v1 is intentionally a single-file `main.patch` project. The Studio also migrates the earlier unversioned local-storage state into v1 automatically. The unchecked migration item above is reserved for real bundle-version migrations once a v2 or later schema exists.

### Diagnostics and supportability
- [x] `patch doctor` structured diagnostics core
- [x] expose `patch doctor --json` through the installed CLI
- [x] stable machine-readable diagnostic/error codes for compiler/build failures
- [x] one-click "Copy diagnostics" in Patch Studio
- [x] crash/build report bundle with Patch version, target, diagnostics and redacted logs
- [x] no telemetry by default; any future telemetry must be explicit opt-in

Patch diagnostics use the versioned `patch-diagnostic` envelope and stable `PATCHxxxx` code families. Parser failures retain exact line numbers and normalized diagnostics derive an indentation-aware column without embedding the source line. Studio reports carry those code/location fields while preserving the existing local-only privacy boundary.

Patch Studio diagnostics are local-only. The report records Patch version, project kind, selected build target, compiler status, source size/SHA-256, PWA/browser state and a bounded set of redacted recent errors. The source body is not included; source echoes, common token forms, email addresses and user-home path components are redacted. Neither Copy diagnostics nor `.patchreport` creation has a network upload path.

### Distribution safety
- [ ] Windows code signing
- [ ] macOS signing + notarization
- [ ] installer/package formats with uninstall path
- [ ] verify release signatures/checksums before update/install
- [ ] document Linux packaging expectations
- [ ] fresh-build service that does not require users to paste a personal GitHub token

Ready Windows, macOS and Linux application downloads can already be consumed without a personal GitHub token. The remaining item above is specifically about requesting new/fresh remote builds without user-supplied credentials.

### Security and maintenance
- [x] security reporting policy
- [ ] dependency/toolchain update policy
- [ ] automated dependency/security scanning for build-time tooling
- [ ] security-sensitive code review checklist
- [ ] threat model for Studio, remote builds and generated desktop apps

## P1 — strongly recommended for serious users

### Stable developer experience
- [ ] documented CLI exit-code contract
- [ ] `--json` output for check/build/formal/certify commands
- [ ] source maps / line-accurate diagnostics across all backends
- [ ] deterministic artifact naming across every packaging path
- [ ] project-level configuration instead of target settings scattered through UI state

The stable diagnostic envelope now covers compiler/build failure classes and parser source locations. The broader backend item remains open because Wasm/C99/native runtime and packaging failures do not yet all map back to source locations.

### Resilience
- [x] atomic Studio saves and recovery snapshots
- [x] corrupted-project detection
- [x] rollback to last known-good project snapshot
- [x] managed local snapshot list with manual create/export/delete/clear actions
- [x] cloud-build cancellation and timeout UX
- [x] retry semantics for remote builds without reusing a request

The versioned Studio store uses a pending-write key before promoting the canonical project, while the previous project is periodically retained in a bounded five-snapshot recovery ring. Import and restore take an immediate protective snapshot before replacing the current project. The Recovery manager exposes all retained local restore points and supports manual snapshot creation, restoring any snapshot, exporting a snapshot as `.patchproject`, deleting one snapshot, or clearing the local ring after confirmation.

Optional GitHub Actions builds now have a 15-minute Studio deadline, exact-run cancellation and retry. A cancellation requested before GitHub exposes the run is remembered and sent as soon as the request-specific run appears. Retry uses the captured source/build snapshot and generates a fresh request id instead of silently rebuilding later editor contents or rerunning the same request. Tokens and retry snapshots remain in page memory only. Recommended browser-local/no-token builds are unchanged.

### Testing
- [ ] parser/compiler fuzzing
- [ ] property-based change/history/undo tests
- [ ] differential interpreter ↔ Wasm ↔ C99 tests for every shared semantic subset
- [ ] golden release artifact tests
- [ ] upgrade/migration tests across project schema versions

## P2 — polish and ecosystem

- [ ] extension/plugin capability model
- [ ] package/library story
- [x] native Win32/AppKit/GTK GUI lowering and sealed runtime paths
- [ ] FreeBSD native GUI backend
- [x] Patch Studio keyboard/focus/responsive accessibility baseline
- [ ] generated Window app accessibility audit
- [ ] manual assistive-technology/browser accessibility audit before a stable release
- [ ] localization
- [ ] long-term support/release channels after 1.0

The Studio baseline includes a skip link, labelled editor, WAI-ARIA-style result tab relationships, arrow/Home/End result navigation, keyboard Run/Build shortcuts, visible keyboard focus, polite status announcements, coarse-pointer target sizing, reduced-motion handling, forced-colors affordances and responsive project/support/result layouts. This is an implementation baseline, not a WCAG conformance claim. Generated Window applications and manual screen-reader/browser testing remain separate work.

## Release rule

Research milestones may continue rapidly, but a production release candidate should be cut only from a commit where:

1. the normal cross-platform CI is green;
2. all formal/certificate gates relevant to that version are green;
3. native packaging smoke tests are green;
4. release artifacts are generated from that exact commit;
5. the release manifest/checksums match the distributed bytes;
6. compatibility/security documentation matches the shipped behavior.

Formal verification strengthens Patch's semantic claims, but it does not replace operational release engineering.

# Patch production-readiness plan

Patch already has broad semantic/formal coverage and cross-platform build smoke tests. Production readiness is a different goal: users need stable artifacts, diagnostics, compatibility rules, safe upgrades and support boundaries even when they never use the research features.

This plan deliberately separates **P0 reliability work** from research novelty.

## P0 — required before calling Patch production-ready

### Release integrity
- [x] deterministic SHA-256 release manifest tooling
- [ ] versioned GitHub Release workflow that builds from an exact tag/commit
- [ ] checksums attached beside every distributed artifact
- [ ] release manifest includes source commit and Patch version
- [ ] release notes / changelog generated from reviewed changes
- [ ] reproducibility check: rebuilding the same source/toolchain produces equivalent logical payloads where platform packaging permits

### Compatibility and project lifecycle
- [x] document pre-1.0 compatibility policy
- [ ] versioned Patch Studio project bundle format
- [ ] project import/export
- [ ] migrations for old project bundle schema versions
- [ ] explicit refusal for unsupported future schema versions
- [ ] source-language compatibility regression corpus

### Diagnostics and supportability
- [x] `patch doctor` structured diagnostics core
- [x] expose `patch doctor --json` through the installed CLI
- [ ] stable machine-readable diagnostic/error codes for compiler/build failures
- [ ] one-click "Copy diagnostics" in Patch Studio
- [ ] crash/build report bundle with Patch version, target, diagnostics and redacted logs
- [ ] no telemetry by default; any future telemetry must be explicit opt-in

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
- [ ] deterministic artifact naming
- [ ] project-level configuration instead of target settings scattered through UI state

### Resilience
- [ ] atomic Studio saves and recovery snapshots
- [ ] corrupted-project detection
- [ ] rollback to last known-good project snapshot
- [ ] build cancellation and timeout UX
- [ ] retry semantics for remote builds without duplicate artifacts

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
- [ ] accessibility audit for Patch Studio and generated Window apps
- [ ] localization
- [ ] long-term support/release channels after 1.0

## Release rule

Research milestones may continue rapidly, but a production release candidate should be cut only from a commit where:

1. the normal cross-platform CI is green;
2. all formal/certificate gates relevant to that version are green;
3. native packaging smoke tests are green;
4. release artifacts are generated from that exact commit;
5. the release manifest/checksums match the distributed bytes;
6. compatibility/security documentation matches the shipped behavior.

Formal verification strengthens Patch's semantic claims, but it does not replace operational release engineering.

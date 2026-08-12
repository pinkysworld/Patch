# Patch threat model

This threat model covers Patch Studio, local project state, optional remote builds, generated Web/native applications, release artifacts and the supporting GitHub Actions supply chain. It does not turn Patch's formal language claims into platform-security proofs.

## Assets to protect

- user-authored Patch source and project/recovery data;
- optional GitHub cloud-build credentials;
- compiler and Change IR integrity;
- native runtime templates and sealed payloads;
- release artifacts, manifests and checksums;
- GitHub Actions permissions and repository release authority;
- the distinction between transient UI event values and persistent Patch state.

## Trust boundaries

### Browser / Patch Studio

Patch Studio executes first-party JavaScript delivered by GitHub Pages and stores project/recovery data locally. The PWA Service Worker is a privileged persistence boundary because stale or compromised code could remain active across sessions.

Studio must not upload source implicitly. Copy diagnostics and `.patchreport` remain local-only and omit source bodies. Project import is untrusted input and must remain bounded, schema-validated and resistant to unsafe paths before replacing current state.

### Optional cloud build

The advanced GitHub Actions build path crosses a network and credential boundary. The user explicitly chooses this mode and provides a repository-scoped token. Patch Studio keeps that token and retry snapshot in page memory only; project/recovery/local-storage persistence must never contain it.

A cloud build sends the selected source snapshot to GitHub. Cancellation, timeout and retry must address request-specific runs so a user does not accidentally download or attribute an artifact from another attempt.

### GitHub Actions and supply chain

GitHub-hosted runners, referenced Actions and platform toolchains are trusted infrastructure outside the Patch language proof boundary. Workflow permissions, untrusted pull-request content, mutable dependencies and release credentials are therefore security-sensitive.

Patch rejects `pull_request_target` in the repository security policy gate and rejects remote Actions on branch-like floating refs. Dependabot monitors GitHub Actions versions, and CodeQL scans JavaScript/TypeScript security issues.

### Generated Web applications

Generated HTML/JavaScript may render values originating from Patch programs. Generated output must preserve the intended text/value boundary and must not turn Patch strings into executable HTML or JavaScript through unsafe interpolation.

A malicious Patch program is untrusted application code. Language semantics do not imply that an application written in Patch is benign.

### Generated and sealed native applications

Win32, AppKit and GTK paths depend on native runtime code, platform APIs, generated native code and OS libraries. Native GUI IR and sealed payload versioning provide compatibility and validation boundaries, not memory-safety proofs.

Sealers and runtime decoders must fail closed on incompatible format versions, malformed lengths/checksums and already-sealed or platform-mismatched inputs. Result-bearing dialogs expose selected paths as transient event values; paths become persistent only when Patch source explicitly changes state.

Current unsigned Windows/macOS distribution and macOS browser-side sealing are known residual risks until signing/notarization is implemented.

### Release distribution

A release is trusted only as the output of the exact tagged commit. The tagged-release workflow binds the package version and tag to `GITHUB_SHA`, hashes every distributed artifact, verifies the release manifest/checksums and publishes only after those checks pass.

Checksums provide integrity evidence after a trusted retrieval of the checksum/manifest. They do not replace platform code signing or protect a user who receives both artifact and checksum from the same compromised distribution channel.

## Threats and mitigations

### Source or project injection

Threat: malformed/imported Patch source causes parser/compiler crashes, unsafe path handling, hidden state replacement or resource exhaustion.

Mitigations include schema/path/size validation for project bundles, stable diagnostics, deterministic grammar fuzzing, fail-closed backend support checks and bounded recovery storage. Resource-exhaustion resistance remains an ongoing concern for intentionally pathological programs.

### Browser XSS / DOM injection

Threat: Patch source, program output, diagnostics or project metadata becomes executable browser markup/script and can read local data or a cloud-build token.

Mitigation: UI surfaces should use text/value APIs such as `textContent` rather than injecting untrusted HTML. Any new `innerHTML`, template HTML, URL navigation or dynamic script creation involving user-controlled values requires explicit security review.

### Service Worker persistence or stale-code attack

Threat: an old/compromised worker keeps serving vulnerable Studio assets after a fix.

Mitigation: Pages assets are content-addressed, the worker cache identity is revision-bound, code/UI fetches bypass stale HTTP cache, the worker is actively updated with `updateViaCache: 'none'`, and controlled pages reload once after a new worker takes control. Old cache deletion is scoped to Patch Studio caches on the shared origin.

### Token exposure

Threat: a GitHub token is persisted, logged, included in diagnostics, inserted into project state or exposed through injected browser code.

Mitigation: optional cloud-build tokens are memory-only, diagnostics redact common token forms, cloud mode is explicit, and no-token ready builds are the recommended default. Browser XSS remains particularly important because page-memory secrets are accessible to compromised first-party script.

### Workflow / dependency compromise

Threat: a compromised Action or overly privileged workflow modifies releases/Pages or exfiltrates credentials.

Mitigation: least-privilege workflow permissions, explicit Action refs, no `pull_request_target`, Dependabot Action updates, CodeQL, the repository security policy gate and review requirements for any token/write-permission change. Major-version Action tags remain a mutable upstream trust dependency; stronger commit-SHA pinning remains a possible future hardening step.

### Artifact substitution or tampering

Threat: an artifact is replaced, mislabeled or built from a different commit than claimed.

Mitigation: exact-tag release checks, deterministic SHA-256 manifest tooling, independent re-hashing before publish, request-specific cloud build identifiers and fail-closed expected artifact names.

### Native payload tampering

Threat: malformed or mismatched sealed data causes unsafe runtime interpretation.

Mitigation: payload magic/version/length/CRC checks, platform matching and native smoke tests. These checks reduce malformed-input risk but do not prove the C/C++ native runtime memory safe.

## Explicit non-goals / residual risk

- Patch does not sandbox arbitrary applications written in Patch from all resource abuse.
- Lean certificates cover documented semantic subsets, not browser, JavaScript engine, Wasm engine, C compiler, OS or native GUI toolkit correctness.
- CodeQL and CI reduce risk but do not prove absence of vulnerabilities.
- Windows code signing and macOS signing/notarization are not yet implemented.
- A token-free service for fresh project-specific remote compilation is not yet implemented; the advanced Actions route still requires a user credential.
- Full reproducible native builds across hosted runner/toolchain updates remain future work.

Security-sensitive changes should be evaluated against this document and `docs/SECURITY_REVIEW_CHECKLIST.md` before merge.

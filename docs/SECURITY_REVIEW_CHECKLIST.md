# Patch security review checklist

Use this checklist for changes that touch trust boundaries, credentials, persistence, generated code, native runtimes or release/distribution behavior. Not every item applies to every pull request, but applicable items should be answered before merge.

## Parser, compiler and semantic mutation

- [ ] Untrusted source fails closed with a bounded, non-secret diagnostic.
- [ ] No new persistent mutation path bypasses explicit Patch `change` semantics.
- [ ] Capability/policy checks still cover every committed effect introduced by the change.
- [ ] Unsupported backend behavior is rejected rather than silently downgraded.
- [ ] New syntax/parser paths have negative tests or fuzz coverage where appropriate.
- [ ] Formal/proof metadata claims were not broadened beyond what is mechanically checked.

## Studio browser boundary

- [ ] User-controlled source/output/metadata is rendered with safe text/value APIs rather than executable HTML.
- [ ] No new implicit source upload, telemetry or network destination was introduced.
- [ ] New local persistence has a version/schema, bounds and corruption behavior.
- [ ] Import paths, file names and downloaded artifact names are normalized and traversal-safe.
- [ ] Service Worker/cache changes preserve updateability and do not delete unrelated origin caches.
- [ ] Any page-memory credential remains excluded from localStorage, project bundles, recovery snapshots and diagnostics.

## Remote/cloud builds

- [ ] Cloud build remains explicit and the no-token path remains clearly distinguished.
- [ ] Tokens use the minimum documented permissions and are not logged or persisted.
- [ ] Source snapshots, request ids, workflow run ids and artifact names cannot be confused across retries.
- [ ] Cancel/timeout logic acts on the intended run and does not leave UI state claiming success for unknown work.
- [ ] Workflow event choice is safe for untrusted pull-request content; `pull_request_target` is not introduced.

## GitHub Actions and dependencies

- [ ] Workflow permissions are least privilege for the job.
- [ ] Remote Actions use explicit non-branch refs and are covered by Dependabot.
- [ ] New external npm dependencies include a lockfile and update/scanning coverage.
- [ ] No downloaded network content is piped directly into a shell.
- [ ] Secrets/tokens are not exposed to steps that execute untrusted source or pull-request-controlled commands.
- [ ] Release or Pages write authority is limited to the intended branch/tag/event.

## Generated Web/native applications

- [ ] Generated Web output does not turn Patch values into raw executable markup/script.
- [ ] Native payload decoder/sealer validates format version, lengths/checksums and platform assumptions.
- [ ] Native code generation escapes/encodes source-derived strings correctly for the target language/API.
- [ ] File/dialog paths remain transient unless source explicitly persists them.
- [ ] Native smoke tests cover changed controls/events/dialog behavior on each affected platform.
- [ ] Electron/compatibility fallback cannot silently replace a claimed direct-native path.

## Release and distribution

- [ ] Artifacts are built from the exact reviewed/tagged commit.
- [ ] Manifest/checksum verification runs before publication.
- [ ] Artifact naming cannot accidentally select an older or different build.
- [ ] Signing/notarization claims match what is actually shipped.
- [ ] A security-relevant artifact replacement includes clear user guidance when older binaries should be distrusted.

## Evidence before merge

- [ ] Normal Patch CI is green.
- [ ] Relevant native/platform workflows are green.
- [ ] CodeQL/security-policy gates are green for applicable source changes.
- [ ] Threat model/security docs were updated if a trust boundary changed.
- [ ] Residual risk is stated rather than implied away by passing tests or formal results.

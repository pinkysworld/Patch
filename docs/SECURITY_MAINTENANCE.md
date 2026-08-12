# Patch security and maintenance policy

Patch is pre-1.0 research software with a browser IDE, compiler/runtime code, GitHub Actions build paths and generated desktop applications. Dependency and toolchain maintenance therefore treats source dependencies, GitHub Actions and native toolchains as part of the security boundary.

## Update cadence

- GitHub Actions references are checked weekly by Dependabot.
- CodeQL JavaScript/TypeScript security analysis runs on relevant pull requests and `main`, on a weekly schedule, and on manual dispatch.
- Security-sensitive dependency/action update pull requests must pass the normal Patch CI before merge.
- Native runtime/toolchain changes continue to pass their platform smoke workflows before merge.
- High-impact security advisories affecting a used action, runtime or toolchain should be triaged as soon as identified rather than waiting for the weekly cadence.

## npm dependencies

Patch currently has no external npm runtime or development dependencies and therefore has no `package-lock.json` to audit. This is intentional rather than an omitted lockfile.

If an external npm dependency is introduced:

1. `package-lock.json` becomes mandatory in the same change;
2. the dependency must have a clear product/research purpose;
3. npm Dependabot coverage must be added to `.github/dependabot.yml`;
4. install/build scripts must be reviewed for lifecycle-script risk;
5. the dependency must not silently expand Studio network behavior or generated-app trust boundaries.

The repository security policy gate fails if dependencies are added without a lockfile.

## GitHub Actions

Remote Actions must use an explicit ref. Floating branch-like refs such as `@main`, `@master` and `@latest` are rejected by `scripts/security-policy-check.js`. Dependabot is responsible for proposing version updates to GitHub Actions.

A security-sensitive review is required when an Action gains write permissions, receives a secret/token, runs on untrusted pull-request content, publishes a release/runtime, or changes the Pages deployment path.

`pull_request_target` is forbidden by the repository security gate unless a future explicit threat-model exception is deliberately designed and the gate is changed in the same reviewed pull request.

## Native toolchains

Patch relies on GitHub-hosted Windows, macOS and Linux runners plus platform compilers/libraries for native paths. Those external toolchains are trusted components outside Patch's formal proofs.

Changes to compiler flags, minimum OS versions, GTK/AppKit/Win32 linkage, runtime template formats or signing/notarization stages require native smoke coverage and an update to the relevant security documentation when the trust boundary changes.

## Emergency response

For a credible vulnerability in a dependency, Action or toolchain:

1. identify the affected Patch paths and published artifacts;
2. disable or narrow the affected build/distribution path if a safe fix is not immediately available;
3. update the dependency/tool/action and run the relevant CI/native/security gates;
4. rotate any potentially exposed credentials outside the repository;
5. publish corrected artifacts from the exact reviewed/tagged commit;
6. document user action when previously distributed artifacts should no longer be trusted.

See `SECURITY.md` for private vulnerability reporting, `docs/THREAT_MODEL.md` for trust boundaries, and `docs/SECURITY_REVIEW_CHECKLIST.md` for review requirements.

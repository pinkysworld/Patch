# Security policy

Patch is pre-1.0 research software that can build and execute user-authored programs. Security reports are therefore treated separately from ordinary bug reports.

## Supported versions

Until Patch reaches 1.0, security fixes are targeted at the latest development beta on `main`. Older beta artifacts may not receive backports.

## Reporting a vulnerability

Please do **not** publish working exploit details, credentials, private tokens, signing material, or sensitive user data in a public issue.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when it is available to you.
2. Include the affected Patch version or commit, target platform, minimal reproduction, impact, and whether the issue crosses a trust boundary.
3. If private reporting is unavailable, open a public issue containing only non-sensitive coordination information and state that you have security details to share privately. Do not include an exploit payload in that issue.

## Current trust boundaries

Patch intentionally distinguishes language-level guarantees from platform/runtime trust:

- Lean certificates cover only the explicitly documented formal subsets.
- Translation validation is not a proof of the JavaScript parser/compiler.
- Direct Wasm and C99 backends support narrower language subsets than the full interpreter.
- Direct and sealed native Window paths use dedicated Win32, AppKit and GTK runtimes and are Electron-free on those paths. Their platform APIs, generated native code, toolchains and runtime libraries remain trusted components.
- Native GUI IR, sealed native payloads and Window event adapters are versioned contracts, but versioning does not by itself prove the platform lowering or runtime implementation.
- Patch Studio can consume ready Windows, macOS and Linux application artifacts without requiring a personal GitHub token. Cloud/fresh-build paths that use GitHub Actions inherit GitHub workflow, runner, artifact and credential trust boundaries.
- If a personal build token is used for an optional GitHub Actions path, it should be scoped to the minimum repository/actions permissions necessary and must not be committed or persisted as project data.

## Security-sensitive changes

Changes to any of the following should receive explicit security review and regression coverage:

- parsing or expression evaluation
- persistent state mutation paths
- capability/policy checking
- generated HTML, native GUI lowering or sealed native runtime code
- shell/process invocation and native packaging
- remote build token handling
- release/update mechanisms
- certificate generators and proof/evidence boundaries

A successful CI run is necessary but not sufficient evidence that a security-sensitive change is safe.

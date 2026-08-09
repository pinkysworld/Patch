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
- Desktop Window packages currently use a generated Electron player. The renderer is configured with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Patch Studio remote native builds use GitHub Actions and therefore inherit GitHub token, workflow, runner, and artifact trust boundaries.
- Personal build tokens entered in Patch Studio are not intended to be persisted by Patch, but users should still scope tokens to the minimum repository/actions permissions necessary.

## Security-sensitive changes

Changes to any of the following should receive explicit security review and regression coverage:

- parsing or expression evaluation
- persistent state mutation paths
- capability/policy checking
- generated HTML or Electron player code
- shell/process invocation and native packaging
- remote build token handling
- release/update mechanisms
- certificate generators and proof/evidence boundaries

A successful CI run is necessary but not sufficient evidence that a security-sensitive change is safe.

# Linux native packaging expectations

Patch distinguishes a **native Linux build** from a universal Linux package. The current direct GUI backend emits a GTK3 executable, while Console builds use the native Node SEA path. Neither claim means that one binary is portable across every Linux distribution, C library, CPU architecture or desktop environment.

## Current distribution shape

The Native Distribution workflow produces a `.tar.gz` archive for Linux. It contains:

- the final project executable;
- `PATCH-SIGNING.json`, which currently records the Linux distribution as explicitly `unsigned`;
- the direct GTK build metadata JSON for Window projects.

Window projects are lowered through the direct GTK3 backend. Electron/Chromium is not used by this distribution path. Console projects use the native SEA builder.

## Runtime expectations

### Window / GTK3

A generated Window application uses the system GTK3 stack. The target machine therefore needs compatible GTK3 runtime libraries and the normal C/C++ runtime expected by the build host. The CI build runner installs `libgtk-3-dev` and `xvfb` for compilation and headless smoke testing; end users need the corresponding GTK3 runtime, not the development headers.

Patch does not currently claim a fully static or distribution-independent GTK executable. A binary produced on the current Ubuntu GitHub runner should be treated as an Ubuntu/Linux-family build for the same CPU architecture, not as an ABI guarantee for every Linux distribution.

### Console

Console distributions use Node's single-executable application path and are still native platform artifacts. They may depend on the libc/kernel baseline of the Node/GitHub-hosted build environment. They should not be described as universal Linux binaries.

## Installation and removal

Current Linux output is a portable archive, not a system installer. Extract it into a user-controlled directory and run the executable from there. If file permissions were lost during transfer, restore the executable bit with `chmod +x <app>`.

Removal is therefore explicit and simple: delete the extracted application directory or executable. Patch currently does **not** install files into `/usr`, create system services, modify package-manager databases, or write privileged uninstall state.

`.deb`, `.rpm`, Flatpak, Snap and AppImage are not currently claimed distribution formats. A future installer/package milestone must define its own ownership, upgrade and uninstall behavior before the production-readiness installer checkbox can be closed.

## Integrity and signing

Patch does not currently define a Linux code-signing identity comparable to Windows Authenticode or Apple Developer ID. `signing_mode=require` therefore fails for Linux rather than inventing a signing claim.

For official tagged releases, SHA-256 checksums and release provenance remain the integrity mechanism. The Native Distribution archive additionally includes the explicit signing-status manifest so downstream tooling can distinguish an intentionally unsigned Linux artifact from a verified signed Windows/macOS artifact.

## FreeBSD is separate

The Linux GTK packaging contract does not apply to FreeBSD. FreeBSD currently has its own Console/C99 path and no claimed native GUI distribution backend.

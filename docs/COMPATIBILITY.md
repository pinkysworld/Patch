# Patch compatibility policy

Patch is currently pre-1.0. The project aims to keep ordinary beginner-facing Patch source stable, but research betas may still change internal schemas and advanced assurance artifacts.

## Source language

For the core beginner syntax (`create`, `change`, `show`, `if`, `repeat`, things, recipes and the documented Window subset), breaking changes should be avoided unless they fix an unsafe or ambiguous semantic rule.

Before 1.0, a necessary breaking source change must:

1. be called out in release notes;
2. include a migration example;
3. add a regression fixture for the old behavior;
4. prefer a deprecation period when ambiguity/safety permits it.

## Change IR

Change IR is versioned separately from the Patch package. It is an internal/compiler artifact and **does not currently promise forward compatibility** across unknown future IR versions.

Consumers should:

- require a known `patch-ir` format;
- inspect the exact IR version;
- reject unsupported future versions rather than guessing;
- avoid treating experimental formal sub-artifacts as a stable public interchange API until explicitly documented as such.

## Certificates

Lean certificate schemas are intentionally versioned by their producers/checkers. A certificate is valid only for the source/hash/schema/model boundaries embedded or documented by that certificate path. Newer Patch versions may add stronger certificates without implying that older certificates proved the stronger property.

## Native artifacts

Windows, macOS, Linux and FreeBSD artifacts are platform-specific. A native artifact should not be assumed portable to another OS or CPU architecture.

Patch now has dedicated native Window lowering/runtime paths for Win32, AppKit and GTK, plus sealed native payloads used by ready application downloads. These paths are versioned independently through the Native GUI IR, backend/runtime and sealed-payload contracts. Consumers should reject unsupported future native GUI or sealed-payload versions rather than guessing compatibility.

Successful native compilation or a matching runtime version does not imply code signing, notarization, installer trust or cross-platform portability.

## Patch Studio projects

Patch Studio now defines the `patch-studio-project` bundle format. Version `1` contains project metadata plus exactly one `main.patch` source file and is exported with the `.patchproject` extension.

Project compatibility follows fail-closed rules:

- Studio validates the declared format and exact schema version before replacing editor state;
- unsupported future project versions are rejected rather than guessed;
- bundle paths are validated and traversal/duplicate/missing-entry layouts are rejected;
- the previous unversioned browser-storage shape is migrated into project bundle v1;
- a future v2 or later bundle must add an explicit migration before older files are rewritten into the newer schema.

Browser-local recovery snapshots are operational state, not a portable interchange format. Important projects should be exported as `.patchproject` files. The exact v1 contract and recovery behavior are documented in [STUDIO_PROJECTS.md](STUDIO_PROJECTS.md).

## Release channels

Before 1.0, the latest beta on `main` is the active development line. A future stable release channel should separate:

- stable releases;
- preview/beta releases;
- research/nightly builds.

Users who require long-lived reproducibility should record the exact Patch version/commit and retain the original source plus release checksums.
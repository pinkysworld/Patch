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

Generated desktop Window packages currently depend on the documented generated-player architecture rather than native widget lowering. Signing/notarization is a distribution concern and is not implied by successful compilation.

## Patch Studio projects

Patch Studio currently stores editor/project state locally, but a stable versioned project import/export bundle has not yet been declared. Until that schema exists, local Studio storage must not be treated as a long-term archival interchange format.

The production-readiness roadmap requires a versioned project bundle plus migrations before this becomes a compatibility promise.

## Release channels

Before 1.0, the latest beta on `main` is the active development line. A future stable release channel should separate:

- stable releases;
- preview/beta releases;
- research/nightly builds.

Users who require long-lived reproducibility should record the exact Patch version/commit and retain the original source plus release checksums.

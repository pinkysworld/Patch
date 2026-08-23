# Patch Studio diagnostics

Patch Studio can create a support summary without sending project content anywhere.

## Actions

- **Copy diagnostics** copies a compact text summary to the clipboard.
- **Report** downloads a JSON `.patchreport` file for attaching to an issue or support request.

Both actions run locally in the browser. They do not upload a report, contact a support endpoint or enable telemetry.

## Report schema

The current report format is `patch-studio-diagnostics` version 1. It includes:

- Patch Studio version;
- project kind (`console` or `window`);
- selected build target;
- source size in bytes;
- SHA-256 of the current source;
- current compiler success/failure state, including stable `PATCHxxxx` codes and source locations;
- for multi-file v3 projects, owning `file:line` after mapping the composed compiler line back through project segments;
- browser/PWA state such as online status, standalone display mode and service-worker control;
- up to ten recent user-visible or browser errors observed by the diagnostics module.

The report intentionally does **not** contain the project name or source body.

## Redaction

Before error text is added to a report, Patch Studio redacts common GitHub token forms, bearer tokens, email addresses and username components in common home-directory paths. Exact non-trivial source lines echoed inside compiler or runtime diagnostics are replaced with a source-redaction marker.

This is defense in depth rather than a claim that arbitrary diagnostic text can never contain sensitive information. Users should still review a `.patchreport` before sharing it outside their machine.

## Source fingerprint

The SHA-256 source fingerprint helps determine whether two reports came from the same exact source without embedding that source in the report. It is not an encryption of the source and it cannot be used to reconstruct ordinary non-trivial source text from the report alone.

## No telemetry

Patch Studio does not send these diagnostics to Patch or GitHub. If telemetry is ever introduced later, the production-readiness policy requires it to be explicit opt-in rather than being coupled to these local diagnostics actions.

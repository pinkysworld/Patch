# Patch Studio cloud build resilience

Patch Studio's recommended Windows/macOS/Linux ready-app paths remain browser-local/no-token builds. This document covers only the optional GitHub Actions AOT/cloud route.

## Cancellation

While a cloud build is active, Studio exposes **Cancel**. A cancellation request is remembered even if GitHub has not exposed the newly dispatched run yet. As soon as the request-specific workflow run is found, Studio posts to GitHub's run-cancel endpoint.

If the run id is already known, the cancel request is sent immediately. GitHub `202`, `204`, and the race-safe `409` response are accepted as terminal cancellation responses.

## Timeout

A Studio cloud build has a 15-minute UI timeout. The timeout is independent of the GitHub workflow's own job timeout. If Studio has already found the workflow run when its deadline expires, it requests cancellation so abandoned builds do not continue consuming Actions time unnecessarily.

The build output includes the request id and workflow-run link whenever GitHub has exposed them.

## Retry

A failed, cancelled, or timed-out cloud build exposes **Retry**. Retry uses the captured build snapshot from the original attempt:

- source bytes/base64 from the attempt;
- project name and project kind;
- platform/workflow selection;
- preflight summary.

It does not silently switch to whatever happens to be in the editor later.

Every retry calls `makeRequestId()` again before dispatch. This creates a distinct request and, for request-named artifacts, a distinct artifact identity. The Windows single-EXE workflow uses a constant artifact name inside each workflow run, but each retry is still a separate workflow-run artifact namespace.

## Credential boundary

The GitHub token is never written to localStorage, sessionStorage, project files, diagnostics, or recovery snapshots. Retry state exists only in memory in the currently open Studio page. Closing/reloading the page discards it.

No-token ready-app, local-kit, and compatibility build modes do not depend on this cloud state machine.

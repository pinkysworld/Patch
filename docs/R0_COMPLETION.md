# Patch Studio R0 completion record

Status date: **2026-08-30**

This document records the evidence-based completion boundary for Patch Studio milestone **R0 – RAD foundation hardening**. It separates release-blocking correctness/responsiveness work from useful follow-up refactoring so that R0 is not kept open indefinitely by maintainability work that does not change the milestone exit criteria.

The active implementation branch is `studio/r0-completion` and the integration pull request is **#307**. R0 architecture history is tracked in **#282**.

## R0 exit contract

R0 is complete when all of the following are true:

1. Designer editing and Form switching are bounded.
2. Designer refresh does not execute unrelated application behavior.
3. Inactive Forms are not eagerly materialized.
4. Typical runtime events do not rebuild the complete visible application tree.
5. Transient focus/selection state is preserved through bounded reconciliation or deterministic fallback.
6. Large-project regressions are measured in real-browser CI.
7. source-backed Designer mutations participate in the canonical edit/Undo transaction path.
8. UI identifiers remain in one effective namespace across supported Designer mutation paths.
9. release/deployment readiness does not create expected red CI while integrity verification remains fail-closed.
10. Offline Compiler packaging and heavy CI follow the real compiler dependency surface rather than unrelated Studio modules.

## Completed architecture

### Declaration-only bounded Designer

The primary Designer uses the declaration-only design snapshot/model path instead of running the application interpreter. Existing R0 work provides exact-source shared snapshots, AST-derived descriptors, bounded caches and active-Form materialization.

PR #307 extends this contract with:

- `studio-design-model/0.2`;
- `studio-design-evaluation-policy/0.1`;
- a per-expression source-length budget;
- a total design-time evaluated-expression budget;
- immutable evaluation counters/policy metadata;
- no budget charge for skipped recipe/event application behavior.

The policy therefore bounds the expression surface that design time actually evaluates without weakening the declaration-only execution boundary.

### Versioned worker boundary

PR #307 adds `patch-studio-worker/0.1` and the UI-free `web/studio-language-worker.js` host.

The boundary supports only explicit tasks:

- `design-model`;
- `compile`.

Requests use bounded source payloads and task-specific plain options. Responses are structured-clone-safe success/error envelopes. The contract creates a stable off-main-thread boundary without requiring R0 to move every existing synchronous call through a Worker immediately.

Actual worker adoption remains incremental and measurement-driven after R0.

### Active-Form materialization and shared design snapshots

Existing R0 work already provides:

- `studio-design-snapshots/0.1`;
- `studio-form-materialization/0.1`;
- active Form fully materialized while inactive Forms remain lightweight shells;
- source-backed selection/Object Inspector/Project Tree continuity across Form transitions;
- declaration-only specialized Designer readers;
- six-Form Workshop Desk acceptance coverage;
- 10-Form / 200-control large-project acceptance and timing coverage.

### Incremental runtime rendering

Existing R0 work provides:

- stable keyed Form/control identity;
- `keyed-control-v2` incremental reconciliation for core-rendered controls;
- bounded focus/caret/scroll restoration;
- shared Table/Tree transient selection state;
- local Tabs updates;
- deterministic `?patch-runtime-render=full` recovery/debug fallback;
- safe complete-Form fallback for adapter-owned model drift.

R0 does **not** require every specialized adapter to implement control-level incremental reconciliation. A specialized adapter may use the deterministic Form fallback when it lacks a canonical incremental state contract. That is a safe bounded behavior, not an R0 correctness gap.

### Performance gates

`patch-studio-browser-performance/0.1` measures in real Chrome:

- Workshop Run to stable app paint;
- Workshop event to paint;
- 10-Form / 200-control initial Run;
- active Designer Form switch.

The CI limits intentionally allow hosted-runner variance while rejecting multi-second freezes: 3000 ms Run-to-paint and 2000 ms event/Form-switch limits.

Large Table/Tree preview virtualization is therefore **measurement-gated**. It is not an R0 blocker while the current large-project gates remain comfortably within thresholds. If measurements regress, virtualization can be introduced against a concrete failing workload instead of pre-emptively adding complexity.

### Canonical Designer UI namespace

The existing `designer-ui-namespace/0.1` enumerates effective UI/event targets across core controls, nested Panel/Tabs controls, MenuItems and result-dialog targets.

PR #307 closes the remaining duplicate-path gap:

- control duplication allocates new IDs against the global Designer UI namespace rather than controls alone;
- Form duplication uses the same global namespace;
- nested Panel controls participate in duplication traversal;
- MenuItems inside duplicated Forms receive fresh IDs and copied event handlers are retargeted;
- regression coverage exercises collisions with MenuItem and dialog result IDs.

Future component families must enter the same namespace contract rather than creating a second allocator.

### Canonical edit/Undo mutation path

The existing Studio edit history is bounded, source-backed and per-file. It coalesces trusted typing, keeps Designer rewrites atomic, supports Undo/Redo shortcuts and resets stale history across project/resource replacement boundaries.

PR #307 adds a repository regression that audits current Designer source mutators. Modules that assign to `code.value` must emit the canonical `input` and `change` DOM signals so that the central edit-history/project synchronization path observes the mutation.

This closes the R0 requirement that adapter-specific source mutations must not silently bypass canonical edit transactions.

### Release-aware Pages orchestration

Pages keeps its release/digest integrity boundary but no longer treats a runtime release that is still publishing as an expected failure.

Behavior is now:

- automatic `push` / runtime `workflow_run`: missing pinned runtime release -> `ready=false`, deployment deferred successfully;
- successful runtime workflow completion re-runs the readiness check;
- manual `workflow_dispatch`: missing pinned runtime release -> fail closed;
- runtime download, SHA-256 digest manifest generation, site validation, deployment and live Chrome verification execute only when `ready=true`.

This removes expected red CI without converting missing runtime assets into a false successful deployment.

### Offline Compiler dependency closure

PR #307 replaces blanket `src/*.js` embedding with one deterministic local ESM dependency closure rooted at:

- `src/cli-entry.js`;
- `src/cli.js` (the intentional URL-launched CLI edge).

The closure is shared by:

- SEA compiler packaging;
- macOS Intel portable kit source copying;
- FreeBSD portable kit source copying;
- workflow affected-path decisions.

The artifact manifest records the embedded module list/source-graph version. Studio-only design modules are excluded unless they become real CLI dependencies.

The Offline Compiler workflow may still be triggered by a broad repository path filter, but a cheap dependency-graph preflight prevents the expensive cross-platform build matrix from running when changed `src/` files are outside the actual CLI closure. Runtime/build/release inputs remain fail-safe affected inputs.

## R0 CI evidence

PR #307 is required to pass the normal repository gates before R0 is declared integrated. The relevant gates include:

- Patch CI;
- Patch CodeQL Security;
- Patch Reproducibility Bundle;
- Patch Offline Studio;
- Patch Offline Compiler.

The Offline Compiler matrix has already demonstrated the dependency-closure packaging across Windows x64, Linux x64, macOS ARM64, macOS Intel and FreeBSD, including native Window/link smoke paths where supported.

The final PR head must be green before #282 is closed or the R0 status is merged to `main`.

## Explicitly deferred to R0.1 / later

The following work remains useful but does not block the R0 exit contract:

### Studio maintainability decomposition

`web/playground.js` still owns substantial orchestration. Continue extracting, with behavior-preserving tests:

- Run/runtime lifecycle;
- Window/control DOM renderer;
- transient runtime state helpers that have not already moved to shared modules;
- Build controller;
- obsolete compatibility/sample source after migration coverage no longer needs it.

This is maintainability work. It should not force a risky big-bang refactor immediately before an otherwise-green R0 integration.

### Unified Inspector/command ownership

Continue converging specialized adapters on common contracts for:

- dirty/apply/error state;
- delete/duplicate/reveal-source commands;
- property ownership and command IDs.

The canonical selection service and source mutation transaction boundary already exist; full adapter API unification can proceed incrementally.

### Worker adoption

The Worker protocol is versioned in R0. Route parse/compile/design-model work through it where real-browser measurements demonstrate benefit. Preserve a deterministic synchronous/fail-safe path while adoption is incomplete.

### Large Table/Tree virtualization

Implement only when real measurements cross a justified threshold or a representative application demonstrates a concrete DOM/memory problem.

### Adapter-specific incremental reconciliation

Add only where an adapter has a stable canonical transient-state contract. Until then, deterministic Form fallback remains the safe behavior.

## R0 completion decision

Once the final PR #307 head is green across the required gates, R0 may be marked **complete** without claiming that every future Studio refactor is finished.

The next engineering phase should be **R0.1 maintainability + R1 product capability**, not additional unbounded expansion of the R0 definition.

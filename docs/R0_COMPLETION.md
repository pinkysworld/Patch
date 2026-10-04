# Patch Studio R0 completion record

Status date: **2026-10-02**

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

The original R0 work introduced the UI-free `web/studio-language-worker.js` host. Follow-up hardening on 2026-10-02 advances the versioned boundary to `patch-studio-worker/0.2` and wires it into the live Studio.

The boundary now supports explicit tasks:

- `parse`;
- `design-model`;
- `compile`.

`studio-language-client/0.1` runs those tasks through a module Worker when available and uses the exact same protocol handler as a synchronous compatibility fallback. Designer and Change Contract requests use stale-response guards, and exact design revisions retain a bounded client cache. Requests remain bounded, task-specific and structured-clone-safe.

### Active-Form materialization and shared design snapshots

Existing R0 work already provides:

- `studio-design-snapshots/0.1`;
- `studio-form-materialization/0.1`;
- active Form fully materialized while inactive Forms remain lightweight shells;
- source-backed selection/Object Inspector/Project Tree continuity across Form transitions;
- declaration-only specialized Designer readers;
- seven-Form Workshop Desk acceptance coverage;
- 10-Form / 200-control large-project acceptance and timing coverage.

### Incremental runtime rendering

Existing R0 work provides:

- stable keyed Form/control identity;
- `keyed-control-v2` incremental reconciliation for core-rendered controls;
- bounded focus/caret/scroll restoration;
- shared Table/Tree transient selection state;
- local Tabs updates;
- `table-runtime-adapter/0.1`, which keeps the canonical source-backed Table adapter outside unknown-specialized drift and signals its own keyed/fingerprinted reconciler when its runtime envelope changes;
- deterministic `?patch-runtime-render=full` recovery/debug fallback;
- safe complete-Form fallback for specialized adapters that do not yet expose a canonical incremental state contract.

The Table extension is intentionally narrow. StatusBar, PaintBox and other specialized controls are not inferred into the contract and therefore retain the deterministic Form fallback until they have an explicit canonical state contract.

### Performance gates

`patch-studio-browser-performance/0.1` measures in real Chrome:

- Workshop Run to stable app paint;
- Workshop event to paint;
- 10-Form / 200-control initial Run;
- active Designer Form switch.

The CI limits intentionally allow hosted-runner variance while rejecting multi-second freezes: 3000 ms Run-to-paint and 2000 ms event/Form-switch limits.

Follow-up hardening now includes `studio-preview-virtualization/0.1`. Very large Designer Table and TreeView previews render only the visible window plus bounded overscan, while ordinary previews and all interactive runtime Table/Tree rendering retain the full DOM path. The pure windowing policy is regression-tested independently of browser CI.

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

The release-aware readiness logic remains fail-closed when a deployment is deliberately run. During active development as of 2026-10-02, all repository workflows are manual-only through `workflow_dispatch`; ordinary pushes and pull requests therefore do not consume GitHub Actions minutes. The runtime download, SHA-256 digest manifest generation, site validation, deployment and live Chrome verification remain available as deliberate evidence runs.

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

Historical R0 integration evidence includes Patch CI, CodeQL, Reproducibility Bundle, Offline Studio and Offline Compiler coverage. The Offline Compiler matrix demonstrated dependency-closure packaging across Windows x64, Linux x64, macOS ARM64, macOS Intel and FreeBSD, including native Window/link smoke paths where supported.

For the 2026-10-02 follow-up changes, automatic workflows are intentionally disabled to preserve private-repository Actions minutes. The Worker, preview-windowing and Table-adapter changes include focused regression tests and static syntax checks; full workflow evidence should be run manually at a deliberate release/evidence point.

## Explicitly deferred to R0.1 / later

The following work remains useful but does not block the R0 exit contract:

### Studio maintainability decomposition

`web/playground.js` is now orchestration-only for the bounded lifecycle surfaces. The behavior-preserving extraction sequence is complete:

- Run/runtime lifecycle through `studio-run-controller/0.1`;
- Window/control DOM renderer through `studio-window-renderer/0.2`;
- transient runtime state helpers that have not already moved to shared modules;
- Build controller;
- Designer/Change Contract preview scheduling, stale-response guards and active-Form rematerialization through `studio-preview-controller/0.1`;
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

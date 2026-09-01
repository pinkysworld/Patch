# Patch documentation

This directory contains product contracts, implementation references, research/assurance notes and historical milestone snapshots. For the public learning path, use the generated Documentation page in Patch Studio. For repository work, start with the current documents below instead of reading files alphabetically.

## Start here

- [`../README.md`](../README.md) - project overview, current product boundary and quick start.
- [`ROADMAP.md`](ROADMAP.md) - concise current product status and promotion gates.
- [`RAD_STUDIO_MASTER_BACKLOG.md`](RAD_STUDIO_MASTER_BACKLOG.md) - authoritative long-term Patch Studio/RAD execution order.
- [`PATCH_STUDIO.md`](PATCH_STUDIO.md) - current source-backed IDE and Designer contract.
- [`SPEC.md`](SPEC.md) - current language/product specification boundary.
- [`COMPATIBILITY.md`](COMPATIBILITY.md) - compatibility policy and preserved contracts.

## Current native and distribution contracts

Current Ready desktop product contract: **Native GUI IR 1.9 / payload v19 / runtime v1.10**.

The promoted line contains the complete **IR 1.8 / payload v18 / runtime v1.9 Button/ImageList** layer plus **IR 1.9 / payload v19 / runtime v1.10 Window/application icons**. Runtime releases, cross-platform package evidence, SHA-256/GitHub asset digests, source binding and the dual-runtime Offline Compiler promotion gate are complete. **Payload v17 / runtime v1.8 remains an explicit compatibility path**, not the default Current Ready output.

- [`NATIVE_GUI.md`](NATIVE_GUI.md) - native GUI architecture and current/frozen/compatibility contracts.
- [`NATIVE_APPS.md`](NATIVE_APPS.md) - application build matrix and native package behavior.
- [`TARGETS.md`](TARGETS.md) - canonical target matrix.
- [`OFFLINE_COMPILER.md`](OFFLINE_COMPILER.md) - downloadable local compiler/linker contract.
- [`OFFLINE_STUDIO.md`](OFFLINE_STUDIO.md) - installed/offline IDE stages and boundaries.
- [`NATIVE_COMPATIBILITY.md`](NATIVE_COMPATIBILITY.md) - explicit native compatibility lines.
- [`WINDOW_ICONS.md`](WINDOW_ICONS.md) - source/Web/native Window-icon and application-icon contract.
- [`COMPONENT_CAPABILITY_MATRIX.md`](COMPONENT_CAPABILITY_MATRIX.md) - generated component/target capability surface.

## Studio and RAD architecture

- [`STUDIO_AUTHORING_SURFACE.md`](STUDIO_AUTHORING_SURFACE.md) - current source-backed authoring operations.
- [`STUDIO_SELECTION_ARCHITECTURE.md`](STUDIO_SELECTION_ARCHITECTURE.md) - shared Designer selection ownership.
- [`STUDIO_KEYBOARD_ACCESSIBILITY.md`](STUDIO_KEYBOARD_ACCESSIBILITY.md) - keyboard/accessibility authoring contract.
- [`STUDIO_TABLE_ACTIONS.md`](STUDIO_TABLE_ACTIONS.md) - Table structural editing semantics.
- [`BUILD_RESILIENCE.md`](BUILD_RESILIENCE.md) - build/recovery reliability boundaries.
- [`DIAGNOSTICS.md`](DIAGNOSTICS.md) - diagnostic contracts and privacy boundaries.

Component-specific documents such as `TREEVIEW_STAGE1.md`, `TABS.md`, `LISTBOX.md`, `COMBOBOX.md` and the Table action/compatibility references remain implementation documentation for their individual source/runtime contracts.

## Language, compiler and assurance

- [`COMPILER.md`](COMPILER.md) - compiler architecture and backend boundaries.
- [`CLI_CONTRACT.md`](CLI_CONTRACT.md) - stable command-line interface contract.
- [`SEMANTICS.md`](SEMANTICS.md) - semantic rules and runtime invariants.
- [`FORMAL_MODEL.md`](FORMAL_MODEL.md) - mechanized/formal model boundary.
- [`CALL_SITE_VALIDATION.md`](CALL_SITE_VALIDATION.md) - independent raw-source call-site validation.
- [`CONTROLLED_EVALUATION.md`](CONTROLLED_EVALUATION.md) - controlled evaluation methodology and evidence rules.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) - Studio, native, release and supply-chain trust boundaries.
- [`SECURITY_MAINTENANCE.md`](SECURITY_MAINTENANCE.md) and [`SECURITY_REVIEW_CHECKLIST.md`](SECURITY_REVIEW_CHECKLIST.md) - maintenance and review gates.
- [`SECURITY_CASE_STUDIES.md`](SECURITY_CASE_STUDIES.md) - security evaluation case studies.

Research and assurance documents may intentionally describe narrower historical proof boundaries than the current product feature set. Product version growth must not be read as automatic proof-coverage growth.

## Historical snapshots

Files named `BETA33.md`, `BETA34.md`, `BETA35.md` and similar milestone documents are retained as **historical snapshots**. They are useful for reproducibility and development history but are not the authoritative current product status.

`BETA36.md` is the current beta milestone record, while `ROADMAP.md`, `PATCH_STUDIO.md`, `NATIVE_GUI.md` and the generated public documentation are the preferred sources for the live product boundary.

Do not update a historical snapshot merely to make it read like the current release. Instead, update the current contract documents and preserve the snapshot unless a factual error exists inside the historical record.

## Documentation maintenance rule

When a feature crosses a product boundary, update the authoritative contract first, then the public website and generated capability surfaces, and keep these distinctions explicit:

1. **implemented** - code/tests exist;
2. **published** - versioned release assets exist;
3. **verified** - release bytes/digests and target smoke evidence are green;
4. **Current Ready** - the product facade, Offline Compiler and public surfaces select the contract.

This prevents implementation work from being advertised as a promoted download before its release/integrity gate is complete.

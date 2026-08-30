from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'docs/ROADMAP.md',
    '- Studio design model/cache: **0.1**, with primary browser Designer refresh using the declaration-only cached snapshot path\n- Studio Form materialization: **0.1**, with exactly one active Designer Form fully materialized and inactive Forms retained as lightweight source-backed shells',
    '- Studio design model/cache: **0.1**, with primary browser Designer refresh using the declaration-only cached snapshot path\n- shared Studio design snapshots: **0.1**, with first-read Window/control descriptors derived from the already parsed design AST\n- Studio Form materialization: **0.1**, with exactly one active Designer Form fully materialized and inactive Forms retained as lightweight source-backed shells\n- runtime selection state: **0.1**, bounded and keyed for transient Table/Tree state\n- runtime render policy: **0.1**, default `keyed-control-v2` with explicit `?patch-runtime-render=full` deterministic fallback'
)
replace_once(
    'docs/ROADMAP.md',
    '- [x] Stage 1 keyed runtime Form/control identities reuse unchanged Form DOM across events and restore bounded focus, caret, scroll and unchanged-model multi-selection state when a changed Form is replaced\n- [x] Tabs page switches update only their local tab panel instead of rebuilding the complete runtime window tree',
    '- [x] Stage 1 keyed runtime Form/control identities reuse unchanged Form DOM across events and restore bounded focus, caret, scroll and unchanged-model multi-selection state when a changed Form is replaced\n- [x] `studio-design-snapshots/0.1` shares exact-source declaration-only snapshots across Designer readers, and first-read descriptors reuse the already parsed design AST\n- [x] `keyed-control-v2` reconciles changed core-rendered controls inside stable visible Forms while preserving unchanged sibling DOM identity\n- [x] bounded keyed runtime selection state preserves transient Table row and Tree path selection across safe Form rebuilds\n- [x] explicit `?patch-runtime-render=full` uses the canonical full renderer as a deterministic diagnostics/recovery fallback and preserves transient runtime state\n- [x] Tabs page switches update only their local tab panel instead of rebuilding the complete runtime window tree'
)
replace_once(
    'docs/ROADMAP.md',
    'Remaining R0 work:\n- [ ] share parsed/compiled AST/design snapshots across Designer adapters by project revision\n- [ ] preserve Object Inspector, selection, structural editing and Project Explorer across Form materialization\n- [ ] define and implement the Worker boundary for parse/compile/design-model work\n- [ ] bounded evaluation policy for any remaining design-time expressions\n- [ ] fine-grained keyed control reconciliation inside a changed Form rather than replacing that whole Form shell\n- [ ] Workshop click-to-first-app-paint, large-form event-to-paint and Form-switch performance gates\n- [ ] split runtime lifecycle, Window rendering, transient UI state and Build controller out of `web/playground.js`\n- [ ] make Pages deployment release-aware so expected runtime-publication races do not generate failure noise',
    'Remaining R0 work:\n- [ ] preserve Object Inspector, selection, structural editing and Project Explorer across Form materialization\n- [ ] virtualize very large Table/Tree previews where measurements justify it\n- [ ] define and implement the Worker boundary for parse/compile/design-model work\n- [ ] bounded evaluation policy for any remaining design-time expressions\n- [ ] extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists\n- [ ] Workshop click-to-first-app-paint, large-form event-to-paint and Form-switch performance gates\n- [ ] split runtime lifecycle, Window rendering, transient UI state and Build controller out of `web/playground.js`\n- [ ] make Pages deployment release-aware so expected runtime-publication races do not generate failure noise\n- [ ] reduce CI notification noise by shrinking Offline Compiler packaging/triggers to its real CLI dependency graph'
)

replace_once('docs/RAD_STUDIO_MASTER_BACKLOG.md', 'Status synchronized: **2026-08-29**', 'Status synchronized: **2026-08-30**')
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    '- R0 `studio-design-model/0.1` and `studio-design-cache/0.1`, wired into the primary non-executing Designer refresh path;\n- R0 `studio-form-materialization/0.1`, with only the active Form fully materialized and sibling Forms retained as lightweight source-backed shells;',
    '- R0 `studio-design-model/0.1` and `studio-design-cache/0.1`, wired into the primary non-executing Designer refresh path;\n- R0 `studio-design-snapshots/0.1`, sharing exact-source declaration-only snapshots and AST-derived Designer descriptors;\n- R0 `studio-form-materialization/0.1`, with only the active Form fully materialized and sibling Forms retained as lightweight source-backed shells;\n- R0 `studio-runtime-selection-state/0.1` and `studio-runtime-render-policy/0.1`, preserving keyed transient selections with incremental-by-default rendering and an explicit deterministic full fallback;'
)
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    '- [x] Run yields one browser task before the large compile/execute/render pipeline.\n\nRemaining:\n- [ ] share the design snapshot cache across Designer adapters;',
    '- [x] Run yields one browser task before the large compile/execute/render pipeline;\n- [x] `studio-design-snapshots/0.1` shares exact-source declaration-only snapshots across Designer readers;\n- [x] canonical first-read Window/control descriptors reuse the already parsed design AST instead of reparsing source.\n\nRemaining:'
)
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    '- [ ] reconcile only changed controls inside a changed Form rather than replacing its complete shell;\n- [ ] preserve richer transient Table/Tree adapter selections through the same canonical keyed-state contract;\n- [ ] deterministic full rerender fallback/debug mode;',
    '- [x] reconcile changed core-rendered controls inside a stable changed Form while retaining unchanged sibling DOM identity;\n- [x] preserve richer transient Table/Tree adapter selections through the same canonical keyed-state contract;\n- [x] deterministic full rerender fallback/debug mode through explicit `?patch-runtime-render=full`;\n- [ ] extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists;'
)
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    '- [x] live HTTP/Chrome verification after deploy;\n- [ ] reduce notification noise without weakening gates.',
    '- [x] live HTTP/Chrome verification after deploy;\n- [x] deployed Tutorials/Examples handbook pages and their content-addressed stylesheet are explicitly live-smoked after Pages deployment;\n- [ ] reduce notification noise without weakening gates;\n- [ ] package only the real Offline Compiler CLI dependency graph so unrelated `src` changes do not trigger unnecessary cross-platform compiler rebuilds.'
)

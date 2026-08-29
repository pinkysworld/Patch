from pathlib import Path

# Trigger the retry only after the workflow has been updated to use the current docs-aware transformer.
# Reuse the already-reviewed code/test transformation from the first guarded script,
# but stop before its stale documentation anchor and apply current documentation edits below.
source = Path('.github/scripts/r0_keyed_runtime_once.py').read_text()
marker = "\nroadmap = branch_files['roadmap'].read_text()"
if marker not in source:
    raise SystemExit('keyed runtime code transformation marker not found')
exec(compile(source.split(marker, 1)[0], 'r0_keyed_runtime_code', 'exec'), {})

roadmap_path = Path('docs/ROADMAP.md')
roadmap = roadmap_path.read_text()
completed_anchor = '- [x] Workshop Desk expanded from three to six Forms as the canonical large RAD showcase/stress fixture\n'
completed_add = completed_anchor + '''- [x] Stage 1 keyed runtime Form/control identities reuse unchanged Form DOM across events and restore bounded focus, caret, scroll and unchanged-model multi-selection state when a changed Form is replaced\n- [x] Tabs page switches update only their local tab panel instead of rebuilding the complete runtime window tree\n'''
if completed_anchor not in roadmap:
    raise SystemExit('ROADMAP completed R0 anchor not found')
roadmap = roadmap.replace(completed_anchor, completed_add, 1)
roadmap = roadmap.replace('- [ ] stable keyed Form/control identities in the browser runtime renderer\n', '', 1)
roadmap = roadmap.replace('- [ ] incremental event rendering with focus/caret/scroll/transient-selection preservation\n', '- [ ] fine-grained keyed control reconciliation inside a changed Form rather than replacing that whole Form shell\n', 1)
roadmap = roadmap.replace('- [ ] avoid complete window-tree rebuild on Tabs page switches\n', '', 1)
roadmap_path.write_text(roadmap)

backlog_path = Path('docs/RAD_STUDIO_MASTER_BACKLOG.md')
backlog = backlog_path.read_text()
old_p04 = '''## P0.4 Incremental runtime renderer\n\n- [ ] stable keyed Form/control identities;\n- [ ] update only changed visible Forms/controls where safe;\n- [ ] preserve focus, caret, scroll and transient Table/Tree/List selections;\n- [ ] avoid complete app-tree rebuild on Tabs page changes;\n- [ ] deterministic full rerender fallback/debug mode;\n- [ ] event-to-paint regression gates.\n'''
new_p04 = '''## P0.4 Incremental runtime renderer\n\n- [x] stable keyed Form/control identities in the browser runtime surface;\n- [x] Stage 1 event reconciliation reuses unchanged Form DOM and replaces only changed Form shells;\n- [x] bounded focus, caret, Form/control scroll and unchanged-model multi-selection restoration across changed-Form replacement;\n- [x] Tabs page changes update only the local tab panel and preserve parent/unrelated Form DOM identity;\n- [ ] reconcile only changed controls inside a changed Form rather than replacing its complete shell;\n- [ ] preserve richer transient Table/Tree adapter selections through the same canonical keyed-state contract;\n- [ ] deterministic full rerender fallback/debug mode;\n- [ ] event-to-paint regression gates.\n'''
if old_p04 not in backlog:
    raise SystemExit('Backlog P0.4 anchor not found')
backlog_path.write_text(backlog.replace(old_p04, new_p04, 1))

gpt_path = Path('docs/GPT.md')
gpt = gpt_path.read_text()
old_next = '''Next R0 work:\n\n1. share revision snapshots across remaining Designer adapters and define the Worker boundary;\n2. stable keyed/incremental runtime rendering with focus/caret/selection preservation;\n3. measurable six-Form Workshop/large-project performance gates;\n4. preserve Explorer/Inspector/selection contracts across materialized Form switches;\n5. split runtime/render/build responsibilities out of `web/playground.js`;\n6. make Pages deployment release-aware without weakening fail-closed runtime verification.\n'''
new_next = '''Current incremental-runtime additions:\n\n- Stage 1 keyed Form/control identities keep unchanged Form DOM stable across runtime events;\n- changed Form replacement restores bounded focus, caret, scroll and unchanged-model multi-selection state;\n- Tabs switch locally inside their panel instead of rebuilding the complete app tree.\n\nNext R0 work:\n\n1. share revision snapshots across remaining Designer adapters and define the Worker boundary;\n2. move from changed-Form replacement to fine-grained changed-control reconciliation;\n3. preserve richer transient Table/Tree adapter selection through the canonical keyed-state layer;\n4. add measurable six-Form Workshop event-to-paint performance gates;\n5. preserve Explorer/Inspector/selection contracts across materialized Form switches;\n6. split runtime/render/build responsibilities out of `web/playground.js`;\n7. make Pages deployment release-aware without weakening fail-closed runtime verification.\n'''
if old_next not in gpt:
    raise SystemExit('GPT R0 next-work anchor not found')
gpt_path.write_text(gpt.replace(old_next, new_next, 1))

from pathlib import Path


def replace_exact(path, before, after, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(before)
    if actual < count:
        raise SystemExit(f'{path}: expected at least {count} match(es), got {actual}: {before[:110]!r}')
    p.write_text(text.replace(before, after, count))


# First harden the temporary Node patcher. These edits are intentionally about
# the harness only, so no product file is committed unless every later gate passes.
mjs = Path('scripts/assistant-timepicker-showcase-polish.mjs')
text = mjs.read_text()

start = text.index("replaceOnce('src/window-input-presentation.js', `      } else if (date) {")
end = text.index("\n\n// Current Ready native remains intentionally fail-closed.", start)
text = text[:start] + '''replaceOnce('src/window-input-presentation.js', "      } else if (date) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Date'} date input`);\\n      } else if (mask && !password)", "      } else if (date) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Date'} date input`);\\n      } else if (time) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Time'} time input`);\\n      } else if (mask && !password)");''' + text[end:]

start = text.index("replaceOnce('src/native-current-contract.js', `      if (node.inputPresentation === 'date') {")
end = text.index("\n\n// Standalone Web contract and renderer.", start)
text = text[:start] + '''replaceOnce('src/native-current-contract.js', "      if (node.inputPresentation === 'date') {\\n        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputMask) {", "      if (node.inputPresentation === 'date') {\\n        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputPresentation === 'time') {\\n        throw new NativeGuiError(`TimePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no time-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputMask) {");''' + text[end:]

old = '''replaceAll('src/window-input-presentation.js', "  ensureDatePickerButton();\\n  ensureInputPresentationInspector();", "  ensureDatePickerButton();\\n  ensureTimePickerButton();\\n  ensureInputPresentationInspector();", 2);'''
new = '''replaceOnce('src/window-input-presentation.js', "  ensureDatePickerButton();\\n  ensureInputPresentationInspector();", "  ensureDatePickerButton();\\n  ensureTimePickerButton();\\n  ensureInputPresentationInspector();");
replaceOnce('src/window-input-presentation.js', "      ensureDatePickerButton();\\n      ensureInputPresentationInspector();", "      ensureDatePickerButton();\\n      ensureTimePickerButton();\\n      ensureInputPresentationInspector();");'''
if old not in text:
    raise SystemExit('temporary harness: missing DatePicker install anchor')
text = text.replace(old, new, 1)

old = '''replaceAll('examples/workshop-desk.patch', 'Component Registry 0.9', 'Current Ready subset of Component Registry 0.10', 3);
replaceOnce('examples/workshop-desk.patch', 'node "Registry 0.9"', 'node "Registry 0.10 native subset"');
replaceOnce('examples/workshop-desk.patch', 'Complete Component Registry 0.9 gallery opened', 'Current Ready Component Registry 0.10 subset opened');'''
new = '''replaceOnce('examples/workshop-desk.patch', 'Complete Component Registry 0.9 gallery opened', 'Current Ready Component Registry 0.10 subset opened');
replaceOnce('examples/workshop-desk.patch', 'node "Registry 0.9"', 'node "Registry 0.10 native subset"');
replaceAll('examples/workshop-desk.patch', 'Component Registry 0.9', 'Current Ready subset of Component Registry 0.10', 3);'''
if old not in text:
    raise SystemExit('temporary harness: missing Workshop Registry ordering block')
text = text.replace(old, new, 1)

# Avoid a double-escaped RegExp in generated test source. A literal includes()
# check is clearer and still asserts that Calendar remains explicitly open.
calendar_regex = r"  assert.match(roadmap, /\\[ \\] Calendar/);"
if calendar_regex not in text:
    raise SystemExit('temporary harness: missing Calendar assertion generator')
text = text.replace(calendar_regex, "  assert.equal(roadmap.includes('- [ ] Calendar'), true);", 1)
mjs.write_text(text)

# Workshop Desk also has a retained Studio sample. Promote its compatibility
# bridge to v0.7 and make cached beta35 projects converge on the same canonical app.
replace_exact('web/studio-dom-sync.js', "export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.6';", "export const WORKSHOP_DESK_CURRENT_SAMPLE_VERSION = '0.7';")
replace_exact('web/studio-dom-sync.js', '  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28', '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 750, 18 size 300, 28')
replace_exact('web/studio-dom-sync.js', 'Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component.', 'Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component.')
replace_exact('web/studio-dom-sync.js', 'It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring.', 'It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring.')
replace_exact('web/studio-dom-sync.js', 'Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface.', 'Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10.')
replace_exact('web/studio-dom-sync.js', 'node "Registry 0.9"', 'node "Registry 0.10 native subset"')
replace_exact('web/studio-dom-sync.js', 'Complete Component Registry 0.9 gallery opened', 'Current Ready Component Registry 0.10 subset opened')
replace_exact('web/studio-dom-sync.js', 'canonical polished v0.6 showcase', 'canonical polished v0.7 showcase')

replace_exact(
    'web/studio-dom-sync.js',
    "  if (!next.includes('create text gallery_text = \"Workshop sample\"')) {",
    "  if (!next.includes('create number base_rate = 25')) {\n    next = next.replace(\n      'create number ticket_total = 40',\n      'create number ticket_total = 40\\ncreate number base_rate = 25\\ncreate number inspection_fee = 15\\ncreate number rush_fee = 20\\ncreate number quote_revision = 0'\n    );\n  }\n\n  if (!next.includes('create text gallery_text = \"Workshop sample\"')) {"
)

anchor = "  if (!next.includes('window \"Component Gallery\" as components size 900, 640:')) {"
runtime_migration = '''  next = next.replace(
    '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
    '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\\n    text "Quote revision {quote_revision}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
  );

'''
replace_exact('web/studio-dom-sync.js', anchor, runtime_migration + anchor)

quote_migration = '''  next = next
    .replace(
      'when quote_button clicked:\\n  change ticket_total:\\n    add 25\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Quote increased by 25"',
      'when quote_button clicked:\\n  change ticket_total:\\n    set = qty * base_rate + inspection_fee\\n  if rush:\\n    change ticket_total:\\n      add rush_fee\\n  if priority == "Critical":\\n    change ticket_total:\\n      add 30\\n  change quote_revision:\\n    add 1\\n  if ticket_total > labor_limit:\\n    change ticket_state:\\n      set = "Approval"\\n  else:\\n    change ticket_state:\\n      set = "Quoted"\\n  change status:\\n    set = "Quote recalculated from ticket state"'
    )
    .replace(
      'when details_quote clicked:\\n  change ticket_total:\\n    add 10\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Inspection added to quote"',
      'when details_quote clicked:\\n  change ticket_total:\\n    add inspection_fee\\n  change quote_revision:\\n    add 1\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Inspection fee added to quote"'
    )
    .replace(
      '  change ticket_total:\\n    set = 40\\n',
      '  change ticket_total:\\n    set = 40\\n  change quote_revision:\\n    set = 0\\n'
    );

'''
replace_exact('web/studio-dom-sync.js', anchor, quote_migration + anchor)

# Keep native acceptance tests aligned with the richer but still native-safe app.
replace_exact('tests/workshop-desk.test.js', 'canonical v0.6', 'canonical v0.7')
replace_exact('tests/workshop-desk.test.js', "assert.equal(WORKSHOP_DESK_CURRENT_SAMPLE_VERSION, '0.6');", "assert.equal(WORKSHOP_DESK_CURRENT_SAMPLE_VERSION, '0.7');")
replace_exact('tests/workshop-desk.test.js', "  assert.equal(result.state.ticket_total, 40);", "  assert.equal(result.state.ticket_total, 40);\n  assert.equal(result.state.base_rate, 25);\n  assert.equal(result.state.inspection_fee, 15);\n  assert.equal(result.state.rush_fee, 20);\n  assert.equal(result.state.quote_revision, 0);")
replace_exact('tests/workshop-desk.test.js', "  assert.equal(result.state.ticket_total, 65);\n  assert.equal(result.state.ticket_state, 'Quoted');\n  assert.equal(result.state.status, 'Quote increased by 25');", "  assert.equal(result.state.ticket_total, 115);\n  assert.equal(result.state.ticket_state, 'Approval');\n  assert.equal(result.state.quote_revision, 1);\n  assert.equal(result.state.status, 'Quote recalculated from ticket state');")
replace_exact('tests/workshop-desk.test.js', "  assert.equal(result.state.ticket_total, 75);\n  assert.equal(result.state.ticket_state, 'Quoted');", "  assert.equal(result.state.ticket_total, 130);\n  assert.equal(result.state.ticket_state, 'Quoted');\n  assert.equal(result.state.quote_revision, 2);")
replace_exact('tests/workshop-desk.test.js', 'Complete Component Registry 0.9 gallery opened', 'Current Ready Component Registry 0.10 subset opened')
replace_exact('tests/workshop-desk.test.js', "['Registry 0.9', 'Data', 'TreeView']", "['Registry 0.10 native subset', 'Data', 'TreeView']")
replace_exact('tests/workshop-desk.test.js', "  assert.equal(result.state.ticket_total, 40);\n  assert.equal(result.state.ticket_bench, 'Bench A');", "  assert.equal(result.state.ticket_total, 40);\n  assert.equal(result.state.quote_revision, 0);\n  assert.equal(result.state.ticket_bench, 'Bench A');")
replace_exact('tests/workshop-desk.test.js', 'Workshop Desk covers every Component Registry 0.9 control without hidden app state', 'Workshop Desk covers the Current Ready Component Registry 0.10 subset without hidden app state')
replace_exact('tests/workshop-desk.test.js', 'Seven-Form RAD showcase · every Component Registry 0.9 control is represented', 'Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented')
replace_exact('tests/workshop-desk.test.js', "'create number ticket_total = 40', 'create text gallery_text", "'create number ticket_total = 40', 'create number base_rate = 25', 'create number quote_revision = 0', 'create text gallery_text")
replace_exact('tests/workshop-native-ready.test.js', 'Workshop Desk builds on current Ready across the complete Component Registry 0.9 showcase', 'Workshop Desk builds on Current Ready across the Component Registry 0.10 native subset')

# Registry source is already 0.10, remove stale current-baseline documentation.
replace_exact('docs/BETA36.md', 'Component Registry: `0.9`', 'Component Registry: `0.10`')
replace_exact('docs/PATCH_STUDIO.md', 'Component Registry **0.9**', 'Component Registry **0.10**')
replace_exact('docs/PRODUCTION_READINESS.md', 'Component Registry **0.9**', 'Component Registry **0.10**')

from pathlib import Path


def replace_once(path, before, after):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}: {before[:120]!r}')
    p.write_text(text.replace(before, after, 1), encoding='utf-8')


studio_path = Path('web/studio-dom-sync.js')
studio = studio_path.read_text(encoding='utf-8')

# These constants now describe the canonical v0.7 target, not the old v0.6 target.
for old, new in [
    ('WORKSHOP_MAIN_V06', 'WORKSHOP_MAIN_V07'),
    ('WORKSHOP_GALLERY_STATE_V06', 'WORKSHOP_GALLERY_STATE_V07'),
    ('WORKSHOP_GALLERY_FORM_V06', 'WORKSHOP_GALLERY_FORM_V07'),
    ('WORKSHOP_GALLERY_EVENTS_V06', 'WORKSHOP_GALLERY_EVENTS_V07'),
]:
    studio = studio.replace(old, new)

old_guard = '''  if (
    next.includes('window "Component Gallery" as components size 900, 640:') &&
    next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented') &&
    next.includes('Current desktop Ready runtime contract: v1.10.')
  ) return next;

  const v05 = next.includes('window "Workshop Desk" as main size 1080, 700:')'''

new_guard = '''  const v07 = next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented')
    && next.includes('create number quote_revision = 0')
    && next.includes('Base rate and inspection added')
    && next.includes('Current desktop Ready runtime contract: v1.10.');
  if (v07) return next;

  const v06 = next.includes('window "Workshop Desk" as main size 1080, 720:')
    && next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented')
    && next.includes('Current desktop Ready runtime contract: v1.10.')
    && !next.includes('create number quote_revision = 0');
  if (v06) {
    return next
      .replace(
        'create number ticket_total = 40',
        'create number ticket_total = 40\\ncreate number base_rate = 25\\ncreate number inspection_fee = 15\\ncreate number rush_fee = 20\\ncreate number quote_revision = 0'
      )
      .replace(
        '  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28',
        '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 750, 18 size 300, 28'
      )
      .replace(
        '  text "Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24',
        '  text "Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24'
      )
      .replace(
        '      text "It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring."',
        '      text "It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring."'
      )
      .replace(
        '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
        '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\\n    text "Quote revision {quote_revision}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
      )
      .replace(
        '      text "Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface."',
        '      text "Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10."'
      )
      .replace('    node "Registry 0.9"', '    node "Registry 0.10 native subset"')
      .replace(
        'when quote_button clicked:\\n  change ticket_total:\\n    add 25\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Quote increased by 25"',
        'when quote_button clicked:\\n  change ticket_total:\\n    add 25\\n    add 15\\n  change quote_revision:\\n    add 1\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Base rate and inspection added"'
      )
      .replace(
        'when details_quote clicked:\\n  change ticket_total:\\n    add 10\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Inspection added to quote"',
        'when details_quote clicked:\\n  change ticket_total:\\n    add 15\\n  change quote_revision:\\n    add 1\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Inspection fee added to quote"'
      )
      .replace(
        '    set = "Complete Component Registry 0.9 gallery opened"',
        '    set = "Current Ready Component Registry 0.10 subset opened"'
      )
      .replace(
        '  change ticket_total:\\n    set = 40\\n',
        '  change ticket_total:\\n    set = 40\\n  change quote_revision:\\n    set = 0\\n'
      );
  }

  const v05 = next.includes('window "Workshop Desk" as main size 1080, 700:')'''

if studio.count(old_guard) != 1:
    raise SystemExit(f'web/studio-dom-sync.js: expected old v0.6 early-return guard once, got {studio.count(old_guard)}')
studio = studio.replace(old_guard, new_guard, 1)
studio_path.write_text(studio, encoding='utf-8')

# Add a regression fixture that deliberately reconstructs the exact v0.6 shape
# from the canonical v0.7 example. The upgrader must converge it byte-for-byte.
test_path = Path('tests/workshop-desk.test.js')
test_text = test_path.read_text(encoding='utf-8')
anchor = '''function normalizeRetainedSampleSpacing(source) {
  return String(source).replace(
    '  statusbar "{status}" as desk_status at 0, 692 size 1080, 28\\nwindow "Workshop settings"',
    '  statusbar "{status}" as desk_status at 0, 692 size 1080, 28\\n\\nwindow "Workshop settings"'
  );
}
'''
fixture = r'''
function workshopV06Fixture() {
  return example
    .replace(
      'create number ticket_total = 40\ncreate number base_rate = 25\ncreate number inspection_fee = 15\ncreate number rush_fee = 20\ncreate number quote_revision = 0',
      'create number ticket_total = 40'
    )
    .replace(
      '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 750, 18 size 300, 28',
      '  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28'
    )
    .replace(
      '  text "Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24',
      '  text "Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component." at 24, 640 size 1016, 24'
    )
    .replace(
      '      text "It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring."',
      '      text "It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring."'
    )
    .replace(
      '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\n    text "Quote revision {quote_revision}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
      '  panel as runtime_panel at 326, 172 size 280, 170:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
    )
    .replace(
      '      text "Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10."',
      '      text "Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface."'
    )
    .replace('    node "Registry 0.10 native subset"', '    node "Registry 0.9"')
    .replace(
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Base rate and inspection added"',
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Quote increased by 25"'
    )
    .replace(
      'when details_quote clicked:\n  change ticket_total:\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection fee added to quote"',
      'when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection added to quote"'
    )
    .replace(
      '    set = "Current Ready Component Registry 0.10 subset opened"',
      '    set = "Complete Component Registry 0.9 gallery opened"'
    )
    .replace(
      '  change ticket_total:\n    set = 40\n  change quote_revision:\n    set = 0\n',
      '  change ticket_total:\n    set = 40\n'
    );
}

test('Workshop Desk upgrades cached canonical v0.6 projects to v0.7', () => {
  const v06 = workshopV06Fixture();
  assert.match(v06, /Component Registry 0\.9/);
  assert.doesNotMatch(v06, /quote_revision/);
  assert.equal(upgradeWorkshopDeskSource(v06), example);
});
'''.lstrip('\n')
if test_text.count(anchor) != 1:
    raise SystemExit(f'tests/workshop-desk.test.js: expected spacing helper anchor once, got {test_text.count(anchor)}')
test_text = test_text.replace(anchor, anchor + '\n' + fixture, 1)
test_path.write_text(test_text, encoding='utf-8')

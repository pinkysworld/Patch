from pathlib import Path

studio_path = Path('web/studio-dom-sync.js')
studio = studio_path.read_text(encoding='utf-8')

old_comment = ''' * owns the current source. User-authored projects are not rewritten by this
 * helper unless they still match the known Workshop v0.5 signature.
 */'''
new_comment = ''' * owns the current source. User-authored projects are not rewritten by this
 * helper unless they still match a known canonical Workshop v0.5 or v0.6 signature.
 */'''
if studio.count(old_comment) != 1:
    raise SystemExit(f'expected Workshop upgrade comment once, got {studio.count(old_comment)}')
studio = studio.replace(old_comment, new_comment, 1)

old_signature = '''  const v06 = next.includes('window "Workshop Desk" as main size 1080, 720:')
    && next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented')
    && next.includes('Current desktop Ready runtime contract: v1.10.')
    && !next.includes('create number quote_revision = 0');'''
new_signature = '''  const v06 = next.includes('window "Workshop Desk" as main size 1080, 720:')
    && next.includes('window "Component Gallery" as components size 900, 640:')
    && next.includes('Seven-Form RAD showcase · every Component Registry 0.9 control is represented')
    && next.includes('Current desktop Ready runtime contract: v1.10.')
    && next.includes('when quote_button clicked:\\n  change ticket_total:\\n    add 25\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Quote increased by 25"')
    && next.includes('when details_quote clicked:\\n  change ticket_total:\\n    add 10\\n  change ticket_state:\\n    set = "Quoted"\\n  change status:\\n    set = "Inspection added to quote"')
    && next.includes('set = "Complete Component Registry 0.9 gallery opened"')
    && !next.includes('create number quote_revision = 0');'''
if studio.count(old_signature) != 1:
    raise SystemExit(f'expected v0.6 signature block once, got {studio.count(old_signature)}')
studio = studio.replace(old_signature, new_signature, 1)
studio_path.write_text(studio, encoding='utf-8')

test_path = Path('tests/workshop-desk.test.js')
test_text = test_path.read_text(encoding='utf-8')
anchor = '''test('Workshop Desk upgrades cached canonical v0.6 projects to v0.7', () => {
  const v06 = workshopV06Fixture();
  assert.match(v06, /Component Registry 0\\.9/);
  assert.doesNotMatch(v06, /quote_revision/);
  assert.equal(upgradeWorkshopDeskSource(v06), example);
});
'''
extra = '''\ntest('Workshop Desk leaves user-modified v0.6 projects untouched', () => {
  const customized = workshopV06Fixture().replace(
    '    set = "Quote increased by 25"',
    '    set = "Custom quote workflow"'
  );
  assert.match(customized, /Custom quote workflow/);
  assert.equal(upgradeWorkshopDeskSource(customized), customized);
});
'''
if test_text.count(anchor) != 1:
    raise SystemExit(f'expected canonical v0.6 migration test once, got {test_text.count(anchor)}')
test_text = test_text.replace(anchor, anchor + extra, 1)
test_path.write_text(test_text, encoding='utf-8')

from pathlib import Path

# One-shot preflight: reshape the temporary harness before the verified product patch.
fixer = Path('scripts/assistant-timepicker-harness-fix.py')
text = fixer.read_text()
start_marker = "rewrite(\n    'web/studio-dom-sync.js',\n    '  panel as runtime_panel at 326, 172 size 280, 170:"
start = text.find(start_marker)
if start < 0:
    raise SystemExit('prefix: missing direct runtime_panel rewrite in fixer')
end_marker = "rewrite('web/studio-dom-sync.js', 'Seven-Form RAD showcase"
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('prefix: missing post-runtime_panel fixer anchor')
text = text[:start] + text[end:]
fixer.write_text(text)

# The details form comes from the retained v0.5 source rather than WORKSHOP_MAIN_V06,
# so migrate it in upgradeWorkshopDeskSource instead of trying to edit the main template.
path = Path('web/studio-dom-sync.js')
studio = path.read_text()
anchor = "  if (!next.includes('window \"Component Gallery\" as components size 900, 640:')) {"
if studio.count(anchor) != 1:
    raise SystemExit(f'prefix: expected one gallery insertion anchor, got {studio.count(anchor)}')
upgrade = '''  next = next.replace(
    '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
    '  panel as runtime_panel at 326, 172 size 280, 170:\\n    text "Native runtime pulse {heartbeat}"\\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\\n    text "Quote revision {quote_revision}"\\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
  );

'''
studio = studio.replace(anchor, upgrade + anchor, 1)
path.write_text(studio)

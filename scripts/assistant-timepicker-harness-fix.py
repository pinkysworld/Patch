from pathlib import Path
import subprocess

# Reuse the last preflight revision that already reached the targeted suite
# successfully. Keeping this bootstrap tiny avoids another quoting drift in the
# temporary harness itself.
KNOWN_GOOD = '8dd344a4c1ba48ed18ee9fe47f22ce809eafe87b'
source = subprocess.check_output(
    ['git', 'show', f'{KNOWN_GOOD}:scripts/assistant-timepicker-harness-fix.py'],
    text=True,
)
exec(compile(source, 'assistant-timepicker-harness-fix@known-good', 'exec'), {'__name__': '__main__'})

# The known-good preflight deliberately generated a Markdown checkbox regex.
# Replace that whole generator block with a literal includes() assertion so
# JavaScript RegExp escaping cannot change its meaning.
path = Path('scripts/assistant-timepicker-showcase-polish.mjs')
text = path.read_text()
start_marker = "replaceOnce('tests/docs-current-studio-surface.test.js'"
end_marker = "\nreplaceOnce('tests/studio-authoring-surface.test.js'"
start = text.index(start_marker)
end = text.index(end_marker, start)
replacement = '''replaceOnce('tests/docs-current-studio-surface.test.js', '  assert.match(roadmap, /DatePicker as `# @input-mode date`/);\\n  assert.match(roadmap, /TimePicker and Calendar/);', '  assert.match(roadmap, /DatePicker as `# @input-mode date`/);\\n  assert.match(roadmap, /TimePicker as `# @input-mode time`/);\\n  assert.equal(roadmap.includes("- [ ] Calendar"), true);');'''
path.write_text(text[:start] + replacement + text[end:])

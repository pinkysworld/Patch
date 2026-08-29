from pathlib import Path

# Triggered only on the dedicated hotfix branch; removes itself after a verified transformation.
pages_path = Path('.github/workflows/pages.yml')
pages = pages_path.read_text()

old = '''            grep -F 'viewBox="0 0 32 32"' "$index_file" >/dev/null
            grep -F 'M8 6H22V18H13V26H8ZM13 10H18V14H13Z' "$index_file" >/dev/null
            if grep -F 'shape-rendering="crispEdges"' "$index_file" >/dev/null; then
              echo "${label} still exposes the retired crisp Patch brand mark." >&2
              exit 1
            fi
'''
new = '''            grep -F 'data-patch-brand-mark="compiler-p-v1"' "$index_file" >/dev/null
            grep -F "./icon.svg?v=${revision}" "$index_file" >/dev/null
            if grep -F 'M8 6H22V18H13V26H8ZM13 10H18V14H13Z' "$index_file" >/dev/null || grep -F 'shape-rendering="crispEdges"' "$index_file" >/dev/null; then
              echo "${label} still exposes a retired Patch brand mark." >&2
              exit 1
            fi
'''
if old not in pages:
    raise SystemExit('old Pages branding smoke block not found')
pages = pages.replace(old, new, 1)

old_assets = '''              studio-command-palette.css
              playground.js
'''
new_assets = '''              studio-command-palette.css
              icon.svg
              playground.js
'''
if old_assets not in pages:
    raise SystemExit('Pages asset list anchor not found')
pages = pages.replace(old_assets, new_assets, 1)

old_tail = '''            fetch_asset "${base}playground.js?v=${revision}&smoke=${cache_bust}" /tmp/patch-pages-playground
            grep -F "./src/compiler.js?v=${revision}" /tmp/patch-pages-playground >/dev/null
'''
new_tail = '''            fetch_asset "${base}icon.svg?v=${revision}&smoke=${cache_bust}" /tmp/patch-pages-icon
            grep -F 'viewBox="0 0 512 512"' /tmp/patch-pages-icon >/dev/null
            grep -F 'aria-label="Patch Studio compiler mark"' /tmp/patch-pages-icon >/dev/null
            grep -F 'id="patch-circuit-cuts"' /tmp/patch-pages-icon >/dev/null
            if grep -F 'M8 6H22V18H13V26H8ZM13 10H18V14H13Z' /tmp/patch-pages-icon >/dev/null; then
              echo "${label} icon still contains the retired inline Patch P geometry." >&2
              exit 1
            fi
            fetch_asset "${base}playground.js?v=${revision}&smoke=${cache_bust}" /tmp/patch-pages-playground
            grep -F "./src/compiler.js?v=${revision}" /tmp/patch-pages-playground >/dev/null
'''
if old_tail not in pages:
    raise SystemExit('Pages playground verification anchor not found')
pages = pages.replace(old_tail, new_tail, 1)
pages_path.write_text(pages)

test_path = Path('tests/studio-branding.test.js')
tests = test_path.read_text()
marker = "test('Pages live smoke verifies the shared compiler brand asset'"
if marker not in tests:
    tests += '''\n\ntest('Pages live smoke verifies the shared compiler brand asset', () => {\n  const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');\n  assert.match(pages, /data-patch-brand-mark=\\\"compiler-p-v1\\\"/);\n  assert.match(pages, /\\.\\/icon\\.svg\\?v=\\$\\{revision\\}/);\n  assert.match(pages, /Patch Studio compiler mark/);\n  assert.match(pages, /patch-circuit-cuts/);\n  assert.doesNotMatch(pages, /grep -F 'viewBox=\\\"0 0 32 32\\\"' \\"\\$index_file\\"/);\n});\n'''
    test_path.write_text(tests)

Path('.github/workflows/pages-brand-smoke-hotfix.yml').unlink(missing_ok=True)
Path('.github/scripts/pages_brand_smoke_hotfix.py').unlink(missing_ok=True)

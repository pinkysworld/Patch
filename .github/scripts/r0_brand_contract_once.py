from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one guarded match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))


# Public site validator: the shared icon asset is now the brand contract.
replace_once(
    'scripts/check-site.js',
    "  '_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',",
    "  '_site/style.css','_site/icon.svg','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',"
)
replace_once(
    'scripts/check-site.js',
    "  'IR 1.7 / v1.8','id=\"editorTabs\"','id=\"editorParseStatus\"','id=\"openCommandPalette\"',\n  'viewBox=\"0 0 32 32\"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'",
    "  'IR 1.7 / v1.8','id=\"editorTabs\"','id=\"editorParseStatus\"','id=\"openCommandPalette\"',\n  'class=\"brand-mark\" src=\"./icon.svg?v=','data-patch-brand-mark=\"compiler-p-v1\"'"
)
replace_once(
    'scripts/check-site.js',
    "  'multi-file project bundle v3','Ready IR 1.3 / v1.4','current runtime v1.4 templates','shape-rendering=\"crispEdges\"','M3 2H18V12H8V20H3ZM8 6H13V8H8Z','./paper.html'",
    "  'multi-file project bundle v3','Ready IR 1.3 / v1.4','current runtime v1.4 templates','shape-rendering=\"crispEdges\"','M3 2H18V12H8V20H3ZM8 6H13V8H8Z','M8 6H22V18H13V26H8ZM13 10H18V14H13Z','./paper.html'"
)
replace_once(
    'scripts/check-site.js',
    "const current = read('_site/src/native-current-contract.js');",
    "const brandIcon = read('_site/icon.svg');\nrequireAll('Patch Studio compiler brand asset', brandIcon, ['Patch Studio compiler mark','patch-circuit-cuts','patch-main','patch-accent']);\n\nconst current = read('_site/src/native-current-contract.js');"
)

# beta36 gate follows the same asset-based identity and expanded showcase.
replace_once(
    'scripts/check-site-beta36.js',
    "  'value=\"workshopDesk\">Workshop desk</option>','viewBox=\"0 0 32 32\"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'",
    "  'value=\"workshopDesk\">Workshop desk</option>','value=\"counterWindow\" selected>Window app</option>',\n  'class=\"brand-mark\" src=\"./icon.svg?v=','data-patch-brand-mark=\"compiler-p-v1\"'"
)
replace_once(
    'scripts/check-site-beta36.js',
    "  'data-patch-version=\"0.2.0-beta.35\"','Ready IR 1.3 / v1.4','viewBox=\"0 0 22 22\"','shape-rendering=\"crispEdges\"'",
    "  'data-patch-version=\"0.2.0-beta.35\"','Ready IR 1.3 / v1.4','viewBox=\"0 0 22 22\"','shape-rendering=\"crispEdges\"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'"
)
replace_once(
    'scripts/check-site-beta36.js',
    "  'window \"Job details\" as details',\"sample.value === 'workshopDesk'\",\"loadButton.textContent = 'Load example'\",\n  'queueMicrotask(loadSelectedSample)'",
    "  'window \"Job details\" as details','window \"Inventory Center\" as inventory',\n  'window \"Customer Profile\" as customer_profile','window \"Workshop Diagnostics\" as diagnostics',\n  \"sample.value === 'workshopDesk'\",\"loadButton.textContent = 'Load example'\""
)
replace_once(
    'scripts/check-site-beta36.js',
    "const sw = read('_site/sw.js');",
    "const sw = read('_site/sw.js');\nconst brandIcon = read('_site/icon.svg');"
)
replace_once(
    'scripts/check-site-beta36.js',
    "rejectAll('beta36 Workshop Desk loader', workshop, ['window \"Harbor Desk\"']);",
    "rejectAll('beta36 Workshop Desk loader', workshop, ['window \"Harbor Desk\"']);\nrequireAll('beta36 compiler brand asset', brandIcon, ['Patch Studio compiler mark','patch-circuit-cuts','patch-main','patch-accent']);"
)

# The site builder no longer synthesizes brand geometry. icon.svg is already a
# versioned static asset in the generated closure.
replace_once(
    'scripts/build-site.js',
    "\n  if (name === 'index.html') {\n    html = html.replace(\n      '<svg viewBox=\"0 0 22 22\" focusable=\"false\" shape-rendering=\"crispEdges\"><path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M3 2H18V12H8V20H3ZM8 6H13V8H8Z\"/></svg>',\n      '<svg viewBox=\"0 0 32 32\" focusable=\"false\" aria-hidden=\"true\"><path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M8 6H22V18H13V26H8ZM13 10H18V14H13Z\"/></svg>'\n    );\n  }",
    ""
)

# Remove the retired CSS-drawn compatibility P. style.css owns the shared image.
replace_once(
    'web/beta35-studio.css',
    "\n/* The legacy SVG stays in the HTML for old cached-site compatibility, but the\n   visible Studio mark is drawn from two fully rounded CSS primitives. This\n   avoids the blocky/pixel P while keeping the badge compact and deterministic. */\n.brand-mark {\n  position: relative;\n  border-radius: 50%;\n}\n.brand-mark svg {\n  display: none;\n}\n.brand-mark::before,\n.brand-mark::after {\n  content: \"\";\n  position: absolute;\n  display: block;\n  pointer-events: none;\n}\n.brand-mark::before {\n  left: 7px;\n  top: 5px;\n  width: 5px;\n  height: 18px;\n  border-radius: 999px;\n  background: currentColor;\n}\n.brand-mark::after {\n  left: 10px;\n  top: 5px;\n  width: 11px;\n  height: 8px;\n  border: 4px solid currentColor;\n  border-left: 0;\n  border-radius: 0 999px 999px 0;\n}\n",
    "\n"
)

# Tests now assert one shared compiler/language brand instead of generated CSS geometry.
replace_once(
    'tests/studio-ide-chrome.test.js',
    "const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');",
    "const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');\nconst icon = fs.readFileSync('web/icon.svg', 'utf8');"
)
replace_once(
    'tests/studio-ide-chrome.test.js',
    "test('Studio brand renders a genuinely rounded P instead of the legacy angular SVG', () => {\n  const mark = html.match(/class=\"brand-mark\"[^>]*>([\\s\\S]*?)<\\/div>/)?.[1] || '';\n  assert.match(mark, /<svg viewBox=\"0 0 32 32\"/);\n  assert.match(mark, /M8 6H22V18H13V26H8ZM13 10H18V14H13Z/);\n  assert.match(beta35, /\\.brand-mark svg \\{[\\s\\S]*?display: none;/);\n  assert.match(beta35, /\\.brand-mark::before,[\\s\\S]*\\.brand-mark::after/);\n  assert.match(beta35, /border-radius: 999px/);\n  assert.match(beta35, /border-radius: 0 999px 999px 0/);\n  assert.match(beta35, /border-radius: 50%/);\n  assert.match(buildSite, /<svg viewBox=\"0 0 32 32\" focusable=\"false\" aria-hidden=\"true\">/);\n  assert.doesNotMatch(style, /rotate\\(/);\n  assert.doesNotMatch(refresh, /rotate\\(/);\n  assert.doesNotMatch(beta35, /rotate\\(/);\n});",
    "test('Studio brand uses one compiler-oriented SVG asset across the product shell', () => {\n  assert.match(html, /class=\"brand-mark\" src=\"\\.\\/icon\\.svg\"/);\n  assert.match(html, /data-patch-brand-mark=\"compiler-p-v1\"/);\n  assert.match(icon, /Patch Studio compiler mark/);\n  assert.match(icon, /patch-circuit-cuts/);\n  assert.match(icon, /patch-main/);\n  assert.match(icon, /patch-accent/);\n  assert.doesNotMatch(html, /M8 6H22V18H13V26H8/);\n  assert.doesNotMatch(beta35, /\\.brand-mark::before|\\.brand-mark::after|\\.brand-mark svg/);\n  assert.match(buildSite, /'manifest.webmanifest','icon.svg'/);\n  assert.doesNotMatch(buildSite, /M8 6H22V18H13V26H8/);\n  assert.doesNotMatch(style, /rotate\\(/);\n  assert.doesNotMatch(refresh, /rotate\\(/);\n  assert.doesNotMatch(beta35, /rotate\\(/);\n});"
)

replace_once(
    'tests/studio-designer-coordinator.test.js',
    "const siteCheck = fs.readFileSync('scripts/check-site.js', 'utf8');",
    "const siteCheck = fs.readFileSync('scripts/check-site.js', 'utf8');\nconst icon = fs.readFileSync('web/icon.svg', 'utf8');"
)
replace_once(
    'tests/studio-designer-coordinator.test.js',
    "test('rendered Patch brand keeps geometry at the site-build boundary and runtime only tags diagnostics', () => {\n  assert.match(workspace, /dataset\\.patchBrandMark/);\n  assert.doesNotMatch(workspace, /innerHTML\\s*=/);\n  assert.doesNotMatch(workspace, /shape-rendering=\\\"crispEdges\\\"/);\n  assert.match(buildSite, /viewBox=\\\"0 0 32 32\\\"/);\n  assert.match(buildSite, /M8 6H22V18H13V26H8ZM13 10H18V14H13Z/);\n  assert.match(siteCheck, /viewBox=\\\"0 0 32 32\\\"/);\n  assert.match(siteCheck, /shape-rendering=\\\"crispEdges\\\"/);\n});",
    "test('rendered Patch brand is a shared asset and runtime only tags diagnostics', () => {\n  assert.match(workspace, /dataset\\.patchBrandMark/);\n  assert.doesNotMatch(workspace, /innerHTML\\s*=/);\n  assert.doesNotMatch(workspace, /shape-rendering=\\\"crispEdges\\\"/);\n  assert.match(icon, /Patch Studio compiler mark/);\n  assert.match(icon, /patch-circuit-cuts/);\n  assert.match(buildSite, /'manifest.webmanifest','icon.svg'/);\n  assert.doesNotMatch(buildSite, /M8 6H22V18H13V26H8/);\n  assert.match(siteCheck, /compiler-p-v1/);\n  assert.match(siteCheck, /Patch Studio compiler brand asset/);\n  assert.match(siteCheck, /shape-rendering=\\\"crispEdges\\\"/);\n});"
)

# Pages smoke validates the deployed versioned icon, not retired inline geometry.
replace_once(
    '.github/workflows/pages.yml',
    "            grep -F 'viewBox=\"0 0 32 32\"' \"$index_file\" >/dev/null\n            grep -F 'M8 6H22V18H13V26H8ZM13 10H18V14H13Z' \"$index_file\" >/dev/null\n            if grep -F 'shape-rendering=\"crispEdges\"' \"$index_file\" >/dev/null; then\n              echo \"${label} still exposes the retired crisp Patch brand mark.\" >&2\n              exit 1\n            fi",
    "            grep -F 'data-patch-brand-mark=\"compiler-p-v1\"' \"$index_file\" >/dev/null\n            grep -F \"./icon.svg?v=${revision}\" \"$index_file\" >/dev/null\n            fetch_asset \"${base}icon.svg?v=${revision}&smoke=${cache_bust}\" /tmp/patch-pages-icon\n            grep -F 'Patch Studio compiler mark' /tmp/patch-pages-icon >/dev/null\n            grep -F 'patch-circuit-cuts' /tmp/patch-pages-icon >/dev/null\n            if grep -F 'M8 6H22V18H13V26H8ZM13 10H18V14H13Z' \"$index_file\" >/dev/null || grep -F 'shape-rendering=\"crispEdges\"' \"$index_file\" >/dev/null; then\n              echo \"${label} still exposes a retired inline Patch brand mark.\" >&2\n              exit 1\n            fi"
)
replace_once(
    '.github/workflows/pages.yml',
    "              site-navigation.css\n              site-refresh.css",
    "              icon.svg\n              site-navigation.css\n              site-refresh.css"
)

Path('.github/scripts/r0_brand_contract_once.py').unlink(missing_ok=True)

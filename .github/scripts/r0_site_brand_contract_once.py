from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one guarded match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'scripts/check-site.js',
    "  '_site/index.html','_site/language.html','_site/docs.html','_site/downloads.html','_site/help.html',\n  '_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',",
    "  '_site/index.html','_site/language.html','_site/docs.html','_site/downloads.html','_site/help.html',\n  '_site/icon.svg','_site/manifest.webmanifest','_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',"
)

replace_once(
    'scripts/check-site.js',
    "  'IR 1.7 / v1.8','id=\"editorTabs\"','id=\"editorParseStatus\"','id=\"openCommandPalette\"',\n  'viewBox=\"0 0 32 32\"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'",
    "  'IR 1.7 / v1.8','id=\"editorTabs\"','id=\"editorParseStatus\"','id=\"openCommandPalette\"',\n  'class=\"brand-mark\"','src=\"./icon.svg?v=','data-patch-brand-mark=\"compiler-p-v1\"'"
)

replace_once(
    'scripts/check-site.js',
    "  'multi-file project bundle v3','Ready IR 1.3 / v1.4','current runtime v1.4 templates','shape-rendering=\"crispEdges\"','M3 2H18V12H8V20H3ZM8 6H13V8H8Z','./paper.html'",
    "  'multi-file project bundle v3','Ready IR 1.3 / v1.4','current runtime v1.4 templates','shape-rendering=\"crispEdges\"','M3 2H18V12H8V20H3ZM8 6H13V8H8Z','M8 6H22V18H13V26H8ZM13 10H18V14H13Z','./paper.html'"
)

replace_once(
    'scripts/check-site-beta36.js',
    "  'value=\"workshopDesk\">Workshop desk</option>','viewBox=\"0 0 32 32\"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'",
    "  'value=\"workshopDesk\">Workshop desk</option>','class=\"brand-mark\"','src=\"./icon.svg?v=','data-patch-brand-mark=\"compiler-p-v1\"'"
)

replace_once(
    'scripts/check-site-beta36.js',
    "  'window \"Job details\" as details',\"sample.value === 'workshopDesk'\",\"loadButton.textContent = 'Load example'\",\n  'queueMicrotask(loadSelectedSample)'",
    "  'window \"Job details\" as details','window \"Inventory Center\" as inventory','window \"Customer Profile\" as customer_profile','window \"Workshop Diagnostics\" as diagnostics',\"sample.value === 'workshopDesk'\",\"loadButton.textContent = 'Load example'\",\n  \"loadButton?.addEventListener('click', loadSelectedSample)\""
)

replace_once(
    'scripts/check-site-beta36.js',
    "rejectAll('beta36 Workshop Desk loader', workshop, ['window \"Harbor Desk\"']);",
    "rejectAll('beta36 Workshop Desk loader', workshop, ['window \"Harbor Desk\"','queueMicrotask(loadSelectedSample)']);"
)

replace_once(
    'tests/beta35-studio-surface.test.js',
    "test('selected examples can be explicitly reloaded and fresh Studio opens Workshop Desk', () => {\n  for (const marker of [\n    \"loadButton.id = 'loadSample'\",\n    \"loadButton.textContent = 'Load example'\",\n    \"sample.dispatchEvent(new Event('change', { bubbles: true }))\",\n    \"localStorage.getItem('patchStudio.project')\",\n    \"sample.value === 'workshopDesk'\",\n    'queueMicrotask(loadSelectedSample)'\n  ]) assert.ok(moduleSource.includes(marker), marker);\n});",
    "test('selected examples reload explicitly while fresh Studio keeps the lightweight Window sample', () => {\n  for (const marker of [\n    \"loadButton.id = 'loadSample'\",\n    \"loadButton.textContent = 'Load example'\",\n    \"sample.dispatchEvent(new Event('change', { bubbles: true }))\",\n    \"sample.value === 'workshopDesk'\",\n    \"loadButton?.addEventListener('click', loadSelectedSample)\"\n  ]) assert.ok(moduleSource.includes(marker), marker);\n  assert.match(index, /<option value=\"counterWindow\" selected>Window app<\\/option>/);\n  assert.doesNotMatch(moduleSource, /queueMicrotask\\(loadSelectedSample\\)/);\n});"
)

Path('.github/scripts/r0_site_brand_contract_once.py').unlink(missing_ok=True)

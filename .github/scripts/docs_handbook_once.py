from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    'scripts/build-site.js',
    "const SITE_HTML_FILES = ['index.html','language.html','docs.html','help.html'];",
    "const SITE_HTML_FILES = ['index.html','language.html','docs.html','tutorials.html','examples.html','help.html'];",
)
replace_once(
    'scripts/build-site.js',
    "'style.css','site-navigation.css','site-refresh.css','site-pages.css','studio-accessibility.css'",
    "'style.css','site-navigation.css','site-refresh.css','site-pages.css','docs-handbook.css','studio-accessibility.css'",
)

replace_once(
    'web/sw.js',
    "'./', './index.html', './language.html', './docs.html', './downloads.html', './help.html',",
    "'./', './index.html', './language.html', './docs.html', './tutorials.html', './examples.html', './downloads.html', './help.html',",
)
replace_once(
    'web/sw.js',
    "'./style.css', './site-navigation.css', './site-refresh.css', './site-pages.css', './studio-accessibility.css'",
    "'./style.css', './site-navigation.css', './site-refresh.css', './site-pages.css', './docs-handbook.css', './studio-accessibility.css'",
)

replace_once(
    'web/docs.html',
    '  <link rel="stylesheet" href="./site-pages.css">\n',
    '  <link rel="stylesheet" href="./site-pages.css">\n  <link rel="stylesheet" href="./docs-handbook.css">\n',
)
replace_once(
    'web/docs.html',
    '<main class="content-page" data-patch-version="0.2.0-beta.36">\n  <section class="page-hero">',
    '<main class="content-page" data-patch-version="0.2.0-beta.36">\n  <nav class="handbook-tabs" aria-label="Patch handbook">\n    <a href="./docs.html" aria-current="page">Overview</a><a href="./tutorials.html">Tutorials</a><a href="./examples.html">Examples</a><a href="./language.html">Language reference</a><a href="./downloads.html">Build &amp; downloads</a>\n  </nav>\n  <section class="page-hero">',
)
replace_once(
    'web/docs.html',
    '<p class="docs-note"><strong>License:</strong> Patch already uses the permissive MIT License. You may use, modify, distribute, sublicense and sell copies as long as the copyright and permission notice are retained.</p>',
    '<p class="docs-note"><strong>License:</strong> Patch is MIT-licensed. Copyright (c) 2026 Michel Nguyen. You may use, modify, distribute, sublicense and sell copies as long as the copyright and permission notice are retained.</p>',
)
replace_once(
    'web/docs.html',
    '<h2>Tutorials</h2>\n    <p>These tutorials use syntax that is exercised by the repository test suite and current examples.</p>',
    '<h2>Tutorials</h2>\n    <p>These tutorials use syntax that is exercised by the repository test suite and current examples. For the full step-by-step handbook, open the dedicated <a href="./tutorials.html"><strong>Tutorials page</strong></a>; for a browsable program library, use <a href="./examples.html"><strong>Examples</strong></a>.</p>',
)

replace_once(
    'tests/site-navigation.test.js',
    "test('public Patch Studio build exposes five product pages and keeps the research paper repository-only', () => {",
    "test('public Patch Studio keeps five primary product pages and packages handbook subpages', () => {",
)
replace_once(
    'tests/site-navigation.test.js',
    "assert.match(buildSite, /const SITE_HTML_FILES = \\['index\\.html','language\\.html','docs\\.html','help\\.html'\\]/);",
    "assert.match(buildSite, /const SITE_HTML_FILES = \\['index\\.html','language\\.html','docs\\.html','tutorials\\.html','examples\\.html','help\\.html'\\]/);",
)

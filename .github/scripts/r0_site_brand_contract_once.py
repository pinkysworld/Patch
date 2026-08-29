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

Path('.github/scripts/r0_site_brand_contract_once.py').unlink(missing_ok=True)

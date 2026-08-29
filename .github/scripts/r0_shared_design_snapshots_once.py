from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one guarded match, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_all_exact(path, old, new, expected):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} exact matches, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new))


# Primary Designer uses the shared singleton service instead of a private cache.
replace_once(
    'web/playground.js',
    "import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';",
    "import { getStudioDesignSnapshot } from './studio-design-snapshots.js';",
)
replace_once(
    'web/playground.js',
    "const designerDesignCache = createStudioDesignSnapshotCache();\n",
    "",
)
replace_once(
    'web/playground.js',
    "    const preview = designerDesignCache.get(code.value);",
    "    const preview = getStudioDesignSnapshot(code.value);",
)

# StatusBar shares both declaration-only UI snapshots and descriptor revisions.
replace_once(
    'web/designer-statusbar.js',
    "import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';\n",
    "",
)
replace_once(
    'web/designer-statusbar.js',
    "import { listDesignerControls, updateDesignerControl } from '../src/designer.js';",
    "import { listDesignerControls, updateDesignerControl } from '../src/designer.js';\nimport { getStudioDesignerControls, getStudioDesignSnapshot } from './studio-design-snapshots.js';",
)
replace_once(
    'web/designer-statusbar.js',
    "const statusBarDesignCache = createStudioDesignSnapshotCache();\n",
    "",
)
replace_once(
    'web/designer-statusbar.js',
    "    cachedControls = listDesignerControls(source);",
    "    cachedControls = getStudioDesignerControls(source);",
)
replace_once(
    'web/designer-statusbar.js',
    "    cachedUi = statusBarDesignCache.get(source).ui ?? [];",
    "    cachedUi = getStudioDesignSnapshot(source).ui ?? [];",
)

# Steady-state Form/geometry reads share one descriptor revision. Mutation helpers
# still call the canonical designer readers on their newly generated source.
replace_once(
    'web/forms-designer.js',
    "import { formControlDefaultSize } from '../src/form-layout.js';",
    "import { formControlDefaultSize } from '../src/form-layout.js';\nimport { getStudioDesignerControls, getStudioDesignerWindows } from './studio-design-snapshots.js';",
)
replace_all_exact(
    'web/forms-designer.js',
    "const windows = listDesignerWindows(code.value);",
    "const windows = getStudioDesignerWindows(code.value);",
    3,
)
replace_all_exact(
    'web/forms-designer.js',
    "const controls = listDesignerControls(code.value);",
    "const controls = getStudioDesignerControls(code.value);",
    2,
)
replace_once(
    'web/forms-designer.js',
    "const control = listDesignerControls(code.value).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);",
    "const control = getStudioDesignerControls(code.value).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);",
)

# Hosted and Offline Studio must package the shared browser singleton.
replace_once(
    'scripts/build-site.js',
    "  'playground.js','forms-designer.js'",
    "  'playground.js','studio-design-snapshots.js','forms-designer.js'",
)
replace_once(
    'web/sw.js',
    "  './playground.js', './beta35-studio.js'",
    "  './playground.js', './studio-design-snapshots.js', './beta35-studio.js'",
)

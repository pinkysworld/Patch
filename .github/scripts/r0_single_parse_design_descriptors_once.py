from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one guarded match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Keep the canonical source-reader API, but expose the exact same descriptor
# extraction over an already parsed AST so shared design-time readers do not
# parse the same source revision again.
replace_once(
    'src/designer.js',
    "export function listDesignerWindows(source) {\n  const ast = parse(source);\n  const windows = [];",
    "export function listDesignerWindows(source) {\n  return listDesignerWindowsFromAst(parse(source));\n}\n\nexport function listDesignerWindowsFromAst(ast) {\n  if (!Array.isArray(ast)) throw new TypeError('Designer AST must be an array.');\n  const windows = [];",
)
replace_once(
    'src/designer.js',
    "export function listDesignerControls(source) {\n  const ast = parse(source);\n  const controls = [];",
    "export function listDesignerControls(source) {\n  return listDesignerControlsFromAst(parse(source));\n}\n\nexport function listDesignerControlsFromAst(ast) {\n  if (!Array.isArray(ast)) throw new TypeError('Designer AST must be an array.');\n  const controls = [];",
)

# The shared browser service already owns the declaration-only design snapshot.
# Reuse that snapshot's AST for first-read Window/control descriptors instead of
# invoking the source readers, each of which would parse again.
replace_once(
    'web/studio-design-snapshots.js',
    "import { listDesignerControls, listDesignerWindows } from '../src/designer.js';",
    "import { listDesignerControlsFromAst, listDesignerWindowsFromAst } from '../src/designer.js';",
)
replace_once(
    'web/studio-design-snapshots.js',
    "  descriptorMisses += 1;\n  const snapshot = Object.freeze({\n    windows: freezeDescriptors(listDesignerWindows(key)),\n    controls: freezeDescriptors(listDesignerControls(key))\n  });",
    "  descriptorMisses += 1;\n  const design = getStudioDesignSnapshot(key);\n  const snapshot = Object.freeze({\n    windows: freezeDescriptors(listDesignerWindowsFromAst(design.ast)),\n    controls: freezeDescriptors(listDesignerControlsFromAst(design.ast))\n  });",
)
replace_once(
    'web/studio-design-snapshots.js',
    " * Descriptor extraction still delegates to the canonical src/designer.js\n * readers; a later R0 slice can derive those descriptors directly from the\n * already parsed design AST without changing this public service contract.",
    " * Descriptor extraction delegates to the canonical AST readers in\n * src/designer.js and reuses the declaration-only design snapshot AST, so the\n * first descriptor read does not parse the same source revision again.",
)

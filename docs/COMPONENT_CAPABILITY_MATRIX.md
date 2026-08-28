# Component capability matrix

Generated from `src/component-registry.js` registry **0.8**. Do not edit the table by hand; run `node scripts/generate-component-matrix.js`.

Current product contract: Change IR **0.10**, Native GUI IR **1.4**, sealed payload **v14**, runtime **v1.5** (`native-gui-1.4/payload-14/runtime-1.5`).

Status values come from the canonical Designer registry:

- `supported` — implemented and claimed for that target
- `authoring` — Patch Studio can create/edit the control; runtime support is not claimed
- `unsupported` — the target must fail closed

Studio authoring is not native or Web runtime parity. A blank runtime claim is a defect.

| Type | Label | Category | Kind | Studio | Web | Windows | macOS | Linux | FreeBSD | Properties | Events |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `text` | Text | Basic | visual | supported | supported | supported | supported | supported | unsupported | textExpr, x, y, width, height | — |
| `button` | Button | Basic | visual | supported | supported | supported | supported | supported | unsupported | id, textExpr, x, y, width, height | clicked |
| `input` | Input | Basic | visual | supported | supported | supported | supported | supported | unsupported | id, x, y, width, height | changed |
| `checkbox` | Checkbox | Basic | visual | supported | supported | supported | supported | supported | unsupported | id, textExpr, x, y, width, height | changed |
| `radio` | Radio group | Choices | visual | supported | supported | supported | supported | supported | unsupported | id, options, x, y, width, height | changed |
| `combo` | ComboBox | Choices | visual | supported | supported | supported | supported | supported | unsupported | id, options, x, y, width, height | changed |
| `listbox` | ListBox | Choices | visual | supported | supported | supported | supported | supported | unsupported | id, options, x, y, width, height | changed |
| `slider` | Slider | Choices | visual | supported | supported | supported | supported | supported | unsupported | id, min, max, step, x, y, width, height | changed |
| `table` | Table | Data | visual | supported | supported | supported | supported | supported | unsupported | id, columns, rows, x, y, width, height | changed |
| `tree` | TreeView | Data | visual | supported | supported | supported | supported | supported | unsupported | id, treeNodes, x, y, width, height | changed |
| `tabs` | Tabs | Containers | visual | supported | supported | supported | supported | supported | unsupported | id, pages, x, y, width, height | — |
| `panel` | Panel | Containers | visual | supported | supported | supported | supported | supported | unsupported | id, children, x, y, width, height | — |
| `picture` | Picture | Graphics | visual | supported | supported | supported | supported | supported | unsupported | id, sourceExpr, x, y, width, height | clicked |
| `shape` | Shape | Graphics | visual | authoring | supported | unsupported | unsupported | unsupported | unsupported | id, shapeKind, fill, stroke, strokeWidth, cornerRadius, opacity, x, y, width, height | — |
| `paintbox` | PaintBox | Graphics | visual | authoring | supported | unsupported | unsupported | unsupported | unsupported | id, x, y, width, height | paint |
| `statusbar` | StatusBar | Chrome | visual | supported | supported | supported | supported | supported | unsupported | id, textExpr, x, y, width, height | — |
| `timer` | Timer | Nonvisual | nonvisual | supported | supported | supported | supported | supported | unsupported | id, interval | ticked |
| `imagelist` | ImageList | Nonvisual | nonvisual | authoring | unsupported | unsupported | unsupported | unsupported | unsupported | id, logicalWidth, logicalHeight, items | — |

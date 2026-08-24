# Native TreeView

TreeView entered the native line as Native GUI IR **1.2** / payload **v12** / runtime **v1.3**. That line remains the **frozen** TreeView compatibility contract and is Slider fail-closed.

Current Ready/offline Windows, macOS and Linux use Native GUI IR **1.3** / payload **v13** / runtime **v1.4**, which preserves this TreeView ABI and adds Slider. Product import is `src/native-current-contract.js`. Frozen import is `src/native-frozen-contract.js`.

## Frozen TreeView contract

- Native GUI IR **1.2** adds `tree` controls with recursive source-backed nodes.
- Win32, AppKit and GTK direct-AOT backends **1.3** consume that frozen contract.
- sealed payload **v12** / native runtime **v1.3** carries the same TreeView contract for the frozen Ready/offline compatibility line.
- `changed` exposes the selected node as the full root-to-node **text-list path**.
- Toolkit selection is transient. Persistent Patch state changes only through explicit semantic `change` operations.
- Scalar state interpolation in node text templates is projected into native labels during `RefreshUI`; list-state interpolation fails closed.
- Backend compatibility shadows are private implementation details and are removed from generated native source before it is returned.

## Platform widgets

| Platform | Native widget |
| --- | --- |
| Windows | Win32 common-controls `WC_TREEVIEWW` |
| macOS | AppKit `NSOutlineView` |
| Linux | GTK3 `GtkTreeView` + `GtkTreeStore` |

The direct build planner automatically selects the current Slider-capable tier when Patch source contains a TreeView on the Ready path, and the frozen `tree-v13` tier when an explicit frozen TreeView contract is requested. Existing Native GUI IR <= 1.1 and direct backend <= 1.2 contracts remain frozen historical evidence.

## Example

`examples/treeview-window.patch` exercises hierarchy, scalar source-backed labels and explicit persistence of the selected path.

```patch
create list selected = []

window "Files" as main size 560, 380:
  tree as files at 24, 56 size 300, 240:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "README.md"

when files changed:
  change selected:
    set = value
```

Selecting `compiler.js` exposes `['src', 'compiler.js']` as transient event-local `value`. Persistent `selected` changes only because the handler explicitly executes `change selected`.

## Sealed Ready/offline boundary

TreeView is the additive feature that advanced the sealed contract from the frozen payload v11/runtime v1.2 Menu+list line to **payload v12/runtime v1.3**. That v12/v1.3 line is now frozen. Current Ready/offline uses **payload v13/runtime v1.4** and does not reinterpret v12.

Frozen TreeView runtime release tags remain:

- `native-win32-runtime-v1.3`;
- `native-macos-runtime-v1.3`;
- `native-linux-runtime-v1.3`.

Current Ready runtime release tags are:

- `native-win32-runtime-v1.4`;
- `native-macos-runtime-v1.4`;
- `native-linux-runtime-v1.4`.

The dedicated **Patch Native Sealed TreeView Runtime v1.3** workflow builds each runtime from source, seals the canonical TreeView example as payload v12 and executes the finished application on Windows, macOS and Linux. Only successful `main` runs publish those frozen runtime assets.

Patch Studio's no-token Window path lowers current Native GUI IR 1.3 in the browser and seals it into verified v1.4 runtime templates. The frozen TreeView path still lowers Native GUI IR 1.2 into the v1.3 templates. Pages waits for the current runtime assets, validates their GitHub-recorded SHA-256 digests and publishes the runtime integrity manifest before deploying a browser compiler that consumes payload v13.

The downloadable offline compiler independently embeds/builds runtime v1.4 by default and smoke-tests responsive Window, Table, multi-select ListBox, Menu, TreeView and Slider applications on its supported desktop hosts. Frozen v1.3 remains available as an explicit compatibility line.

## Compatibility

The sealed desktop progression remains explicit:

- payload v9/runtime v1.0: frozen Table line;
- payload v10/runtime v1.1: frozen persistent-list/multi-select line;
- payload v11/runtime v1.2: frozen Menu+list line;
- payload v12/runtime v1.3: frozen TreeView-capable line, Slider fail-closed;
- payload v13/runtime v1.4: current Ready/offline line with TreeView and Slider.

Explicit legacy linking fails closed when TreeView is requested on a payload version that predates v12, and when Slider is requested on the frozen v12/v1.3 line. FreeBSD native GUI remains unsupported.

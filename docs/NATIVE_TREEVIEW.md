# Native TreeView v1.3

Patch TreeView support is a versioned extension of the Stage 1 browser contract and is now available across browser, direct-native AOT and token-free Ready/offline Windows, macOS and Linux paths.

## Contract

- Native GUI IR **1.2** adds `tree` controls with recursive source-backed nodes.
- Win32, AppKit and GTK direct-AOT backends **1.3** consume that contract.
- sealed payload **v12** / native runtime **v1.3** carries the same TreeView contract for token-free Ready/offline desktop builds.
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

The direct build planner automatically selects the `tree-v13` tier when Patch source contains a TreeView. Existing Native GUI IR <= 1.1 and direct backend <= 1.2 contracts remain frozen.

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

TreeView is the additive feature that advances the current sealed contract from the frozen payload v11/runtime v1.2 Menu+list line to **payload v12/runtime v1.3**. v11 is not repurposed or reinterpreted.

Current Ready runtime release tags are:

- `native-win32-runtime-v1.3`;
- `native-macos-runtime-v1.3`;
- `native-linux-runtime-v1.3`.

The dedicated **Patch Native Sealed TreeView Runtime v1.3** workflow builds each runtime from source, seals the canonical TreeView example as payload v12 and executes the finished application on Windows, macOS and Linux. Only successful `main` runs publish the current runtime assets.

Patch Studio's no-token Window path lowers Native GUI IR 1.2 in the browser and seals it into those verified v1.3 runtime templates. Pages waits for all three release assets, validates their GitHub-recorded SHA-256 digests and publishes the runtime integrity manifest before deploying a browser compiler that consumes payload v12.

The downloadable offline compiler independently embeds/builds runtime v1.3 and smoke-tests responsive Window, Table, multi-select ListBox, Menu and TreeView applications on its supported desktop hosts.

## Compatibility

The sealed desktop progression remains explicit:

- payload v9/runtime v1.0: frozen Table line;
- payload v10/runtime v1.1: frozen persistent-list/multi-select line;
- payload v11/runtime v1.2: frozen Menu+list line;
- payload v12/runtime v1.3: current TreeView-capable line preserving the earlier supported semantics.

Explicit legacy linking fails closed when TreeView is requested on a payload version that predates v12. FreeBSD native GUI remains unsupported.

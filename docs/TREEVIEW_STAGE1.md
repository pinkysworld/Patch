# TreeView Stage 1

TreeView Stage 1 adds a small source-backed hierarchical data control with one shared browser selection contract across Patch Studio's App Preview and the standalone single-file Window Web runtime.

## Source syntax

```patch
create list selected = []

window "Files" as main:
  tree as files:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "ROADMAP.md"

when files changed:
  change selected:
    set = value
```

A `tree` needs a control id after `as` and at least one indented `node`. Nodes can contain nested nodes at deeper indentation. Node labels are ordinary Patch expressions and are evaluated for display by the Window runtime model.

The parser rejects non-node statements inside a tree and inconsistent sibling indentation. This keeps hierarchy explicit in source rather than inferred from strings or a hidden designer document.

## Selection semantics

Tree selection is transient UI state. A `changed` event exposes the selected path as event-local `value`, represented as a non-empty text list.

Selecting `parser.js` in the example above produces:

```text
["src", "parser.js"]
```

The toolkit selection itself is not persistent Patch state and does not create Change History. Persistence still requires an ordinary semantic `change`, such as `set = value` into a declared list.

The Window event adapter version for this contract is `0.8`.

## IR and capability contract

TreeView remains a normal `UI_CONTROL` in Change IR. Its hierarchical source metadata is carried as recursive `treeNodes` entries containing label expressions, source lines and child nodes. Programs using it advertise the `ui.tree` runtime capability.

This does not change semantic mutation rules. Tree labels and transient selection are UI data; only explicit `change` operations mutate persistent application state.

## Stage 1 support boundary

Stage 1 is supported by:

- Patch parser and compiler/IR lowering;
- the interpreter UI model;
- the Studio App Preview, with `tree`, `treeitem` and `group` accessibility roles;
- the standalone single-file Window Web runtime **0.9**, using the same accessibility roles and full-path `changed` value;
- the transient Window-event adapter.

The original Stage 1 boundary was opt-in and fail-closed. Baseline TreeView was later promoted through versioned native contracts and is part of the current desktop line. New TreeView presentation metadata still needs its own explicit target support and must fail closed where that metadata is not transported.

The current Designer now exposes source-backed structural TreeView editing. Add, rename, reorder, indent, outdent, delete and subtree workflows rewrite the canonical `tree`/`node` source rather than maintaining a second hidden model.

## Next slice

The baseline native TreeView runtime slice has since shipped. Future TreeView native work should extend only explicitly versioned presentation metadata, while preserving the Stage 1 rule that UI selection is transient and persistent state changes only through Patch `change`.


## Node image presentation 0.1

The R4 TreeView icon slice adds optional ImageList-backed node presentation without changing selection semantics:

```patch
imagelist as tree_icons size 16, 16:
  image folder from "patch-resource:icons.folder"
  image file from "patch-resource:icons.file"

tree as files:
  node "src" image tree_icons.folder
    node "parser.js" image tree_icons.file
```

The binding is source-backed metadata. Studio App Preview and Standalone Window Web render the referenced project resource at the ImageList logical size. The structural Properties editors preserve the binding through rename, reorder, indent, outdent and duplication workflows and allow it to be edited as `ImageList.item`.

A node click still emits exactly the same transient root-to-node text-list path through `changed(value)`. Icons add no persistent state and no second mutation channel.

The Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 contract does not transport per-node ImageList bindings. Native validation therefore fails closed when this metadata is present rather than dropping the icon silently. A future native contract can add that transport explicitly.

## Node hint presentation 0.1

The next R4 TreeView presentation slice adds optional source-backed tooltip metadata:

```patch
tree as files:
  node "src" hint "Source folder"
    node "parser.js" hint "Parser implementation"
```

Hints are static quoted text attached to a node declaration. Studio App Preview and Standalone Window Web expose the text through the browser tooltip while keeping the node's accessible selection name and root-to-node `changed(value)` path based only on node labels.

The structural Properties editors expose a Node hint field for top-level and nested TreeViews. Rename, reorder, indent, outdent and subtree duplication preserve the hint because it is part of the canonical source-backed node metadata.

Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 does not transport per-node tooltip metadata. Native validation therefore fails closed when hints are present. State presentation remains a later TreeView metadata slice.


# TreeView Stage 1

TreeView Stage 1 adds a small source-backed hierarchical data control to Patch Studio's App Preview without silently claiming native or standalone-Web parity.

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
- the transient Window-event adapter.

Stage 1 deliberately remains fail-closed for Window targets that have not opted into a versioned TreeView runtime contract. That currently includes native desktop builds, sealed Ready/offline apps and the standalone Window Web generator.

The Designer displays the interpreter preview but does not expose TreeView source-rewrite controls in Stage 1. TreeView hierarchy is edited in Patch source until a later source-safe Designer contract is defined.

## Next slice

A later TreeView runtime slice can define a versioned Native GUI IR/payload contract and platform consumers for Win32, AppKit and GTK. Standalone Web can then opt into the same selection-path semantics. Those later steps should preserve the Stage 1 rule that UI selection is transient and persistent state changes only through Patch `change`.

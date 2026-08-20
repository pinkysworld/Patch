# Patch Studio TreeView duplicate subtree

Patch Studio supports **Duplicate** for the selected TreeView node in both top-level TreeView Properties and a TreeView nested inside a Tabs page.

The operation copies the selected node and its complete descendant hierarchy and inserts the copy immediately after the original sibling. Labels remain ordinary Patch expressions and the resulting hierarchy is rewritten through the existing source-backed TreeView data APIs.

Top-level TreeViews continue to use `updateDesignerTreeNodes`; nested TreeViews continue to use `updateDesignerTabPageTreeNodes`. The shared immutable copy operation lives only in `web/designer-tree-model.js`, because duplication is a Studio authoring action rather than a new runtime semantic.

The copied subtree is deep and independent: later JavaScript-side editing of a copied node cannot mutate the original through shared child-array references. Invalid node paths, malformed nodes and empty TreeView models fail closed.

The active node selection remains transient IDE state. Duplicate does not create hidden Patch application state and does not add anything to Change History beyond the ordinary visible source edit.

This feature does not change Patch syntax, Change IR 0.10, Native GUI IR 1.2, sealed payload v12, runtime v1.3 or the beta.32 formal-assurance boundary.

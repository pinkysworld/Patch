# Patch Studio Command Palette

Patch Studio provides a keyboard-first Command Palette for IDE actions plus transient project-file and symbol quick-open.

Open it with **Ctrl/Cmd+K** or the **Commands** button in Studio. Type to filter, use **Arrow Up/Down** to choose a result, press **Enter** to open or run it, and press **Escape** to close the palette.

## Current commands

- Run project
- Build selected target
- Focus source editor
- Open Designer
- Open App preview
- Open Output
- Open Change Contract
- Open Change IR
- Open Recovery
- Open Documentation
- Open Downloads
- Open Help

The palette delegates to the existing Studio controls and navigation routes. It does not implement a second Run, Build, recovery or mutation path.

## Project file and symbol quick-open

The same search surface also exposes the files and outline symbols in the current multi-file project bundle v3.

File results activate the existing project file and focus its source. Symbol results activate the owning file and select the exact source line. Current symbol categories reuse the Project Tree model: **Form**, **State**, **Event**, **Recipe** and **Field**. Thing records appear as State symbols; each Thing field is a Field symbol labelled `name.field` that jumps to the field declaration line.

The quick-open result set is rebuilt from `getStudioProjectFiles()` whenever the palette opens and when the active project/file changes. Symbol extraction uses the normal Patch parser plus `buildOutlineModel`, the same semantic source used by Project Tree. Invalid source still exposes its file result but does not invent a stale symbol result.

Filtering is fuzzy and token-aware. A direct substring or word-boundary match ranks above a looser subsequence match, while multi-token searches such as `settings form` can narrow by path, symbol type and metadata.

## State boundary

Palette search text, the active result and dialog visibility are transient IDE interaction state. The file/symbol result set is also transient. The palette does not create or persist a secondary project index and does not write `localStorage`, `sessionStorage`, IndexedDB, Patch source, Change History or application state.

Running or building through the palette is equivalent to activating the existing **Run** or **Build** control. Opening a result view is equivalent to activating the existing result tab. Opening a file or symbol delegates to the existing project-file activation path.

## Accessibility

The palette is exposed as a modal `dialog` containing a search field and `listbox`. Keyboard selection is reflected with `aria-selected`. Result-kind badges distinguish Commands, Files, Forms, State, Events, Recipes and Fields without replacing the accessible result text. The normal Studio Run/Build shortcuts are suppressed while a dialog is open, so the palette keeps a single active keyboard context.

The palette has responsive, forced-colors and reduced-motion styling. This automated baseline does not replace manual assistive-technology testing.

## Next refinement boundary

Future palette work may improve ranking, add richer symbol metadata or support additional project navigation only when those features reuse the canonical project and parser/outline models. It must not introduce a second persistent project model or hidden Patch application state.

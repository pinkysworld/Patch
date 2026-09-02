# Patch Studio Command Palette

Patch Studio provides a keyboard-first Command Palette for IDE actions plus transient project-file and symbol quick-open.

Open it with **Ctrl/Cmd+K** or the **Commands** button in Studio. Type to filter, use **Arrow Up/Down** to choose a result, press **Enter** to open or run it, and press **Escape** to close the palette. **F12** toggles between the active Patch source and the visual Designer without opening the palette.

## Current commands

- Run project
- Build selected target
- Undo Studio edit
- Redo Studio edit
- Toggle Source / Designer
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

The palette delegates to the existing Studio controls and navigation routes. It does not implement a second Run, Build, recovery, mutation or Designer-selection path.

## Source / Designer navigation

`studio-view-navigation/0.1` keeps the Delphi/Visual-Basic-style **F12 View Source / View Form** interaction on top of the existing source-backed Designer state.

When a Designer control is selected, **View Source** delegates to the existing Object Inspector **Source** action so the same selection-to-source mapping is used. If no control is selected, it focuses the active source editor. **View Designer** activates the existing Designer tab and restores focus to the selected Designer control when possible, otherwise to the first available Designer control.

F12 is ignored while a modal Studio dialog is open and does not create persistent IDE or application state.

## Project file and symbol quick-open

The same search surface also exposes the files and outline symbols in the current multi-file project bundle v4.

File results activate the existing project file and focus its source. Symbol results activate the owning file and select the exact source line. Current symbol categories reuse the Project Tree model: **Form**, **State**, **Event**, **Recipe**, **Field** and **Param**. Thing records appear as State symbols; each Thing field is a Field symbol labelled `name.field` that jumps to the field declaration line. Recipe parameters appear as Param symbols labelled `name.param` that jump to the recipe declaration line.

The quick-open result set is rebuilt from `getStudioProjectFiles()` whenever the palette opens and when the active project/file changes. Symbol extraction uses the normal Patch parser plus `buildOutlineModel`, the same semantic source used by Project Tree. Invalid source still exposes its file result but does not invent a stale symbol result.

Filtering is fuzzy and token-aware. A direct substring or word-boundary match ranks above a looser subsequence match, while multi-token searches such as `settings form` can narrow by path, symbol type and metadata.

## State boundary

Palette search text, the active result and dialog visibility are transient IDE interaction state. Source/Designer focus is also transient. The file/symbol result set is transient. The palette does not create or persist a secondary project index and does not write `localStorage`, `sessionStorage`, IndexedDB, Patch source, Change History or application state.

Running or building through the palette is equivalent to activating the existing **Run** or **Build** control. Opening a result view is equivalent to activating the existing result tab. Opening a file or symbol delegates to the existing project-file activation path. Source/Designer navigation delegates to the existing Object Inspector Source action and Designer tab.

## Accessibility

The palette is exposed as a modal `dialog` containing a search field and `listbox`. Keyboard selection is reflected with `aria-selected` and the search field exposes the active result with `aria-activedescendant`. Focus returns to the invoking control when the palette closes. Result-kind badges distinguish Commands, Files, Forms, State, Events, Recipes, Fields and Params without replacing the accessible result text. The normal Studio Run/Build and F12 navigation shortcuts are suppressed while a dialog is open, so the palette keeps a single active keyboard context.

The palette has responsive, short-screen, forced-colors and reduced-motion styling. On narrow screens it becomes a bounded bottom-sheet layout using dynamic viewport sizing and safe-area padding. This automated baseline does not replace manual assistive-technology testing.

## Next refinement boundary

Future palette work may improve ranking, add richer symbol metadata or support additional project navigation only when those features reuse the canonical project and parser/outline models. It must not introduce a second persistent project model or hidden Patch application state.

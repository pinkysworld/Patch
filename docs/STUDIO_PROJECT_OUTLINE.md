# Patch Studio Project Tree

Patch Studio now uses a source-backed **Project Tree** as the Stage 2 project-navigation model. Stage 1 provided navigation over `main.patch`; Stage 2 extends the same source ownership to multiple files without introducing a hidden Form document or secondary mutation model.

## Current Stage 2 scope

The tree reads every `.patch` source in the canonical project v3 bundle. Each file is a real project source and expands into the same parser-derived groups used by the original outline:

- **Forms** for `window` declarations;
- **State** for `create` declarations, including Thing records and their own fields as `name.field`;
- **Events** for `when ...` handlers;
- **Recipes** for recipe declarations.

The Patch parser remains the only source of symbol structure. The tree does not persist a duplicate AST, Form definition or private UI state.

## Files and Forms

The Project Tree exposes two source-backed creation actions:

- **+ File** creates another `.patch` source path;
- **+ Form** creates a `.patch` file containing an ordinary named `window` declaration and switches the project kind to Window.

The entry source is visually identified and cannot be deleted from the tree. Other files can be removed after confirmation. File paths pass through the project-v3 path and size validation rules before the canonical project changes.

Selecting a file first synchronizes the current editor text into its owning project-file record, then loads the selected source into the same editor. The editor title follows the active source path.

## Symbol navigation

Each symbol stores its local source line and owning file. Selecting a symbol activates that file, focuses the editor and selects the exact line. Selecting a Form also activates the Designer tab so source navigation and visual editing stay close together.

The tree is keyboard reachable because file and symbol entries are ordinary buttons with accessible names. The entry/non-entry distinction is not communicated by color alone.

## Editing resilience

Normal editing frequently creates temporarily invalid source between keystrokes. Stage 2 therefore keeps a separate last-successful outline model for each project file.

If one file becomes invalid, its most recent valid symbols remain visible while that file is marked invalid. Other project files continue to parse and navigate normally. As soon as the source parses again, only that file's outline model is replaced.

The tree never invents or persists symbols independently of source.

## Run and Build ownership

The visible editor always owns only the active file. Before Run or Build, the project lifecycle synchronizes that file into the canonical v3 bundle and creates a deterministic composed source stream for existing compiler/build consumers.

This compatibility bridge means all source files participate in one Patch program while Designer edits remain attached to the selected file rather than to an invisible concatenated document. The project model also records composition segments so a composed line can be mapped back to file and local line.

Multi-file execution is covered by a repository test that stores state in `main.patch`, a Form in a second source and an event handler in a third source, then compiles and executes the composition and dispatches the cross-file event.

## Layout

On wider screens the Project Tree occupies a compact column beside the source editor. The Designer/App/Output area remains below that source workspace at full Studio width.

Below 760 px the source workspace becomes one column and the tree turns into a shallow scrollable panel above the editor. This avoids returning to the old narrow right-side Designer layout.

## Offline and deployment contract

`web/studio-outline.js`, `web/studio-outline.css` and the pure shared `src/studio-outline-model.js` are included in the content-addressed public-site revision and Service Worker core cache. The deployed tree imports the same browser copy of `src/parser.js` that Patch Studio already ships.

## Remaining boundary

Stage 2 establishes real multi-file project storage, editing, recovery and Run/Build composition. It does not claim a module/import system: project files are deliberately composed into one Patch program and share one global declaration namespace.

The project model now carries source-to-file line segments, but every existing diagnostic surface has not yet been upgraded to display `file:line`. A later provenance slice can consume that mapping in Studio diagnostics and build errors without changing the project format again.

# Patch Studio Project Tree

Patch Studio uses a source-backed **Project Tree** as the project-navigation model. It spans every `.patch` file in the canonical project bundle while keeping source ownership explicit and avoiding a hidden Form document or duplicate AST.

## Current scope

The tree reads every `.patch` source in the canonical **project v4** bundle. Each file expands into parser-derived groups:

- **Forms** for `window` declarations;
- **State** for `create` declarations, including Thing fields such as `name.field`;
- **Events** for `when ...` handlers;
- **Recipes** for recipe declarations and parameters such as `name.param`.

Project-v4 image resources are owned by the same canonical project but are managed through the Resource Manager rather than being parsed as source symbols. Controls refer to them through logical `patch-resource:<id>` locators.

The Patch parser remains the source of symbol structure. The tree does not persist a duplicate AST, Form definition or private application model.

## Files and Forms

The Project Tree exposes source-backed creation actions such as:

- **+ File** for another `.patch` source path;
- **+ Form** for a `.patch` file containing an ordinary named `window` declaration.

The entry source is identified and cannot be deleted. Other files pass through project-v4 path/size validation before the canonical project changes.

Selecting a file first synchronizes current editor text into its owning project-file record, then loads the selected source into the same editor. The editor tabs provide the same activation. The active file reports parse status and caret position as transient IDE state.

## Symbol navigation

Each symbol stores its local line and owning file. Selecting it activates that file, focuses the editor and navigates to the exact source line. Selecting a Form also brings the Designer into view.

Thing fields and recipe parameters are exposed as source-backed symbols, so navigation remains useful as the project grows without creating a second semantic index.

## Editing resilience

Normal editing temporarily creates invalid source. The outline keeps a last-successful model per file. If one file becomes invalid, its last valid symbols can remain visible with an invalid marker while other files continue to parse/navigate. Once source parses again, that file's model is replaced.

The tree never invents or persists symbols independently of source.

## Run and Build ownership

The visible editor owns only the active file. Before Run/Build, project lifecycle synchronizes it into the canonical v4 bundle and creates the deterministic composed source stream expected by compiler/build consumers.

Resources remain a separate build input and are never concatenated into source. The composition records line segments so diagnostics can map composed lines back to `file:line`.

This compatibility bridge lets all source files participate in one Patch program while Designer edits remain attached to their real file rather than an invisible concatenated document.

## Layout and accessibility

On wider screens the Project Tree sits beside the source editor. On narrow screens it becomes a shallow scrollable panel above the editor. File and symbol entries are ordinary accessible controls; entry/non-entry distinctions are not communicated by color alone.

## Offline and deployment contract

`web/studio-outline.js`, its CSS and `src/studio-outline-model.js` are included in the content-addressed public-site revision and Service Worker cache. The deployed tree consumes the same parser shipped with Studio.

## Boundary

Project v4 establishes multi-file source storage plus explicit project resources. It is not a module/import system: source files are deliberately composed into one global Patch program. Resource Manager entries are explicit project assets, not source modules.

Studio diagnostics, Run/Build errors, Change Contract failures, `.patchreport` files and native preflight errors consume composition provenance and display owning `file:line`. Generated backend/compiler locations remain separate.

# Patch Studio Project Outline

Patch Studio includes a source-backed Project Outline as the first project-navigation stage toward richer project trees and future separate source files/forms.

## Current Stage 1 scope

The outline reads the same `main.patch` source as the editor and groups top-level symbols into:

- **Forms** for `window` declarations;
- **State** for `create` declarations;
- **Events** for `when ...` handlers;
- **Recipes** for recipe declarations.

There is no second project model and no hidden Form document. The Patch parser remains the source of the outline model.

## Navigation

Each outline symbol stores its source line. Selecting an entry focuses `main.patch` and selects that exact line in the editor. Selecting a Form also activates the Designer tab so source navigation and visual editing stay close together.

The outline is keyboard reachable because symbols are ordinary buttons with an accessible label containing the symbol name, kind and source line.

## Editing resilience

Normal editing frequently creates a temporarily invalid source file between keystrokes. The outline therefore keeps the most recent successfully parsed structure visible while the current source is invalid. Its status changes to `Waiting for valid source` and includes the parser line when available.

As soon as the source parses again, the outline refreshes from the new AST. It never invents or persists symbols independently of source.

## Layout

On wider screens the outline occupies a compact column beside the source editor. The Designer/App/Output area remains below that source workspace at full Studio width.

Below 760 px the source workspace becomes one column and the outline turns into a shallow scrollable panel above the editor. This avoids squeezing the editor on phones and small tablets.

## Offline and deployment contract

`web/studio-outline.js` and `web/studio-outline.css` are included in the content-addressed public-site revision and Service Worker core cache. The deployed module imports the same browser copy of `src/parser.js` that Patch Studio already ships.

## Boundary and next stage

Stage 1 is navigation over the existing single-source project. It does **not** claim that the roadmap item for separate source files/forms is complete.

A later project-tree stage can extend the canonical project bundle with multiple source entries only after versioned project-format migration, import/export, recovery, build inputs and source ownership are defined together. Until then, `main.patch` remains the single authoritative source file.
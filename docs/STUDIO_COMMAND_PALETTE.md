# Patch Studio Command Palette

Patch Studio provides a keyboard-first Command Palette for common IDE navigation and actions.

Open it with **Ctrl/Cmd+K** or the **Commands** button in Studio. Type to filter, use **Arrow Up/Down** to choose an action, press **Enter** to run it, and press **Escape** to close the palette.

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

## State boundary

Palette search text, the active command and dialog visibility are transient IDE interaction state. The palette does not write `localStorage`, `sessionStorage`, IndexedDB, Patch source, Change History or application state.

Running or building through the palette is equivalent to activating the existing **Run** or **Build** control. Opening a result view is equivalent to activating the existing result tab.

## Accessibility

The palette is exposed as a modal `dialog` containing a search field and `listbox`. Keyboard selection is reflected with `aria-selected`. The normal Studio Run/Build shortcuts are suppressed while a dialog is open, so the palette keeps a single active keyboard context.

The palette has responsive, forced-colors and reduced-motion styling. This automated baseline does not replace manual assistive-technology testing.

## Backlog direction

A later palette milestone may add project-file and symbol quick-open using the existing multi-file project and Project Outline models. That extension should remain navigation-only and must not introduce a second persistent project model.

# Patch Studio UX

Patch Studio should feel like a small development environment, not a documentation page with controls attached.

## Current UX principles

- Keep the source editor and Designer visually dominant.
- Keep Designer tools compact and grouped by task.
- Keep Form controls available without letting them consume the full toolbar.
- Preserve visible scroll affordances in the code editor, Designer, App preview and diagnostic panes.
- Keep the source as the single source of truth for Designer edits.
- Prefer small, predictable controls over large call-to-action buttons inside the workspace.
- Preserve keyboard, narrow-screen and dark-mode usability.

## Layout

The code editor occupies the first full-width workspace pane. The Designer/App/Output/Changes/IR pane sits below it at full width. This gives source-backed Forms enough horizontal and vertical room while keeping diagnostics one tab away.

## Scroll behavior

Studio scroll surfaces use explicit overflow, stable scrollbar gutters and styled scrollbar thumbs. This is intentional, especially on macOS browsers where overlay scrollbars can otherwise make scrollable content look clipped.

## Designer controls

Toolbox buttons are deliberately compact. Form selection and geometry controls should remain secondary to the canvas. Add Form and Apply Form use compact icon buttons while retaining their accessible text in the DOM.

# Patch Studio UX

Patch Studio should feel like a small development environment, not a documentation page with controls attached.

## Current UX principles

- Keep the source editor and Designer visually dominant.
- Keep contract/status copy collapsed until asked for, so the workspace is first.
- Keep Designer tools compact and grouped by task.
- Keep Form controls available without letting them consume the full toolbar.
- Preserve visible scroll affordances in the code editor, Designer, App preview and diagnostic panes.
- Keep the source as the single source of truth for Designer edits.
- Prefer small, predictable controls over large call-to-action buttons inside the workspace.
- Preserve keyboard, narrow-screen and dark-mode usability.

## Layout

The code editor occupies the first full-width workspace pane. The Designer/App/Output/Changes/IR pane sits below it at full width. This gives source-backed Forms enough horizontal and vertical room while keeping diagnostics one tab away.

The editor title shows the active file. A live **Ln · Col** caret sits beside it. That caret is transient IDE state only: it is not Patch application state, Change History, recovery or project persistence.

Contract cards and the three-step quick start stay behind a closed **Contracts and quick start** disclosure so they do not push the workspace off the first screen. The beta.35 feature boundary lives in that same disclosure, not as a banner above the editor.

Empty Designer and App panes use a compact dashed card with a title, the existing guidance sentence and a keyboard hint. The status bar stays visible on narrow screens and carries save state plus the current Ready contract chip (`IR 1.3 / v1.4`).

## Scroll behavior

Studio scroll surfaces use explicit overflow, stable scrollbar gutters and styled scrollbar thumbs. This is intentional, especially on macOS browsers where overlay scrollbars can otherwise make scrollable content look clipped.

## Designer controls

Toolbox buttons are deliberately compact. Form selection and geometry controls should remain secondary to the canvas. Add Form and Apply Form use compact icon buttons while retaining their accessible text in the DOM.

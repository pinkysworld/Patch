# Patch Studio accessibility baseline

Patch Studio treats keyboard/focus behavior and narrow-screen usability as part of the IDE contract rather than optional visual polish.

## Keyboard access

The Studio exposes a visible-on-focus **Skip to editor** link. The main result views use a labelled horizontal tablist with tab-to-panel relationships. When focus is in the result tabs:

- Left/Right Arrow moves and activates the previous/next result view;
- Home moves to Designer;
- End moves to IR.

Studio-level shortcuts currently include:

- `Ctrl/Cmd + Enter`: Run the current project;
- `Ctrl/Cmd + Shift + Enter`: Build the selected target.

Global Studio shortcuts are suppressed while a modal dialog is open so they do not bypass Recovery or other modal workflows.

## Focus and status

Keyboard focus uses a strong `:focus-visible` outline. Designer controls already remain keyboard-selectable and their compact palette exposes labels through accessible names/tooltips.

Local save state, diagnostics state and native build status are polite status regions. Console output is intentionally not a live region because automatically announcing arbitrary program output while editing would be noisy and disruptive.

## Result tabs

The Designer, App, Output, Changes and IR buttons use `role="tab"`, stable ids, `aria-controls`, `aria-selected` and roving `tabindex`. Their corresponding views use `role="tabpanel"`, `aria-labelledby` and a focus target for moving from the tablist into the active result. JavaScript synchronizes accessibility state with the Studio's existing active/hidden view state, including programmatic view switches after Run or Build.

## Responsive and alternative display modes

The accessibility stylesheet adds:

- project/support action wrapping before controls are clipped;
- horizontally scrollable result tabs;
- narrower app/Window containment;
- larger form controls and action targets for coarse pointers;
- reduced-motion behavior for users requesting it;
- explicit selected/focus affordances in forced-colors mode;
- small-screen toolbar, project bar, app preview and Window spacing adjustments.

The existing Designer responsive rules remain responsible for moving the Properties inspector below the canvas and turning the desktop palette rail into a horizontal toolbar on narrower screens. The coarse-pointer override increases palette button size only after that responsive transformation, avoiding overlap in the fixed desktop palette rail.

## Scope

This baseline is regression-tested structural accessibility work. It is **not** a claim of WCAG conformance or a substitute for testing with real assistive technology.

Before a stable release, Patch still needs:

- manual testing with screen readers and keyboard-only browser use;
- browser/OS contrast and zoom testing;
- a separate accessibility audit of generated Patch Window applications, including standalone Web and native Win32/AppKit/GTK outputs.

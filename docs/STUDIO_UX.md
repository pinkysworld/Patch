# Patch Studio UX

Patch Studio should feel like a compact development environment, not a documentation page with controls attached.

## Current UX principles

- Keep the source editor and Designer visually dominant.
- Keep contract/status copy collapsed until asked for, so the workspace is first.
- Keep Designer tools compact and grouped by task.
- Keep Form controls discoverable through the searchable Component Palette.
- Keep nonvisual components in the nonvisual tray rather than pretending they occupy Form geometry.
- Preserve visible scroll affordances in the code editor, Designer, App preview and diagnostic panes.
- Keep source plus the explicit project-v4 resource store as the single project source of truth.
- Prefer small, predictable controls over large call-to-action buttons inside the workspace.
- Preserve keyboard, narrow-screen and dark-mode usability.
- Never advertise target parity that the capability matrix does not actually provide.

## Layout

The source workspace and result/Designer workspace share the main Studio area with an adjustable split on wider screens. The Project Tree sits beside the source editor and navigates every `.patch` file in the canonical **project bundle v4**.

The editor title shows the active file. Editor tabs switch files from the same v4 project. Live parse status and **Ln · Col** caret position are transient IDE state only; they are not Patch application state, Change History, recovery or project persistence.

Project resources are explicit v4 project data and are managed by the Resource Manager. The Resource Manager is a project-level tool, not a second Designer document.

Contract cards and the quick-start guidance stay behind **Contracts and quick start** so they do not push the workspace off the first screen.

Empty Designer and App panes use a compact guidance card. The status bar stays visible on narrow screens and carries save state plus the current Ready contract chip **IR 1.8 / runtime v1.9**.

## Designer discovery

The searchable Component Palette is the canonical discovery surface. Current groups include Basic, Choices, Data, Containers, Graphics, Chrome and Nonvisual.

Graphics currently includes Picture, Shape and PaintBox. Nonvisual currently includes Timer and ImageList. The nonvisual tray projects those components from ordinary source and shares central selection state with the rest of the Designer.

## Object Inspector

Properties and Events share one Object Inspector surface. Adapter-specific editors may add component properties, but source/project-v4 resources remain authoritative.

Layout controls are hidden or locked when the component contract owns layout. Timer and ImageList never expose X/Y/Width/Height or Anchors/Dock. StatusBar reports its bottom dock as component-owned.

## Scroll behavior

Studio scroll surfaces use explicit overflow, stable scrollbar gutters and visible scrollbar affordances. This is intentional, especially on browsers/platforms with overlay scrollbars where scrollable content can otherwise look clipped.

## Designer controls

Toolbox controls remain compact. Form selection and geometry tools stay secondary to the canvas. Arrange commands, grid behavior, structural editors and Resource Manager actions all delegate to the same source/project mutation boundaries rather than keeping private component state.

## Target truthfulness

Studio may author a component before every runtime target supports it, but the UI/docs must say so. Current examples:

- Picture has project-resource authoring, source-backed fit/center/opacity/description and current native PNG/JPEG decoding under `native-picture-formats/1.0`; deferred WebP/SVG and non-default native display properties fail closed;
- Shape has Studio, Standalone Web and current native Ready support on IR 1.5 / payload v15 / runtime v1.6, preserved by the current IR 1.8 / payload v18 / runtime v1.9 line;
- PaintBox Stage 1 clear/line/rectangle/ellipse/text and quoted `draw image` have Studio, Standalone Web and current native Ready support;
- ImageList Button `image list.item` is Ready on Studio/Web and current native Windows, macOS and Linux for PNG/JPEG; WebP/SVG fail closed;
- Window icons are source-backed Studio/Web chrome and favicon packaging under `window-icon/1.0`; native GUI IR 1.4 fail-closes Form icons.

The Designer therefore prioritizes clear capability boundaries over cosmetic parity claims.

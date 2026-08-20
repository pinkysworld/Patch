# Patch Studio layout actions

Patch Studio keeps layout in visible `.patch` source. The selected-control layout actions are convenience commands over the same source-backed geometry used by drag, resize and Properties; they do not create a hidden form document or persistent Designer model.

## Selected-control actions

When exactly one top-level control is selected, Properties exposes four Form-relative actions:

- **Center H** centers the control's current width inside its source-backed Form width.
- **Center V** centers the control's current height inside its source-backed Form height.
- **Default size** restores the shared professional Designer size for the control type from `src/form-layout.js`.
- **Auto place** moves the control to the first non-overlapping standard position in the active Form, using the existing source-backed sibling geometry and the normal 24 px margin / 12 px gap.

These actions apply to ordinary controls, Tabs, Table and TreeView because they use the shared Designer primary-selection location rather than control-specific Inspector fallbacks.

## Action order is explicit

Each button performs one operation. For example, a 180 px wide control in a 640 px Form centers at `x = 230`. If **Default size** later changes that control to 120 px wide, its x position remains 230. Pressing **Center H** after that size change centers the new width at `x = 260`.

This is deliberate: Studio does not silently combine layout operations or invent a transient layout transaction.

## Auto place and Form growth

**Auto place** starts at the normal `(24, 24)` Designer margin and searches downward for the first standard position that does not overlap another top-level control in the same Form. A 12 px visual gap is included in collision checks.

If Auto place or Default size would otherwise clip the selected control, Studio grows the source-backed Form dimensions just enough to contain it plus the normal margin. Centering never needs a hidden canvas size because it uses the Form dimensions already represented in Patch source (or the ordinary 640×420 fallback for legacy unsized Forms).

## Multi-selection

Form-relative single-control actions are disabled while more than one Designer control is selected. Group movement and alignment remain owned by the existing multi-select tools, so there is one clear command path rather than overlapping mutation handlers.

## Source and state boundary

The implementation writes geometry through `updateDesignerControl` and, when needed, Form dimensions through `updateDesignerWindow`. The resulting source is reparsed by the normal Studio update path.

The layout-action surface stores no `localStorage` or `sessionStorage` application data. Selection and status text are transient IDE state. Layout actions do not create Patch Change History entries because they edit source; runtime application state still changes only through explicit Patch `change`.

## Accessibility and offline use

The controls are ordinary keyboard-focusable buttons with visible focus treatment and forced-colors support. On narrow screens the action grid becomes a single column. The JavaScript and stylesheet are included in the content-addressed public Studio build and the offline PWA cache.

This is a Studio/product feature only. It does not change Patch syntax, Change IR **0.10**, Native GUI IR **1.2**, sealed payload **v12**, native runtime **v1.3**, or the beta.32 formal-assurance boundary.

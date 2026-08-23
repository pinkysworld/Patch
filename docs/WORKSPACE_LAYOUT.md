# Patch Studio Workspace Layout v2

Patch Studio keeps the source workspace above the result/Designer workspace. Workspace Layout v2 adds an adjustable horizontal divider between those existing regions without changing Patch project or application state.

## Desktop behavior

The **Source / Result** separator appears between the source workspace and the result pane on wider screens.

- Drag the separator vertically to give more height to source or results.
- Focus the separator and press **Arrow Up** or **Arrow Down** for keyboard resizing.
- Hold **Shift** with an arrow key for a larger step.
- Press **Home**, double-click the separator, or choose **Reset split** to restore the default 40/60 allocation.
- The separator exposes its current and available range with the ARIA separator value contract.

Patch Studio preserves minimum usable heights for both sides. The exact reachable percentage range is therefore derived from the real workspace height rather than being a fixed visual claim.

## Local preference boundary

The split ratio is an IDE-only browser preference stored under:

`patchStudio.workspaceSplit.v2`

It is not part of `.patch` source, the canonical multi-file project bundle v3, recovery snapshots, Change History, Change IR or runtime application state.

Resetting the split removes that preference and restores the default ratio.

## Narrow-screen fallback

At widths up to 760 px the resize control is hidden and the Studio uses its natural stacked responsive layout. A previously stored desktop ratio is retained but does not force fixed heights on the narrow layout. Returning to a wider viewport reapplies the saved desktop preference.

## Accessibility boundary

The divider is a focusable horizontal `separator`. Its `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` values track the actual constrained workspace geometry. Pointer resizing and keyboard resizing use the same bounded source/result allocation.

This automated keyboard and ARIA baseline does not replace manual assistive-technology validation.
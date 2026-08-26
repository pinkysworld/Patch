# Shape Stage 1

Shape Stage 1 defines the deterministic graphics model that later source, Designer, Web and native adapters must share. It is deliberately separated from the authoring/runtime rollout so Patch does not expose a Toolbox component before every advertised target has an explicit contract.

## Geometry kinds

The canonical kinds are:

- `rectangle`
- `rounded`
- `ellipse`
- `line`

`src/shape-control.js` is the authoritative normalization layer for these design properties.

## Properties

| Property | Contract |
|---|---|
| `kind` | one of the four canonical geometry kinds |
| `fill` | six/eight-digit hex color or `transparent`; line is always normalized to transparent fill |
| `stroke` | six/eight-digit hex color |
| `strokeWidth` | finite number from 0 through 64 |
| `cornerRadius` | finite number from 0 through 4096, meaningful for `rounded` |
| `opacity` | finite number from 0 through 1 |

The model rejects arbitrary CSS strings. This keeps the eventual browser and desktop rendering contracts deterministic instead of inheriting platform-specific CSS parsing behavior.

## Rendering descriptors

`patchShapeSvgDescriptor()` returns a normalized `0 0 100 100` SVG-space descriptor. Strokes use `non-scaling-stroke` so resizing a design-time shape does not silently alter its declared stroke width.

`patchShapeCssStyle()` provides the corresponding browser-oriented style projection for consumers that do not need the SVG primitive itself.

These descriptors are projections of the same normalized Shape model. They are not a second persistent UI representation.

## Current boundary

This foundation release does **not** expose Shape in Patch source or the Component Palette yet. The next additive slice must provide:

1. a canonical source syntax and parser round-trip;
2. source-backed Designer add/list/update/delete operations;
3. Object Inspector properties using the canonical Shape metadata;
4. Studio/Web rendering and accessibility behavior;
5. explicit native capability/lowering behavior before Windows, macOS or Linux are advertised as supported.

Until those gates exist, Shape remains implementation groundwork rather than a user-visible claim.

## Source-backed rule

When Shape authoring is enabled, ordinary `.patch` source must remain authoritative. The Designer may normalize a Shape declaration, but it must not store fill, stroke, geometry or opacity in local storage, a hidden form file, or an IDE-only component graph.

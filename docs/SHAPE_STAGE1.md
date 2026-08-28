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

Shape Stage 1 is source-backed in Patch Studio, Standalone Web and the current native Ready/offline line:

- Native GUI IR **1.5**
- sealed payload **v15** (`PSHP` trailer over payload v14)
- runtime **v1.6** (Win32 GDI+, AppKit `NSBezierPath`, GTK cairo)

Native drawing uses the same `0 0 100 100` mapping as `patchShapeSvgDescriptor()`, with `non-scaling-stroke` semantics so `strokeWidth` stays in device pixels. Shape exposes no Patch events. Panel may contain Shape; Shape cannot nest another Shape.

Frozen Native GUI IR 1.4 remains fail-closed for Shape source. PaintBox Stage 1 clear/line/rectangle/ellipse/text is native on Native GUI IR 1.6 / payload v16 / runtime v1.7. `draw image` remains the next RAD R1 gate.

## Source-backed rule

When Shape authoring is enabled, ordinary `.patch` source must remain authoritative. The Designer may normalize a Shape declaration, but it must not store fill, stroke, geometry or opacity in local storage, a hidden form file, or an IDE-only component graph.

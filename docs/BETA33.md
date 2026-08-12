# Patch 0.2.0-beta.33

Beta.33 is a **Studio/product and production-readiness release**. It does not widen the beta.32 formal invocation-frame correspondence claim and does not change Change IR 0.10.

## Product changes

- Patch Studio project format v2 stores source plus selected build target and native build mode.
- Project v1, legacy local storage and v1 recovery snapshots migrate explicitly to v2.
- The source-backed Designer can resize the Form window itself with pointer or keyboard input and writes the resulting size back to Patch source.
- Oversized Forms remain reachable through Designer scrolling rather than being clamped to the visible viewport.
- Public Pages are separated into Studio, Language, Documentation and Help surfaces.
- The old long language/research landing section is removed from the Studio page.
- Artifact naming has an explicit deterministic contract for Studio/project/build outputs.

## Assurance boundary

The beta.32 direct-Wasm invocation-frame evidence and generated Lean certificates remain the current formal runtime-correspondence milestone. Beta.33 does not claim full compiler verification or expand the Lean-checked subset.

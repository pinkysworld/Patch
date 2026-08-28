# Patch agent instructions

Read [`docs/GPT.md`](docs/GPT.md) before changing Patch Studio, the compiler, native contracts or RAD components.

That file is the living ChatGPT/Grok handoff: current contracts, RAD R1 status, remaining gates and the next recommended slice. After component-registry changes run `node scripts/generate-component-matrix.js` and keep `docs/COMPONENT_CAPABILITY_MATRIX.md` in the same commit.

Rules that must not be violated:

- Source is authoritative. No hidden `.frm` / `.dfm` or Designer-only UI model.
- Persistent application state changes only through semantic `change`.
- Unsupported targets fail closed. Studio authoring is not runtime support.
- Do not widen the beta.32 formal claim.
- Do not bump Native GUI IR / payload / runtime unless native backends, sealers, smokes and docs move together.

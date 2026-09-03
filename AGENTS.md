# Patch agent instructions

Read [`docs/GPT.md`](docs/GPT.md) before changing Patch Studio, the compiler, native contracts, Offline Studio or RAD components.

That file is the living ChatGPT/Grok handoff: current product/native contracts, RAD status, Offline Studio distribution and Stage 2 boundary, remaining gates and the next recommended slices. After component-registry changes run `node scripts/generate-component-matrix.js` and keep `docs/COMPONENT_CAPABILITY_MATRIX.md` in the same commit.

Rules that must not be violated:

- Source is authoritative. No hidden `.frm` / `.dfm` or Designer-only persistent UI model.
- Persistent application state changes only through semantic `change`.
- Unsupported targets fail closed. Studio authoring is not runtime support.
- Do not widen the beta.32 formal claim.
- Do not bump Native GUI IR / payload / runtime unless native backends, sealers, release artifacts, smokes and docs move together.
- Keep the public site and Offline Studio browser-module closure synchronized whenever Studio imports change.
- Offline Studio privileged APIs must remain narrow, authenticated, versioned and workspace-bounded. Never expose a general shell/argv/environment bridge.
- Keep release checksums, tested binaries and production code-signing/notarization claims distinct.

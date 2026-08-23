# Native compatibility boundary

Patch has one product-facing native desktop contract and one frozen TreeView compatibility contract. Older versioned files remain executable evidence behind those two facades.

## Current product contract

Current Ready/offline Window builds use **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**. JavaScript product consumers import `src/native-current-contract.js`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags. The stable contract identity is `native-gui-1.3/payload-13/runtime-1.4`.

The facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.

## Frozen TreeView contract

The frozen TreeView line is **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3** and stays Slider fail-closed. Product consumers of that line import `src/native-frozen-contract.js` instead of `native-gui-ir-v12.js` / `sealed-native-gui-v12.js`. The stable contract identity is `native-gui-1.2/payload-12/runtime-1.3`.

## Historical include chain

Unversioned files such as `src/native-gui-ir.js` (Native GUI IR **0.7**) and `native-runtime/win32-sealed-gui.cpp` (payload **v6**) are the *base* of the versioned include chain, not aliases of the current product contract. Each later `*-vNN` module extends the previous one. They must not be edited as if they were the v1.4 Ready runtime.

Version-numbered files such as `native-gui-ir-v08.js` through `native-gui-ir-v11.js`, their sealed payload implementations, backend adapters and compatibility fixtures remain executable test-only evidence because older Table, list and Menu contracts are intentionally preserved rather than redefined. They are not a product import surface and are not copied into the public Studio site bundle.

Unversioned historical bases such as `native-gui-ir.js` and `native-runtime/*-sealed-gui.cpp` remain the include-chain root. They must not be treated as the Ready runtime.

## Collapse rule

The 90-day consolidation target is two live contracts only: **current** and **frozen**.

- New product code imports `native-current-contract.js`.
- Frozen TreeView / payload-v12 / runtime-v1.3 code imports `native-frozen-contract.js`.
- Current and frozen lowering/sealing no longer import versioned v07–v11 modules; they use standalone snapshots `native-gui-frozen-lower.js` and `native-gui-frozen-seal.js`.
- Ready/offline linking, Studio packaging and the native build plan import only those two live contracts. Payload versions below v12 fail closed.
- A version-numbered v07–v11 module is imported directly only when implementing or testing that exact historical format.
- The public Studio site ships current, frozen and the two snapshots. It does not ship retired v07–v11 copies.
- Manual v07–v11 compatibility workflows are retired. Current v1.4 and frozen v1.3 release workflows remain automatic for changes to the active runtime implementation.
- The remaining work is keeping unversioned historical bases from being mistaken for the Ready runtime.
- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.

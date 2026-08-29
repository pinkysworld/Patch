# Native compatibility boundary

Patch has one product-facing native desktop contract and one frozen TreeView compatibility contract. Older versioned files remain executable evidence behind those two facades.

## Current product contract

Current Ready/offline Window builds use **Native GUI IR 1.7 / sealed payload v17 / runtime v1.8**. JavaScript product consumers import `src/native-current-contract.js`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags. The stable contract identity is `native-gui-1.7/payload-17/runtime-1.8`.

The facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.

## Frozen TreeView contract

The frozen TreeView line is **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3** and stays Slider fail-closed. Product consumers of that line import `src/native-frozen-contract.js` instead of `native-gui-ir-v12.js` / `sealed-native-gui-v12.js`. The stable contract identity is `native-gui-1.2/payload-12/runtime-1.3`.

## Historical include chain

Unversioned files such as `src/native-gui-ir.js` (Native GUI IR **0.7**) and `native-runtime/win32-sealed-gui.cpp` (payload **v6**) are the *base* of the versioned include chain, not aliases of the current product contract. Each later `*-vNN` module extends the previous one. They must not be edited as if they were the current Ready runtime.

Version-numbered files such as `native-gui-ir-v08.js` through `native-gui-ir-v13.js`, their sealed payload implementations, backend adapters and compatibility fixtures remain executable test-only evidence because older Table, list, Menu, TreeView and Slider contracts are intentionally preserved rather than redefined. They are not a product import surface and are not copied into the public Studio site bundle unless required by a frozen compatibility facade.

Unversioned historical bases such as `native-gui-ir.js` and `native-runtime/*-sealed-gui.cpp` remain the include-chain root. They are labeled as Native GUI IR **0.7** / payload **v6** and must not be treated as the Ready runtime. Historical `scripts/seal-native-*.js` sealers fail closed unless their exact historical payload is requested. Automatic historical compatibility workflows do not gate Pages; Ready uses the current v1.8 runtime contract.

## Collapse rule

The 90-day consolidation target is two live contracts only: **current** and **frozen**.

- New product code imports `native-current-contract.js`.
- Frozen TreeView / payload-v12 / runtime-v1.3 code imports `native-frozen-contract.js`.
- Current and frozen lowering/sealing use their facade-owned implementations and snapshots rather than accidental imports from retired compatibility layers.
- Ready/offline linking, Studio packaging and the native build plan import only those two live contracts. Payload versions below v12 fail closed.
- A version-numbered historical module is imported directly only when implementing or testing that exact historical format.
- The public Studio site ships current, frozen and the snapshots required by those facades. It does not expose retired compatibility modules as product APIs.
- Manual historical compatibility workflows are compatibility evidence only. Current v1.8 and frozen v1.3 release workflows remain the active product/frozen runtime lines.
- Unversioned historical bases stay as labeled include-chain evidence. They do not gate Ready/Pages and cannot be sealed as if they were payload v12/v17.
- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.

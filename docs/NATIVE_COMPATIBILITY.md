# Native compatibility boundary

Patch has one product-facing native desktop contract and one frozen TreeView compatibility contract. Older versioned files remain executable evidence behind those two facades.

## Current product contract

Current Ready/offline Window builds use **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**. JavaScript product consumers import `src/native-current-contract.js`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags. The stable contract identity is `native-gui-1.3/payload-13/runtime-1.4`.

The facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.

## Frozen TreeView contract

The frozen TreeView line is **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3** and stays Slider fail-closed. Product consumers of that line import `src/native-frozen-contract.js` instead of `native-gui-ir-v12.js` / `sealed-native-gui-v12.js`. The stable contract identity is `native-gui-1.2/payload-12/runtime-1.3`.

## Historical include chain

Unversioned files such as `src/native-gui-ir.js` (Native GUI IR **0.7**) and `native-runtime/win32-sealed-gui.cpp` (payload **v6**) are the *base* of the versioned include chain, not aliases of the current product contract. Each later `*-vNN` module extends the previous one. They must not be edited as if they were the v1.4 Ready runtime.

Version-numbered files such as `native-gui-ir-v08.js` through `native-gui-ir-v11.js`, their sealed payload implementations, backend adapters and compatibility fixtures remain executable because older Table, list and Menu contracts are intentionally preserved rather than redefined. They are not a product import surface.

Historical direct-native smoke workflows are manual compatibility audits. Current v1.4 release workflows remain automatic for changes to the active runtime implementation.

## Collapse rule

The 90-day consolidation target is two live contracts only: **current** and **frozen**.

- New product code imports `native-current-contract.js`.
- Frozen TreeView / payload-v12 / runtime-v1.3 code imports `native-frozen-contract.js`.
- A version-numbered module is imported directly only when implementing or testing that exact historical format, or while the include chain has not yet been flattened.
- Compatibility files are removed only when their executable consumers and documented support boundary are retired together.
- Flattening current and frozen into standalone implementations (so they no longer import v11→v10→…) is the next collapse step. Deleting v07–v11 before that rewrite would break both live contracts.
- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.

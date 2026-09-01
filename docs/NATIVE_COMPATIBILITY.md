# Native compatibility boundary

Patch has one product-facing native desktop contract and preserved compatibility contracts. Older versioned files remain executable evidence behind those facades.

## Current product contract

Current Ready/offline Window builds use **Native GUI IR 1.9 / sealed payload v19 / runtime v1.10**. JavaScript product consumers import `src/native-current-contract.js`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags. The stable contract identity is `native-gui-1.9/payload-19/runtime-1.10`.

IR 1.9 preserves the complete IR 1.8 Button/ImageList layer and the earlier PaintBox-image/native contracts through explicit compatibility projections. The Offline Compiler additionally retains an explicit **payload v17 / runtime v1.8** compatibility route. That compatibility route is not the default Current Ready output.

The facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.

## Frozen TreeView contract

The frozen TreeView line is **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3** and stays Slider fail-closed. Product consumers of that line import `src/native-frozen-contract.js` instead of `native-gui-ir-v12.js` / `sealed-native-gui-v12.js`. The stable contract identity is `native-gui-1.2/payload-12/runtime-1.3`.

## Historical include chain

Unversioned files such as `src/native-gui-ir.js` (Native GUI IR **0.7**) and `native-runtime/win32-sealed-gui.cpp` (payload **v6**) are the *base* of the versioned include chain, not aliases of the current product contract. Each later `*-vNN` module extends the previous one. They must not be edited as if they were the current Ready runtime.

Version-numbered files through IR 1.9, their sealed payload implementations, backend adapters and compatibility fixtures remain executable evidence because older Table, list, Menu, TreeView, Slider, Chrome, Shape, PaintBox, PaintBox-image and Button/ImageList contracts are intentionally preserved rather than redefined. Direct imports of historical modules are for implementation/regression evidence, not the product-facing API.

Unversioned historical bases remain the include-chain root. Historical `scripts/seal-native-*.js` sealers fail closed unless their exact historical payload is requested. Automatic historical compatibility workflows do not redefine Pages or Ready behavior.

## Current release and integrity boundary

Current Ready runtime releases are:

- `native-win32-runtime-v1.10`;
- `native-macos-runtime-v1.10`;
- `native-linux-runtime-v1.10`.

Promotion evidence verifies release source binding, `SHA256SUMS.txt`, GitHub asset digests and runtime smoke. Windows also verifies the reserved PE application-icon slot and associated-icon extraction. macOS/Linux package plans verify their native application-icon metadata.

The normal Offline Compiler carries two GUI runtime assets on desktop hosts:

- Current Ready runtime **v1.10** for default payload **v19** linking;
- legacy runtime **v1.8** for explicit `--gui-payload-version 17` compatibility.

The selector fails closed rather than attaching a payload to the wrong runtime generation.

## Collapse rule

The consolidation target is a small set of intentional live surfaces rather than accidental version imports.

- New product code imports `native-current-contract.js`.
- Frozen TreeView / payload-v12 / runtime-v1.3 code imports `native-frozen-contract.js`.
- Explicit Offline Compiler payload-v17 compatibility uses the exact IR1.7/v17 implementation with a runtime-v1.8 underlay.
- Current and frozen lowering/sealing use facade-owned implementations and explicit projections rather than accidental reinterpretation of older formats.
- A version-numbered historical module is imported directly only when implementing or testing that exact historical format.
- The public Studio site ships the current/frozen modules and transitive snapshots required by those facades.
- Manual historical compatibility workflows are compatibility evidence only. Current v1.10 and frozen v1.3 release lines are the active Ready/frozen runtime boundaries.
- Unversioned historical bases stay as labeled include-chain evidence. They do not gate Ready/Pages and cannot be sealed as if they were current payload v19.
- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.

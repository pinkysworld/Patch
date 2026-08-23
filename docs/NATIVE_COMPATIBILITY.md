# Native compatibility boundary

Patch has one product-facing native desktop contract and several frozen compatibility contracts.

## Current product contract

Current Ready/offline Window builds use **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**. JavaScript product consumers import `src/native-current-contract.js`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags. The stable contract identity is `native-gui-1.3/payload-13/runtime-1.4`.

The facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.

## Frozen compatibility contracts

Version-numbered files such as `native-gui-ir-v08.js` through `native-gui-ir-v12.js`, their sealed payload implementations, backend adapters and compatibility fixtures remain executable because older Table, list, Menu and TreeView contracts are intentionally preserved rather than redefined. They are not the default product import surface.

Historical direct-native smoke workflows are manual compatibility audits. Current v1.4 release workflows remain automatic for changes to the active runtime implementation.

## Maintenance rule

- New product code imports `native-current-contract.js`.
- A version-numbered module is imported directly only when implementing or testing that exact frozen format.
- Compatibility files are removed only when their executable consumers and documented support boundary are retired together.
- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.

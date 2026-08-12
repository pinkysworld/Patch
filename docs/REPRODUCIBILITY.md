# Patch logical artifact reproducibility

Patch distinguishes reproducibility of **Patch-controlled logical payloads** from reproducibility of final operating-system packages built by external native toolchains.

## Reproducible logical artifacts

`compat/release-golden-v1.json` pins the current format/version boundary for six canonical artifacts:

- portable `.patchapp`;
- bootstrap Wasm carrier;
- direct executable Wasm;
- portable C99 source;
- standalone Console Web App;
- standalone Window Web App.

`tests/golden-release-artifacts.test.js` checks those format contracts and starts `scripts/logical-release-fingerprint.js` twice in separate Node processes. Both independent rebuilds must produce an identical fingerprint document containing byte length and SHA-256 for every artifact.

This catches timestamps, random ids, process-specific ordering or other nondeterminism introduced into Patch-controlled serialization/code generation.

## Golden contract versus byte fingerprint

The checked-in golden contract intentionally pins semantic packaging boundaries such as format, version, IR version, project kind and Wasm magic. Byte SHA-256 values are recomputed on every test run and compared across independent rebuilds rather than being permanently frozen in the repository.

That separation allows a reviewed compiler/code-generator change to alter deterministic bytes without pretending the new bytes are a regression, while still requiring the new implementation to remain reproducible and to update the explicit format/version golden when a compatibility boundary changes.

## Native package boundary

Windows PE/MSVC, macOS Mach-O/AppKit, Linux GTK/ELF, signing/notarization, installer metadata and hosted-runner toolchain outputs are outside this logical reproducibility claim. Those paths remain protected by source/payload validation, platform smoke workflows, release commit binding and release SHA-256 manifests.

A future stronger native reproducibility claim would require pinned compiler/toolchain/container inputs and normalization of platform packaging metadata. Passing the logical fingerprint test must not be described as bit-reproducible native builds.

# Patch 0.2.0-beta.34

Beta.34 is a Studio correctness, distribution-integrity and documentation release. It does not widen the beta.32 formal runtime-correspondence claim, change Change IR 0.10, redefine Native GUI IR 0.8 or change the sealed Table ABI from payload v9/runtime v1.0.

## What changed

### One canonical Studio project state

Patch Studio already had a versioned v2 project store, atomic pending-write promotion, migrations and recovery snapshots. A code review found that some programmatic edits in the older playground layer still wrote only the unversioned compatibility key. In particular, example switching and several Designer add/edit/delete paths could update the visible source without guaranteeing that the v2 project lifecycle observed the same edit.

Beta.34 adds a browser DOM synchronization bridge. After source- or project-kind-changing UI actions it checks whether the corresponding shared DOM signal was emitted. If a programmatic mutation changed the source without an `input`/`change` signal, the bridge emits the missing signals so the canonical v2 project lifecycle, Designer refresh, Change Contract refresh and other listeners see one consistent state. Modules that already emit the normal signals are not double-signalled.

The same bridge fixes a related product-state issue: switching between Console and Window examples now propagates the programmatic Project Type change to native-build UI state instead of leaving the native build panel configured for the previous project kind.

### Runtime integrity before browser packaging

Patch Studio's no-token desktop paths consume published runtime templates. Current native Window builds use runtime v1.0; Console ready builds and the explicit compatibility Window path use the versioned `studio-runtime-v0.6` templates. Beta.34 adds one fail-closed byte-integrity layer across every runtime template that the browser may consume.

The Pages deployment now:

1. requires the `studio-runtime-v0.6` release and all three native runtime v1.0 releases before replacing the deployed Studio;
2. downloads the exact Console, compatibility Window and native GUI runtime assets used by Patch Studio;
3. reads the SHA-256 digest that GitHub records for each exact release asset;
4. independently hashes the downloaded bytes in `scripts/runtime-integrity-manifest.js`;
5. refuses deployment when an expected digest and the downloaded bytes disagree;
6. writes `_site/runtimes/runtime-manifest.json` containing the verified file, release tag and SHA-256 digest for every browser-consumed runtime template.

`web/runtime-integrity.js` loads before the native builder. When Patch Studio fetches one of those known same-origin runtime files, the wrapper hashes the bytes with Web Crypto SHA-256 and compares them with the deployed manifest. A missing manifest entry or digest mismatch stops packaging before those bytes are used.

This is an artifact-integrity consistency check. It does not claim Authenticode, Developer ID notarization, a separate transparency log or an independent trust root beyond the HTTPS/GitHub Pages and GitHub Release path already used by Patch Studio.

### Fresh runtime retrieval

The Patch Studio service worker previously treated runtime files as ordinary cache-first assets. That could leave an older runtime in a browser cache after the website moved to a newer published runtime.

Beta.34 treats every same-origin `/runtimes/` request as fresh-first. Successful responses are still retained for offline fallback, but an online build asks the current deployment for the runtime and integrity manifest before falling back to cached bytes.

### Download documentation

The Downloads page now makes the release model explicit:

- the offline compiler is a rolling beta release channel whose assets are replaced only by successful release workflows;
- the published `SHA256SUMS` file is the verification source for offline-compiler downloads;
- platform-specific verification examples are documented;
- Patch Studio runtime byte-integrity checking is documented separately from executable signing/notarization;
- direct links to the native runtime v1.0 release records are available for users who want to inspect the exact native GUI templates used by current Ready Window builds.

## Compatibility

Beta.34 keeps the following boundaries unchanged:

- Patch package: **0.2.0-beta.34**
- Change IR: **0.10**
- Native GUI IR base: **0.7**
- Native GUI IR Table extension: **0.8**
- direct native Table backend: **0.9**
- token-free sealed Table payload: **v9**
- token-free native Table runtime: **v1.0**
- compatibility/Console Studio runtime release: **studio-runtime-v0.6**
- project bundle: **v2**

Payload v8/runtime v0.9 remains the frozen responsive Native GUI IR 0.7 compatibility line.

## Regression gates

Beta.34 adds regression coverage for:

- programmatic Studio source/project-kind mutations reaching the shared event/persistence path;
- runtime-integrity manifest generation and digest mismatch rejection;
- complete browser-runtime manifest coverage for native GUI, Console and explicit compatibility templates;
- runtime manifest production from GitHub Release asset digests in Pages;
- fresh-first service-worker handling for `/runtimes/` assets;
- the Pages concurrency rule that prevents runtime `workflow_run` events from cancelling a valid source-triggered deployment.

All existing language, formal, compiler, native, offline-link, Table and website gates remain in place.

# Patch 0.2.0-beta.34

Beta.34 is a Studio correctness, distribution-integrity and documentation release. It does not widen the beta.32 formal runtime-correspondence claim, change Change IR 0.10, redefine Native GUI IR 0.8 or change the sealed Table ABI from payload v9/runtime v1.0.

## What changed

### One canonical Studio project state

Patch Studio already had a versioned v2 project store, atomic pending-write promotion, migrations and recovery snapshots. A code review found that some programmatic edits in the older playground layer still wrote only the unversioned compatibility key. In particular, example switching and several Designer add/edit/delete paths could update the visible source without guaranteeing that the v2 project lifecycle observed the same edit.

Beta.34 adds a browser DOM synchronization bridge. After source- or project-kind-changing UI actions it checks whether the corresponding shared DOM signal was emitted. If a programmatic mutation changed the source without an `input`/`change` signal, the bridge emits the missing signals so the canonical v2 project lifecycle, Designer refresh, Change Contract refresh and other listeners see one consistent state. Modules that already emit the normal signals are not double-signalled.

The same bridge fixes a related product-state issue: switching between Console and Window examples now propagates the programmatic Project Type change to native-build UI state instead of leaving the native build panel configured for the previous project kind.

### Ready runtime integrity before browser sealing

Token-free Windows, macOS and Linux Window builds use published native runtime templates plus checked Native GUI IR. Beta.34 adds a fail-closed integrity layer to this path.

The Pages deployment now:

1. downloads the current native runtime v1.0 release assets;
2. reads the SHA-256 digest that GitHub records for each exact release asset;
3. independently hashes the downloaded bytes in `scripts/runtime-integrity-manifest.js`;
4. refuses deployment when an expected digest and the downloaded bytes disagree;
5. writes `_site/runtimes/runtime-manifest.json` containing the verified file, release tag and SHA-256 digest.

Before Patch Studio seals a Ready Window app, `web/runtime-integrity.js` hashes the fetched native runtime with Web Crypto SHA-256 and compares it with that deployed manifest. A mismatch stops the build before the runtime bytes are used.

This is an artifact-integrity consistency check. It does not claim Authenticode, Developer ID notarization, a separate transparency log or an independent trust root beyond the HTTPS/GitHub Pages and GitHub Release path already used by Patch Studio.

### Fresh runtime retrieval

The Patch Studio service worker previously treated `.exe` and `.bin` runtime files as ordinary cache-first assets. That could leave an old native runtime in a browser cache after the website moved to a newer published runtime.

Beta.34 treats every same-origin `/runtimes/` request as fresh-first. Successful responses are still retained for offline fallback, but an online build asks the current deployment for the runtime and integrity manifest before falling back to cached bytes.

### Download documentation

The Downloads page now makes the release model explicit:

- the offline compiler is a rolling beta release channel whose assets are replaced only by successful release workflows;
- the published `SHA256SUMS` file is the verification source for offline-compiler downloads;
- platform-specific verification examples are documented;
- the Ready Window runtime integrity path is documented separately from executable signing/notarization;
- direct links to the runtime v1.0 release records are available for users who want to inspect the exact native templates used by Patch Studio.

## Compatibility

Beta.34 keeps the following boundaries unchanged:

- Patch package: **0.2.0-beta.34**
- Change IR: **0.10**
- Native GUI IR base: **0.7**
- Native GUI IR Table extension: **0.8**
- direct native Table backend: **0.9**
- token-free sealed Table payload: **v9**
- token-free native Table runtime: **v1.0**
- project bundle: **v2**

Payload v8/runtime v0.9 remains the frozen responsive Native GUI IR 0.7 compatibility line.

## Regression gates

Beta.34 adds regression coverage for:

- programmatic Studio source/project-kind mutations reaching the shared event/persistence path;
- runtime-integrity manifest generation and digest mismatch rejection;
- runtime manifest production from GitHub Release asset digests in Pages;
- fresh-first service-worker handling for `/runtimes/` assets;
- the Pages concurrency rule that prevents runtime `workflow_run` events from cancelling a valid source-triggered deployment.

All existing language, formal, compiler, native, offline-link, Table and website gates remain in place.

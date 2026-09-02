# Patch Studio Offline Build Bridge

Status: **Stage 2 R0.1 security and execution contract**

Patch Studio Stage 2 needs host-native builds without turning the browser UI into a general process launcher. The initial bridge therefore exposes one narrow authenticated localhost request and delegates directly to Patch's existing host-native build API.

## Protocol

Protocol id: `patch-offline-build-bridge/0.1`

Endpoint: `POST /v1/build`

Request:

```json
{
  "protocol": "patch-offline-build-bridge/0.1",
  "action": "build-native-window",
  "requestId": "build-001",
  "source": "src/app.patch",
  "appName": "PatchApp"
}
```

No command, executable path, argument list, environment map, shell fragment or arbitrary output directory is accepted by this protocol.

## Security boundary

The R0.1 bridge enforces all of the following before invoking a native build:

- binds only to `127.0.0.1`;
- requires a per-launch bearer token of at least 24 bytes;
- compares bearer tokens with `crypto.timingSafeEqual`;
- accepts only `POST` and `application/json` on the single versioned build path;
- limits request bodies to 64 KiB by default;
- rejects unknown JSON fields and unsupported actions;
- accepts only relative `.patch` source paths;
- rejects traversal, absolute paths, Windows drive-relative forms and colon-bearing paths;
- canonicalizes the opened workspace and source with `realpath`;
- rejects source symlinks that resolve outside the opened workspace;
- chooses the output directory itself as `.patch-build/native/<requestId>`;
- rejects symbolic links or non-directory collisions in the output path before the builder is called;
- calls `buildNativeGuiForHost()` directly rather than exposing `child_process`, a shell command or a general command endpoint.

The existing native host dispatcher remains responsible for choosing Win32 on Windows, AppKit on macOS and GTK3 on Linux.

## Current scope

R0.1 establishes and tests the privileged boundary. It does **not** yet mean the published Offline Studio executable exposes a Build button backed by this server. The remaining Stage 2 integration work is:

1. package/install the compiler and current sealed host runtime beside Offline Studio;
2. add an explicit workspace-open authority in the installed product;
3. generate the per-launch bridge token inside the privileged host process;
4. pass only the bridge origin/token capability to the local Studio session;
5. connect the Studio Build UI to the versioned request contract;
6. return structured diagnostics and artifact metadata without leaking arbitrary filesystem authority;
7. self-smoke a real host-native build from the installed Windows, macOS and Linux Offline Studio distributions.

Cross-host arbitrary compilation is not part of the initial Stage 2 contract. The first goal is predictable host-native local build behavior with no GitHub token and no network dependency.

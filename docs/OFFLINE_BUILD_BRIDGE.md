# Patch Studio Offline Build Bridge

Status: **Stage 2 R0.2 integrated host-native build path with bounded project-v4 resource snapshots**

Patch Studio Stage 2 needs host-native builds without turning the browser UI into a general process launcher. The installed Offline Studio therefore exposes only a small authenticated localhost capability and delegates the actual link operation to the existing Patch Offline Compiler.

## Protocols

Build protocol: `patch-offline-build-bridge/0.2`

Build endpoint: `POST /v1/build`

Snapshot protocol: `patch-offline-workspace-snapshot/0.2`

Snapshot endpoint: `POST /v1/snapshot`

Artifact endpoint: `GET|HEAD /v1/artifacts/<opaque-id>`

A build request names only a previously materialized Patch input inside the opened workspace:

```json
{
  "protocol": "patch-offline-build-bridge/0.2",
  "action": "build-native-window",
  "requestId": "build-001",
  "source": ".patch-studio/snapshots/build-001/project.patchproject",
  "appName": "PatchApp"
}
```

The build input may be a bounded `.patch` compatibility snapshot or the preferred canonical `.patchproject` v4 snapshot. No command, executable path, argument list, environment map, shell fragment or arbitrary output directory is accepted by this protocol.

## Project-v4 snapshot contract

The preferred Stage 2 request sends the current canonical Studio project bundle:

```json
{
  "protocol": "patch-offline-workspace-snapshot/0.2",
  "requestId": "build-001",
  "project": {
    "format": "patch-studio-project",
    "version": 4,
    "project": {
      "name": "PatchApp",
      "kind": "window",
      "entry": "main.patch",
      "build": {
        "target": "native-linux",
        "nativeMode": "local"
      }
    },
    "files": [
      { "path": "main.patch", "content": "window \"PatchApp\":\n  text \"Ready\"\n" }
    ],
    "resources": []
  }
}
```

For resource-backed projects the existing project-v4 resource records are carried unchanged. The bridge does not invent a second resource manifest or accept browser-selected filesystem resource paths. Before materialization it independently validates resource ids, project-relative paths, media types, canonical base64, declared byte sizes and SHA-256 digests.

The host writes exactly one canonical project file under:

```text
.patch-studio/snapshots/<requestId>/project.patchproject
```

The existing Patch Offline Compiler then reads that file through the normal project-v4 input parser. Picture, ImageList and application/Form icon resources therefore use the same resource model as Studio export/import and the Current Ready offline linker.

The older source-only request shape remains accepted as a compatibility path and materializes to `main.patch`; installed Studio itself uses the project-v4 path.

## Installed Studio flow

When a matching compiler is packaged and Patch Studio is started with an explicit workspace:

```text
PatchStudio --workspace /path/to/project
```

or on Windows:

```text
PatchStudio.exe --workspace C:\path\to\project
```

Stage 2 performs this bounded flow:

1. the privileged runner canonicalizes the explicitly opened workspace;
2. the runner creates a random per-launch bearer token;
3. the local Studio session receives only the bridge origin, token and versioned endpoint names;
4. Studio obtains its already-canonical project-v4 state, including source files and resources;
5. `POST /v1/snapshot` revalidates that bundle and materializes one `.patchproject` under `.patch-studio/snapshots/<requestId>`;
6. `POST /v1/build` invokes the bundled SHA-256-pinned Patch Offline Compiler with a fixed `link <project> --name <name> --out <host-chosen-output>` shape;
7. the Offline Compiler reuses the normal project-v4 parser and Current Ready resource packaging path;
8. native output stays under `.patch-build/native/<requestId>`;
9. the bridge returns diagnostics plus artifact filename, type, size and SHA-256;
10. the browser downloads that exact artifact through an opaque authenticated artifact URL.

The browser never chooses the compiler executable, command line, environment, absolute source/resource path or absolute output path.

## Security boundary

The R0.2 bridge enforces all of the following:

- binds only to `127.0.0.1`;
- requires a per-launch bearer token of at least 24 bytes;
- compares bearer tokens with `crypto.timingSafeEqual`;
- restricts browser CORS access to the exact random local Studio origin;
- accepts only versioned snapshot/build/artifact routes;
- requires `application/json` for snapshot/build POST requests;
- bounds snapshot and build request bodies;
- rejects unknown top-level JSON fields and unsupported actions;
- accepts only relative `.patch` or `.patchproject` build inputs inside the opened workspace;
- rejects traversal, absolute paths, Windows drive-relative forms and colon-bearing paths;
- canonicalizes the opened workspace and build input with `realpath`;
- rejects source/build-input symlinks that resolve outside the opened workspace;
- creates snapshot/output directories itself and rejects symbolic-link path components;
- writes snapshots only under the opened workspace;
- limits project-v4 source files to 64, each source file to 2 MiB and aggregate source to 8 MiB;
- limits resources to 128, each resource to 2 MiB and aggregate decoded resource bytes to 8 MiB;
- accepts only the Studio image resource media types PNG, JPEG, WebP and SVG;
- validates canonical resource base64, declared resource byte size and SHA-256 before materialization;
- rejects resource/project paths that leave the project namespace;
- bounds the serialized project snapshot to 22 MiB and the HTTP snapshot request to 24 MiB;
- chooses the native output directory itself;
- validates produced artifacts as regular files inside the opened workspace;
- returns SHA-256 evidence for both the materialized snapshot and native artifact;
- exposes no `/command`, shell, arbitrary process, arbitrary environment or arbitrary filesystem API.

The HTTP bridge core contains no child-process execution. The host-only compiler adapter has exactly one process boundary: the bundled Patch Offline Compiler with fixed `link` arguments generated by the privileged runner.

## Packaged compiler boundary

The release workflow prepares matching host-native Offline Compiler bytes for these Offline Studio distributions:

- Windows x64;
- Linux x64;
- macOS Apple Silicon.

The compiler bytes are SHA-256 recorded in the runtime manifest and verified again when materialized for execution.

The following Offline Studio distributions remain fail-closed for installed host-native Build until a matching compiler/runtime distribution exists:

- Windows ARM64;
- Linux ARM64;
- macOS Intel runtime kit;
- generic portable Node bundle, including the FreeBSD compatibility path.

Those distributions retain Stage 1 authoring, Designer/Run and browser-local build targets.

## Current product limitations

R0.2 intentionally supports **Window** host-native builds only. Console and cross-host compilation are not exposed through the installed Studio bridge yet.

Project-v4 Picture, ImageList and application/Form icon resources are now carried through the installed host-native path. The resource snapshot is deliberately limited to the already-supported Studio image-resource model. Future non-image resource families must extend the canonical Studio resource contract first rather than adding bridge-only types.

## CI contract

For Windows x64, Linux x64 and macOS Apple Silicon, Offline Studio CI builds a matching Offline Compiler from the same repository revision and the Current Ready v1.10 native runtime, embeds it in the Offline Studio executable and runs the installed source-only self-smoke. The executable checker then performs an additional real resource-backed bridge/link smoke with an application icon and ImageList/Button image:

```text
canonical Studio project-v4 + image resources
  -> authenticated workspace project snapshot
  -> independent resource size/SHA-256 validation
  -> bundled offline compiler link
  -> Current Ready native resource packaging
  -> native host artifact
  -> authenticated artifact download
  -> SHA-256 equality check
```

The normal release manifest remains platform-neutral site-closure evidence. Host-specific compiler platform, architecture and compiler SHA-256 live only in the executable's embedded runtime manifest, so cross-platform release-manifest equality remains meaningful.

## Next Stage 2 work

- surface richer structured compiler diagnostics in the artifact pane;
- add installed host-build coverage when matching Windows ARM64, Linux ARM64 and macOS Intel compiler/runtime distributions become available;
- decide whether Console installed builds need a separate narrow action;
- keep remote/fresh CI Build as an optional separate target.

Cross-compiling every desktop platform from every host is not required for Stage 2. The first contract remains predictable host-native local Build with no GitHub token and no network dependency.

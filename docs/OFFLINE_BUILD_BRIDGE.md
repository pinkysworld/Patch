# Patch Studio Offline Build Bridge

Status: **Stage 2 R0.2 integrated host-native build path with bounded project-v4 resource snapshots, complete Linux desktop artifact packaging and structured compiler diagnostics**

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
6. `POST /v1/build` invokes the bundled SHA-256-pinned Patch Offline Compiler with a fixed `link <project> --name <name> --out <host-chosen-output> --diagnostics-json` shape;
7. the Offline Compiler reuses the normal project-v4 parser and Current Ready resource packaging path;
8. native output stays under `.patch-build/native/<requestId>`;
9. the host adapter converts platform output into one downloadable artifact when needed;
10. successful builds return human diagnostics plus artifact filename, type, size and SHA-256;
11. compiler failures may return a separately validated `patch-diagnostic` v1 object with code, phase and mapped source location;
12. the browser downloads a successful artifact through an opaque authenticated artifact URL.

The browser never chooses the compiler executable, command line, environment, absolute source/resource path or absolute output path.

## Structured compiler diagnostic contract

Installed builds reuse Patch's existing `patch-diagnostic` version 1 contract. There is no Offline-Studio-only diagnostic schema.

The packaged compiler is invoked with the opt-in `--diagnostics-json` flag. On a link failure it still emits the existing human-readable stderr and additionally emits one machine-readable record. The host adapter separates that record from the human output. The bridge then validates it independently before it may cross the privileged boundary.

A validated compiler failure is returned as HTTP `422`:

```json
{
  "ok": false,
  "error": "build-diagnostic",
  "message": "Bundled Patch offline compiler exited with status 2: ...",
  "diagnostic": {
    "format": "patch-diagnostic",
    "version": 1,
    "code": "PATCH1001",
    "severity": "error",
    "phase": "build",
    "message": "I do not understand 'frobnicate score'.",
    "location": {
      "entry": "main.patch",
      "file": "logic/reward.patch",
      "line": 2,
      "column": 3
    }
  }
}
```

For project-v4 input, the Offline Compiler preserves Studio composition metadata long enough for the generic diagnostic mapper to translate a composed source line back to the owning project file and local line. Single-file inputs use their normal entry location.

The bridge accepts only the exact diagnostic fields, requires `PATCH` plus four digits for the code, requires error severity, bounds the phase and message, and allows only safe relative entry/file paths with positive line/column values. Unknown diagnostic fields, absolute paths, drive paths, traversal segments or malformed objects are discarded rather than trusted.

The structured response does not contain project source text. Studio renders code, file/entry, line, column, phase and message in the Output tab and retains the previous plain-text fallback for non-compiler or malformed failures.

## Platform artifact contract

The artifact bridge itself still exposes exactly one regular file per completed build.

- Windows x64 returns the generated `.exe` directly.
- macOS Apple Silicon returns the generated `.app` as a `.app.zip` archive.
- Linux x64 without application-icon sidecars returns the native executable directly.
- Linux x64 with Current Ready application-icon packaging returns `<stem>-linux.tar.gz` containing the executable, its hicolor PNG and its `.desktop` entry.

The Linux archive exists only because the normal linker output is multi-file. It is built by the privileged Node adapter from fixed linker-owned paths rather than from browser-selected paths or a general archive command. The archive entry set is bounded to:

```text
<stem>
share/icons/hicolor/<size>x<size>/apps/<stem>.png
share/applications/<stem>.desktop
```

The adapter fails closed if only part of that Linux desktop set exists. Archive names reject absolute paths, traversal segments and duplicates. Tar metadata, gzip timestamp bytes and gzip OS-header bytes are normalized for deterministic output.

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
- independently validates and bounds any structured compiler diagnostic before returning it;
- never includes source text merely to provide a structured diagnostic;
- when Linux desktop sidecars exist, packages only fixed safe relative entries and fails closed on an incomplete set;
- exposes no `/command`, shell, arbitrary process, arbitrary environment or arbitrary filesystem API.

The HTTP bridge core contains no child-process execution. The host-only compiler adapter has exactly one compiler process boundary: the bundled Patch Offline Compiler with fixed `link` arguments generated by the privileged runner. macOS additionally uses the fixed system `ditto` archiver for `.app` packaging; Linux desktop packaging is implemented directly in Node and adds no archive-process surface.

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

Structured compiler diagnostics currently carry one primary error record. Rich multi-error lists, warnings and quick-fix actions are outside this R0.2 bridge response and can build on the same versioned diagnostic family later.

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

On Linux x64 the application-icon fixture necessarily traverses the complete `.tar.gz` artifact path, because the normal Current Ready linker emits the executable plus hicolor PNG and `.desktop` sidecars. Dedicated unit tests verify deterministic archive bytes, exact entry paths and modes, content preservation, direct-executable compatibility when no sidecars exist, and fail-closed behavior for incomplete or unsafe bundles.

Structured-diagnostic tests additionally exercise a real multi-file project-v4 `patch link --diagnostics-json` failure, verify file/line mapping, machine-record extraction, independent bridge validation, HTTP 422 transport, source omission and installed-client rendering markers.

The normal release manifest remains platform-neutral site-closure evidence. Host-specific compiler platform, architecture and compiler SHA-256 live only in the executable's embedded runtime manifest, so cross-platform release-manifest equality remains meaningful.

## Next Stage 2 work

- add installed host-build coverage when matching Windows ARM64, Linux ARM64 and macOS Intel compiler/runtime distributions become available;
- decide whether Console installed builds need a separate narrow action;
- consider richer multi-error/warning diagnostic lists and source-navigation actions on top of `patch-diagnostic` v1;
- keep remote/fresh CI Build as an optional separate target.

Cross-compiling every desktop platform from every host is not required for Stage 2. The first contract remains predictable host-native local Build with no GitHub token and no network dependency.

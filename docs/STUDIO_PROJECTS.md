# Patch Studio projects

Patch Studio project files use the `.patchproject` extension and a small versioned JSON format. The goal is to make a Studio project portable without turning browser storage into an undocumented archival format.

## Project bundle v4

The current format is `patch-studio-project` version `4`. Versions 1, 2 and 3 remain explicit migration inputs and are normalized to v4 when Studio loads them. Unknown future versions fail closed.

A v4 bundle contains:

- project name;
- project kind (`console` or `window`);
- the project entry path;
- centralized build target and native-build mode;
- one or more bounded `.patch` source files;
- zero or more bounded project resources.

Source files remain ordinary Patch source. Resources are explicit project data with logical ids, project-relative paths, media type, byte size, SHA-256 digest and canonical base64 bytes. The bundle does not add a second hidden Form/UI mutation model.

Example:

```json
{
  "format": "patch-studio-project",
  "version": 4,
  "project": {
    "name": "Counter",
    "kind": "window",
    "entry": "main.patch",
    "build": {
      "target": "web",
      "nativeMode": "prebuilt"
    }
  },
  "files": [
    {
      "path": "main.patch",
      "content": "window \"Counter\" as main:\n  picture as logo from \"patch-resource:app.logo\"\n"
    }
  ],
  "resources": [
    {
      "id": "app.logo",
      "path": "resources/logo.png",
      "mediaType": "image/png",
      "size": 1234,
      "sha256": "<64 lowercase hex characters>",
      "data": "<canonical base64>"
    }
  ]
}
```

## Resource contract

The current Studio image-resource model supports PNG, JPEG, WebP and SVG project resources. Resource ids and paths are normalized and bounded. Duplicate ids/paths, invalid media types, oversized resources and malformed/non-canonical base64 fail closed.

The project resource store is shared by the Resource Manager and source-backed graphics components. A source reference uses the logical locator form:

```patch
picture as logo from "patch-resource:app.logo"

imagelist as toolbar_images size 16, 16:
  image open from "patch-resource:icons.open"
```

The `.patch` source stores only the logical locator. Resource bytes remain in the explicit v4 project bundle.

Resource SHA-256 metadata is deterministic. Verification helpers can recompute the digest rather than trusting stored metadata blindly.

## Multi-file build contract

For compilation and execution, Studio validates the whole bundle and composes one source stream. The entry file is first, followed by the other project files in stored order. Blank-line separators prevent accidental token joining.

Resources are not concatenated into Patch source. They are supplied separately to build/runtime adapters through project build input.

The composition records a line segment for every source file. `mapStudioProjectLine` maps a compiler/runtime line in the composed stream back to the owning project file and local source line. Studio diagnostics, Run/Build output, Change Contract, `.patchreport` and native preflight errors consume that mapping and display `file:line` without changing Patch syntax.

The current UI keeps `main.patch` as the normal entry created by Studio. Other `.patch` files can contain Forms, state, events or recipes and participate in the same program.

## Compatibility and safety rules

Patch Studio validates an imported project before replacing current editor state.

- Unknown project formats are rejected.
- Future schema versions are rejected rather than interpreted heuristically.
- Absolute paths, traversal such as `..`, duplicate files and missing entry files are rejected.
- Only `.patch` files are accepted in the source set.
- Versions 1 and 2 remain single-file schemas and still accept exactly one `main.patch`.
- Version 3 remains a multi-file source schema and migrates to v4 with `resources: []`.
- Each source, the source set, each resource, total resource bytes and resource count are bounded.
- Resource ids, paths, media types, digests and canonical base64 are validated.

The earlier unversioned local-storage shape `{ name, kind, code }` migrates automatically into a v4 project with `main.patch` and no resources. This is an explicit legacy-storage migration, not permission to guess at arbitrary future bundle versions.

## Local storage and recovery

Studio keeps the canonical v4 project in browser storage and retains migration readers for v3, v2, v1 and the older scalar local-storage shape.

Canonical saves use a pending-write key before promotion to the current-project key. If a session stops between those writes, the next Studio load promotes a valid pending project. Once migration succeeds, obsolete canonical keys are removed.

The active editor file is synchronized into the canonical bundle before Studio changes files, exports, runs, builds or captures recovery. Resource mutations use the same validated bundle rebuild path. Import and recovery restore both the complete file set and resources.

Studio keeps up to five de-duplicated recovery snapshots. Normal editing periodically captures the previous project. Import, file/resource-set changes and restore operations protect the previous project before replacement.

The **Recovery** manager exposes project metadata plus source/resource counts and byte totals. Recovery mutation remains centralized in the project lifecycle module so import, autosave and manual recovery share the same validation rules.

Recovery is a convenience feature, not a backup service. Export important projects to `.patchproject` files and retain them outside browser storage.

## Current boundary

Project bundle v4 establishes deterministic portable project resources. It does not imply that every resource-consuming control has cross-target parity. Target capability gates remain component-specific: current native Picture follows `native-picture-formats/1.0` (Ready PNG/JPEG, deferred WebP/SVG), Shape/PaintBox native parity remains open, and ImageList is Web metadata for Button `image list.item` while native GUI IR 1.4 still fail-closes ImageList and Button images.

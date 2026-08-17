# Patch Studio projects

Patch Studio project files use the `.patchproject` extension and a small versioned JSON format. The goal is to make a Studio project portable without turning browser storage into an undocumented archival format.

## Project bundle v3

The current format is `patch-studio-project` version `3`. Versions 1 and 2 remain explicit migration inputs; they are normalized to v3 when Studio loads them.

A v3 bundle contains:

- project name;
- project kind (`console` or `window`);
- the project entry path;
- centralized build target and native-build mode;
- one or more bounded `.patch` source files.

The source files remain ordinary Patch source. The bundle does not add a second hidden UI or mutation model. Studio composes project files deterministically for Run/Build while the editor and Designer continue to edit the selected source file itself.

Example:

```json
{
  "format": "patch-studio-project",
  "version": 3,
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
      "content": "create number count = 0\n"
    },
    {
      "path": "forms/main.patch",
      "content": "window \"Counter\" as main:\n  text \"Count: {count}\"\n"
    }
  ]
}
```

## Multi-file build contract

For compilation and execution, Studio validates the whole bundle and composes one source stream. The entry file is first, followed by the other project files in their stored order. Blank-line separators prevent accidental token joining.

The composition records a line segment for every source file. `mapStudioProjectLine` can map a compiler/runtime line in the composed stream back to the owning project file and local source line. This creates the provenance boundary needed for richer cross-file diagnostics without changing Patch syntax.

The current Stage 2 UI keeps `main.patch` as the normal entry created by Studio. Other `.patch` files can contain Forms, state, events or recipes, and their declarations participate in the same program. A repository test composes three separate files, compiles the resulting Window program, executes it in the Patch interpreter and dispatches an event declared in another file.

## Compatibility and safety rules

Patch Studio validates an imported project before replacing the current editor state.

- Unknown project formats are rejected.
- Future schema versions are rejected rather than interpreted heuristically.
- Absolute paths, traversal such as `..`, duplicate files and missing entry files are rejected.
- Only `.patch` source files are accepted in the v3 source set.
- Versions 1 and 2 remain single-file schemas and still accept exactly one `main.patch`; multi-file content cannot be smuggled into an old schema version.
- Each source is size-bounded, the whole project is size-bounded, and the source-file count is bounded.

The earlier unversioned local-storage shape `{ name, kind, code }` migrates automatically into a v3 project with `main.patch`. This is an explicit legacy-storage migration, not permission to guess at arbitrary future bundle versions.

## Local storage and recovery

Studio keeps the canonical v3 project in browser storage and retains migration readers for v2, v1 and the older scalar local-storage shape.

Canonical saves use a pending-write key before promotion to the current-project key. If a session stops between those writes, the next Studio load promotes a valid pending project. Once migration succeeds, obsolete v2/v1 canonical keys are removed.

The active editor file is synchronized into the canonical bundle before Studio changes files, exports, runs, builds or captures recovery. Other project files remain untouched. Import and recovery restore the complete file set, not just `main.patch`.

Studio keeps up to five de-duplicated recovery snapshots. Normal editing periodically captures the previous project. Import, file-set changes and restore operations protect the previous project before replacement.

The **Recovery** manager shows the project name, timestamp, project kind, build target, source-file count and total source bytes for each local restore point. From the manager you can:

- create a snapshot immediately with **Snapshot now**;
- **Restore** any retained snapshot, while first protecting the current project as another recovery snapshot;
- **Export** an individual snapshot as a normal `.patchproject` file;
- **Delete** one snapshot;
- **Clear all** local recovery snapshots after confirmation.

The manager does not read browser storage directly. Recovery mutation remains centralized in the project lifecycle module, so import, periodic autosave and manual recovery use the same validation and bounded snapshot rules.

Recovery is a convenience feature, not a backup service. Export important projects to `.patchproject` files and retain them outside browser storage.

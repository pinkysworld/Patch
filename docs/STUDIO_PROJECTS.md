# Patch Studio projects

Patch Studio project files use the `.patchproject` extension and a small versioned JSON format. The goal is to make a Studio project portable without turning browser storage into an undocumented archival format.

## Project bundle v1

The current format is `patch-studio-project` version `1`.

A v1 bundle contains:

- project name;
- project kind (`console` or `window`);
- entry path `main.patch`;
- exactly one text source file, `main.patch`.

The source remains ordinary Patch source. The bundle does not add a second hidden UI or mutation model.

Example:

```json
{
  "format": "patch-studio-project",
  "version": 1,
  "project": {
    "name": "Counter",
    "kind": "window",
    "entry": "main.patch"
  },
  "files": [
    {
      "path": "main.patch",
      "content": "window \"Counter\":\n  text \"Hello\"\n"
    }
  ]
}
```

## Compatibility rules

Patch Studio validates an imported project before replacing the current editor state.

- Unknown project formats are rejected.
- Future schema versions are rejected rather than interpreted heuristically.
- Absolute paths, traversal such as `..`, duplicate files and missing entry files are rejected.
- Project v1 accepts exactly one `main.patch` source file.
- Source size is bounded before it enters Studio storage.

The earlier unversioned local-storage shape `{ name, kind, code }` is migrated automatically into project bundle v1. This is a legacy-storage migration, not a promise that arbitrary future bundle versions will be migrated automatically.

## Local storage and recovery

Studio keeps a canonical v1 project in browser storage and maintains compatibility with the old local-storage key while beta.32 remains in use.

Canonical saves use a pending-write key before promotion to the current-project key. If a session stops between those writes, the next Studio load promotes the valid pending project.

Studio also keeps up to five de-duplicated recovery snapshots. Normal editing periodically captures the previous project. Import and restore capture the current project immediately before replacing it.

The **Recovery** manager exposes those local snapshots instead of hiding the ring behind a one-shot newest-snapshot button. It shows the project name, timestamp, project kind and source size for each local restore point. From the manager you can:

- create a snapshot immediately with **Snapshot now**;
- **Restore** any retained snapshot, while first protecting the current project as another recovery snapshot;
- **Export** an individual snapshot as a normal `.patchproject` file;
- **Delete** one snapshot;
- **Clear all** local recovery snapshots after confirmation.

The manager does not read browser storage directly. Recovery mutation remains centralized in the project lifecycle module, so import, periodic autosave and manual recovery use the same validation and bounded snapshot rules.

Recovery is a convenience feature, not a backup service. Export important projects to `.patchproject` files and retain them outside browser storage.

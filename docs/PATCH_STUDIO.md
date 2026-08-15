# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.34

Patch Studio provides source editing and local autosave, Console and Window Run, a source-backed visual Designer, named Forms, direct Form and control drag/resize layout, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Table controls, Tabs, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

The public website is split into focused **Studio**, **Language**, **Documentation**, **Downloads** and **Help** pages. The Studio page itself no longer carries the long language/research landing content underneath the IDE.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required. The optional cloud/AOT route remains separate and does not persist its GitHub token.

Patch package **0.2.0-beta.34** keeps Change IR **0.10**. The beta.32 invocation-frame assurance result remains the current formal runtime-correspondence milestone; beta.34 is a Studio correctness, distribution-integrity and documentation release.

## One canonical Studio state

The canonical browser project is still the version-2 `patch-studio-project` bundle. Beta.34 fixes a code-review finding in older Studio integration code: some programmatic sample/Designer mutations could update visible `main.patch` and only the unversioned compatibility key, while the canonical v2 lifecycle was waiting for the same DOM `input`/`change` signals used by normal typing.

`web/studio-dom-sync.js` now closes that gap. After Studio UI actions it checks whether source or Project Type changed without the normal shared signal. It emits only the missing signal, so modules that already behave correctly are not double-triggered. Programmatic source edits therefore reach the same canonical v2 persistence, recovery, Designer and Change Contract path as manual source editing.

This also keeps the native build panel synchronized when sample switching changes a project from Console to Window or back.

## Source-backed Forms and controls

Form dimensions, top-level geometry, labels, ids, options, Table rows, Tabs page structure and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent form document.

A selected control can be moved and resized visually. A Form itself has a lower-right resize grip in the Designer. Pointer resizing and keyboard resizing both write the resulting `window ... size W, H:` values back into Patch source. Forms may grow beyond the currently visible Designer width; the Designer remains scrollable instead of clamping a Form back to the viewport.

GUI interaction does not implicitly persist state. Input/ComboBox/ListBox/Radio expose transient text `value`; Checkbox exposes transient Boolean `value`; Table `changed` exposes a transient row list in Studio App Preview, Standalone Web, direct native AOT, token-free Ready apps and supported offline-linked Windows/macOS/Linux Window apps. Persistent state changes only through an explicit Patch `change`.

Tabs page selection remains transient renderer/toolkit state and creates no Patch variable or Change History entry.

## Table / Grid

Table is source-backed:

```patch
window "People" as main size 520, 320:
  # @layout anchor left right top
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
```

Current Table support by surface:

- Designer: add/select/move/resize/rename/remove while preserving row lines;
- Standalone Web: real Table plus mouse/keyboard row selection and transient list-valued `value`;
- Studio App preview: real Table plus mouse/keyboard row selection routed through the same shared semantic Window event adapter, with a copied transient row-list value and no implicit persistent state;
- direct native AOT: Native GUI IR **0.8** / backend **0.9** maps Table to real Win32/AppKit/GTK widgets and is compiled/executed by a dedicated three-platform CI matrix;
- Ready/no-token sealed apps: Native GUI IR **0.8** is sealed as payload **v9** into native runtime **v1.0** on Windows, macOS and Linux;
- offline `patch link`: the downloadable Windows/macOS/Linux compiler embeds the same runtime **v1.0** and emits payload **v9** Table applications locally.

The v1.0 sealed-runtime matrix and the ordinary offline-linker path both compile, seal and execute the Table example on Windows, macOS and Linux. Payload v8/runtime v0.9 remains an explicit compatibility line rather than being redefined in place. FreeBSD Window remains unsupported.

## Project format v2

Patch Studio project bundles use `patch-studio-project` **version 2**.

Patch Studio v2 is a canonical project bundle that stores:

- project name;
- Console/Window kind;
- `main.patch` source;
- selected build target;
- selected native build mode.

Version 1 bundles remain readable and are explicitly migrated to version 2 with the historical defaults `web` + `prebuilt`. Unknown future project versions are rejected rather than guessed.

Local canonical storage moves to `patchStudio.project.v2`. Existing v1 and simple legacy stores are migration inputs. Recovery snapshots also normalize embedded v1 projects to v2. Import and restore protect the current project before replacement. The unversioned `patchStudio.project` entry is retained only as a compatibility mirror for older Studio code and migration, not as the authoritative project state.

## Recovery and local diagnostics

The Recovery manager keeps up to five deduplicated local snapshots. It supports Snapshot now, Restore, Export, Delete and Clear all.

`Copy diagnostics` and `.patchreport` provide a local privacy-redacted support bundle. Reports include version, target, source size/hash, compiler state, browser/PWA state and bounded recent errors, but do not include project source. Tokens, common user paths, email addresses and exact echoed source lines are redacted. No diagnostics upload path exists in Studio.

## Menus and result-bearing dialogs

Native GUI **0.7** includes menus, informational dialogs and result-bearing Confirm/Open/Save dialog flows with explicit transient result semantics. Sealed payload **v8** / runtime **v0.9** remains the responsive Native GUI IR 0.7 compatibility line. Current Ready Window builds use payload **v9** / runtime **v1.0**, which preserves that existing menu/dialog/radio/tabs and Anchor/Dock contract while adding the Native GUI IR 0.8 Table metadata and transient `text-list` event type.

Menus are Window structure, not positioned Designer controls. Transient dialog and Table-selection results do not create hidden persistent state; persistent changes still require explicit Patch `change` operations.

## Direct native desktop path

The stable direct-native surface uses checked **Native GUI IR 0.7** / backend **0.8**. Table is the first opt-in Native GUI IR **0.8** / backend **0.9** extension.

Current direct-native mappings include:

- Text/Button/Input/Checkbox on Win32, AppKit and GTK3;
- ComboBox as Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox as Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Radio as Win32 `BS_AUTORADIOBUTTON`, AppKit `NSButtonTypeRadio`, GTK3 `GtkRadioButton`;
- Tabs as Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Table as Win32 report-mode `WC_LISTVIEWW`, AppKit multi-column `NSTableView`, GTK3 `GtkTreeView`/`GtkListStore` on backend 0.9;
- Menu as Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- native dialogs through each platform toolkit;
- named Form open/close lifecycle;
- typed transient values and explicit semantic changes.

The `Native Table v0.9` workflow compiles and runs the same Table app on Windows, macOS and Linux and checks native row-selection dispatch. Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Native build resilience and runtime integrity

The optional GitHub Actions cloud/AOT path supports explicit Cancel, a 15-minute timeout and Retry. Retry uses the original in-memory build snapshot and a new request identity rather than silently rebuilding changed editor contents.

The token-free Ready-app path remains the default. Windows, Linux and macOS Ready Window downloads lower Native GUI IR 0.8 in the browser and seal payload v9 into runtime v1.0. The runtime uses real native Table widgets while retaining runtime-v0.9 accessibility and responsive Anchor/Dock behavior.

Beta.34 adds a fail-closed integrity gate to those Ready Window runtime templates:

1. Pages downloads the three runtime-v1.0 release assets.
2. It reads each SHA-256 `digest` recorded by GitHub for the exact release asset.
3. `scripts/runtime-integrity-manifest.js` independently hashes the downloaded file and rejects a mismatch.
4. Pages publishes `runtimes/runtime-manifest.json` only with the verified file name, release tag and digest.
5. `web/runtime-integrity.js` hashes the fetched runtime again with Web Crypto before `native-build.js` can seal a Patch payload into it.

A digest mismatch stops the build. This is byte-integrity validation for the existing release/deployment trust path. It does not claim Authenticode, Developer ID/notarization or an independent signing authority.

Pages also waits for all three v1.0 runtime releases before replacing the deployed Studio, so a runtime-publication race does not publish a mismatched browser compiler/runtime set. Signing/notarization remains a separate distribution concern.

## PWA updates

Patch Studio Pages builds derive a deterministic content revision from every browser-facing page, Studio asset and browser compiler/runtime module. Generated CSS, JavaScript, manifest and icon references carry that revision, and the Service Worker uses the same revision as its active cache identity.

The worker bypasses the browser HTTP cache when checking code/UI assets. Beta.34 extends the same fresh-first behavior to same-origin `/runtimes/` requests, including the runtime integrity manifest and native `.exe`/`.bin` templates. Successful runtime responses may still be retained for offline fallback, but an online Ready build does not silently prefer an old cached runtime.

An already-controlled Studio page reloads once when a newly activated worker takes control. Old beta-specific caches are migration inputs only; the active cache is content-addressed.

## Beta.32 research boundary

The ordinary Studio does not need Lean or expose beta.32 proof machinery. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

The reproducible evidence set includes `GeneratedRepeatedTransitiveRuntimeCertificate.lean`. Beta.34 Studio/distribution work does not expand those assurance claims. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Production-readiness additions

The current Studio/repository also includes:

- stable `PATCHxxxx` diagnostics with line/column locations;
- versioned CLI JSON results while preserving existing exit codes;
- deterministic tagged-release manifests and checksum verification;
- SHA-256 verification for the native runtime templates used by browser-side Ready Window sealing;
- CodeQL, Dependabot for GitHub Actions and repository security-policy checks;
- deterministic parser/compiler fuzzing;
- Interpreter/direct-Wasm/executable-C99 differential tests;
- property-based Change/History/Undo/Redo tests;
- source-compatibility corpus and logical artifact reproducibility checks.

## Next work

The next product stages include distribution signing/notarization, installers, broader generated-Window accessibility auditing, richer project trees/source-file support, richer data controls, ListBox multi-selection, richer Menu state and additional native packaging polish.

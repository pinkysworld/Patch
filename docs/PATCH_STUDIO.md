# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.33

Patch Studio provides source editing and local autosave, Console and Window Run, a source-backed visual Designer, named Forms, direct Form and control drag/resize layout, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio controls, Tabs, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

The public website is split into focused **Studio**, **Language**, **Documentation** and **Help** pages. The Studio page itself no longer carries the long language/research landing content underneath the IDE.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required. The optional cloud/AOT route remains separate and does not persist its GitHub token.

Patch package **0.2.0-beta.33** keeps Change IR **0.10**. The beta.32 invocation-frame assurance result remains the current formal runtime-correspondence milestone; beta.33 is primarily a Studio, project-format and production-readiness release.

## Source-backed Forms and controls

Form dimensions, top-level geometry, labels, ids, options, Tabs page structure and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent form document.

A selected control can be moved and resized visually. A Form itself now has a lower-right resize grip in the Designer. Pointer resizing and keyboard resizing both write the resulting `window ... size W, H:` values back into Patch source. Forms may grow beyond the currently visible Designer width; the Designer remains scrollable instead of clamping a Form back to the viewport.

GUI interaction does not implicitly persist state. Input/ComboBox/ListBox/Radio expose transient text `value`; Checkbox exposes transient Boolean `value`; persistent state changes only through an explicit Patch `change`.

Tabs page selection remains transient renderer/toolkit state and creates no Patch variable or Change History entry.

## Project format v2

Patch Studio project bundles use `patch-studio-project` **version 2**.

The canonical project bundle stores:

- project name;
- Console/Window kind;
- `main.patch` source;
- selected build target;
- selected native build mode.

Version 1 bundles remain readable and are explicitly migrated to version 2 with the historical defaults `web` + `prebuilt`. Unknown future project versions are rejected rather than guessed.

Local canonical storage moves to `patchStudio.project.v2`. Existing v1 and simple legacy stores are migration inputs. Recovery snapshots also normalize embedded v1 projects to v2. Import and restore protect the current project before replacement.

## Recovery and local diagnostics

The Recovery manager keeps up to five deduplicated local snapshots. It supports Snapshot now, Restore, Export, Delete and Clear all.

`Copy diagnostics` and `.patchreport` provide a local privacy-redacted support bundle. Reports include version, target, source size/hash, compiler state, browser/PWA state and bounded recent errors, but do not include project source. Tokens, common user paths, email addresses and exact echoed source lines are redacted. No diagnostics upload path exists in Studio.

## Menus and result-bearing dialogs

Native GUI **0.7** includes menus, informational dialogs and result-bearing Confirm/Open/Save dialog flows with explicit transient result semantics. Native Window payload **v7** carries the corresponding menu/dialog/radio/tabs data needed by Win32, AppKit and GTK runtimes.

Menus are Window structure, not positioned Designer controls. Transient dialog results do not create hidden persistent state; persistent changes still require explicit Patch `change` operations.

## Direct native desktop path

The recommended native Window path uses checked **Native GUI IR 0.7**.

Current direct-native mappings include:

- Text/Button/Input/Checkbox on Win32, AppKit and GTK3;
- ComboBox as Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox as Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Radio as Win32 `BS_AUTORADIOBUTTON`, AppKit `NSButtonTypeRadio`, GTK3 `GtkRadioButton`;
- Tabs as Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Menu as Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- native dialogs through each platform toolkit;
- named Form open/close lifecycle;
- typed transient values and explicit semantic changes.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Native build resilience

The optional GitHub Actions cloud/AOT path supports explicit Cancel, a 15-minute timeout and Retry. Retry uses the original in-memory build snapshot and a new request identity rather than silently rebuilding changed editor contents.

The token-free ready-app path remains the default. The Windows Window path can seal Native GUI IR directly into a native Win32 runtime in the browser; Linux and macOS use corresponding GTK/AppKit runtime packaging. Signing/notarization remains a separate distribution concern.

## PWA updates

Patch Studio Pages builds derive a deterministic content revision from every browser-facing page, Studio asset and browser compiler/runtime module. Generated CSS, JavaScript, manifest and icon references carry that revision, and the Service Worker uses the same revision as its active cache identity.

The worker bypasses the browser HTTP cache when checking code/UI assets. An already-controlled Studio page reloads once when a newly activated worker takes control. Old beta-specific caches are migration inputs only; the active cache is content-addressed.

## Beta.32 research boundary

The ordinary Studio does not need Lean or expose beta.32 proof machinery. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

The reproducible evidence set includes `GeneratedRepeatedTransitiveRuntimeCertificate.lean`. Beta.33 Studio/project work does not expand those assurance claims. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Production-readiness additions

The current Studio/repository also includes:

- stable `PATCHxxxx` diagnostics with line/column locations;
- versioned CLI JSON results while preserving existing exit codes;
- deterministic tagged-release manifests and `SHA256SUMS.txt` verification;
- CodeQL, Dependabot for GitHub Actions and repository security-policy checks;
- deterministic parser/compiler fuzzing;
- Interpreter/direct-Wasm/executable-C99 differential tests;
- property-based Change/History/Undo/Redo tests;
- source-compatibility corpus and logical artifact reproducibility checks.

## Next work

The next product stages include distribution signing/notarization, installers, broader generated-Window accessibility auditing, richer project trees/source-file support, alignment/docking tools, Table/Grid controls and additional native packaging polish.

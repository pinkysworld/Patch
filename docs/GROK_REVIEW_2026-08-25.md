# Grok implementation review, 2026-08-25

This review covers the recent Patch Studio and Native GUI changes present on `main` through commit `89b89e108dbf0b1ea316b6755b7145a3b02c2d5c`.

## Summary

The recent work is useful and much of the architecture is sound, but the product surface was not fully integrated after the Native GUI 1.4 / payload v14 / runtime v1.5 change. Several statements described functionality more strongly than the runtime implementation supported.

## Correctly implemented or substantially correct

- `src/native-current-contract.js` consistently selects Native GUI IR 1.4, payload v14 and runtime v1.5.
- Runtime v1.5 binaries are built and smoke-tested on Win32, AppKit and GTK.
- Timer Stage 1 has a native scheduling mechanism on all three desktop backends.
- Win32 StatusBar uses a native status control and GTK uses `GtkStatusbar`.
- Panel Stage 1 has native visual group-box/frame representation.
- The source-backed form model remains intact. Designer operations continue to rewrite Patch source rather than storing a second hidden layout representation.
- The recent square Studio P removed the older explicit rotation.
- Existing Designer multi-selection, snapping, Z-order and source-backed form operations are a solid base for a Delphi/VB-style RAD workflow.

## Integration defects found

### 1. Current native contract versus public Ready contract

`src/native-current-contract.js` was advanced to IR 1.4 / payload v14 / runtime v1.5, while the public Studio, downloads documentation, Pages runtime acquisition and offline compiler workflow still advertised or built IR 1.3 / payload v13 / runtime v1.4.

Impact: the repository had two different answers to the question “what is the current native compiler contract?”

Beta.36 aligns the public and offline paths with the current facade.

### 2. Offline compiler workflow was stale

The offline workflow still compiled the v1.4 native sources and explicitly rejected outputs that were not payload v13. That contradicts the current compiler facade, which emits payload v14.

Impact: a current compiler could produce v14 while the workflow asserted v13, making the pipeline internally inconsistent.

Beta.36 builds v1.5 runtimes and asserts payload v14, including a Chrome Stage 1 link/smoke case.

### 3. PictureBox source is transported but not rendered

IR 1.4 and payload v14 carry a PictureBox `source`. However, the reviewed v1.5 desktop runtimes do not consume that source as an actual image:

- Win32 creates a text `STATIC` shell.
- AppKit creates a button-like shell rather than loading the image source into an image view.
- GTK creates a button-like shell rather than loading the source into an image widget.

The smoke tests prove that the control shell and event path exist. They do not prove image loading.

Impact: claiming complete PictureBox image-source support is currently too strong.

Required follow-up: define a portable source contract, load/decode the source on all three platforms, add positive and invalid-source tests, and only then describe PictureBox source rendering as Ready.

### 4. Panel is visual grouping, not full containment semantics

The v1.4 compatibility projection hoists Panel children into the form-level compatibility representation. Runtime v1.5 restores a visual panel/group box around those controls, but does not establish a full native parent/container relationship for the children.

Impact: Panel Stage 1 is suitable as visual grouping, but should not yet be documented as a Delphi-style container with inherited clipping, coordinate space and lifetime semantics.

### 5. StatusBar backend parity differs

Win32 and GTK use status-specific widgets. AppKit uses a text-field representation.

Impact: the semantic contract can remain portable, but “same native widget class on every platform” must not be implied.

### 6. New v1.5 controls were not carried through the full Studio authoring path

Parser, compiler and native lowering support were added before equivalent visual toolbox/inspector authoring was completed. The main Studio toolbox still exposed the earlier control set.

Impact: users can write some new controls in source, but cannot yet expect a complete drag-and-drop RAD workflow for all Chrome Stage 1 components.

Beta.36 therefore improves the existing reliable Designer surface first, with expanded multi-control arrangement operations, rather than exposing controls whose browser authoring/preview path is not yet complete.

## Test quality notes

The v1.5 workflow is valuable because it builds and launches all three desktop runtimes. Its Chrome smoke checks should be strengthened in a later change so each new component proves behavior, not merely construction. In particular:

- PictureBox should assert decoded image content or dimensions from a known fixture.
- Timer should prove automatic delivery rather than only allowing manual event dispatch in supporting tests.
- Panel should gain tests for the final containment contract once that contract is defined.
- StatusBar should prove state/text refresh after an event-driven change.

## RAD direction after beta.36

The safest path toward Delphi/Visual Basic is incremental and source-backed:

1. Object Inspector with complete Properties and Events editing.
2. Alignment/sizing/distribution commands, started in beta.36.
3. Tab order and focus order editor.
4. Component palette search/categories and favorites.
5. Event-handler generation by double-click / Events inspector.
6. True container semantics for Panel and future GroupBox/ScrollBox components.
7. Resource/image management with a defined portable asset contract.
8. Form inheritance or reusable visual components only after the source representation is designed explicitly.

This preserves Patch's key property: the Patch program remains the authoritative representation of behavior and UI structure.

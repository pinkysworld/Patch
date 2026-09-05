# Patch Studio Showcase

`patch-studio-showcase.patchproject` is the canonical acceptance project for the **complete current Patch Studio authoring surface**.

It complements, rather than replaces, `examples/workshop-desk.patch`:

- **Workshop Desk** is the compact Current Ready desktop/native acceptance application. It must stay buildable on the promoted Windows/macOS/Linux native line.
- **Patch Studio Showcase** is the complete Studio project. It intentionally includes Studio/Web-only controls and cross-target functionality even when no single export target currently supports every feature at once.

## Current coverage

The Showcase is a project-v4 multi-file bundle with a real project PNG resource and currently covers:

- every Component Registry 0.10 type: Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList;
- PasswordEdit and MaskedEdit source-backed Input presentations;
- multiple Forms and Form navigation;
- Project v4 multi-file composition and resource persistence;
- one PNG reused as Window icon, Picture, ImageList/Button image and PaintBox image;
- Object Inspector metadata including layout policy, TabOrder and Locked;
- menus, separators, portable shortcuts, enabled state and checked state;
- informational, confirmation, Open File and Save File dialogs;
- ordinary changed/clicked/ticked/paint events and explicit persistent `change` semantics;
- positioned Panel children and supported Tabs Stage 1 children.

## Target boundary

The project is primarily a **Studio Run acceptance project**, not a promise that every feature can be exported to one target today.

Current important boundaries include:

- Memo, PasswordEdit and MaskedEdit are Studio/Web-only at their present Stage 1 contracts and fail closed for Current Ready native 1.10.
- Standalone Window Web does not yet claim the complete Menu/Dialog runtime contract. In particular decorated menus with separators, shortcuts and enabled/checked bindings fail closed.
- Current Ready native remains the right export target for the promoted native control subset, and Workshop Desk is the canonical buildable acceptance app for that path.

CI checks both sides: the full Showcase must compile and retain all current Studio features, while target-specific slices must build only where the target contract actually supports them.

## Maintenance rule

**Every substantial Patch Studio RAD/component change must review and, where applicable, update this Showcase in the same development cycle.**

CI deliberately enforces this for the Component Registry. If a new registered control is added without representation here, `tests/studio-showcase.test.js` fails. A Component Registry version bump also requires updating the visible registry marker in the Showcase.

When a target gains support for a feature that currently fails closed, update the Showcase target-boundary tests and this document rather than keeping obsolete exceptions.

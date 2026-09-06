# Patch Studio Showcase

`patch-studio-showcase.patchproject` is the canonical acceptance project for the **complete current Patch Studio authoring surface** and is also expected to look like a finished RAD demo rather than a raw control test sheet.

It complements, rather than replaces, `examples/workshop-desk.patch`:

- **Workshop Desk** is the compact Current Ready desktop/native acceptance application. It must stay buildable on the promoted Windows/macOS/Linux native line.
- **Patch Studio Showcase** is the complete Studio project. It intentionally includes Studio/Web-only controls and cross-target functionality even when no single export target currently supports every feature at once.

## Visual structure

The Showcase uses three focused Forms with a consistent card/dashboard layout:

- **Patch Studio Showcase** is the primary dashboard. It groups account inputs, preferences/state, secondary semantics and project actions into distinct visual regions with consistent spacing.
- **Component Gallery** separates data/component contracts, graphics, project resources and Panel Stage 2 instead of placing every control in one undifferentiated grid.
- **Dialog Lab** isolates result-bearing dialog workflows and makes the transient-result versus explicit-`change` boundary visible.

The visual fixture should remain presentation-ready. New controls should be integrated into an existing section or a deliberately designed new section rather than appended wherever space happens to remain.

## Current coverage

The Showcase is a project-v4 multi-file bundle with a real project PNG resource and currently covers:

- every Component Registry 0.10 type: Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList;
- PasswordEdit and MaskedEdit source-backed Input presentations;
- CheckedListBox as the list-backed `# @listbox-mode checked` presentation;
- ProgressBar as the passive number-backed Slider `# @slider-mode progress` presentation;
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

- Memo, PasswordEdit, MaskedEdit, CheckedListBox and ProgressBar are Studio/Web Stage-1 surfaces at their present contracts and fail closed for Current Ready native 1.9 / payload v19 / runtime v1.10 where no matching native presentation exists.
- ProgressBar is deliberately passive. It exposes no Patch event; the dashboard timer changes its explicit `create number completion` state through `change`.
- Standalone Window Web does not yet claim the complete Menu/Dialog runtime contract. In particular decorated menus with separators, shortcuts and enabled/checked bindings fail closed.
- Current Ready native remains the right export target for the promoted native control subset, and Workshop Desk is the canonical buildable acceptance app for that path.

CI checks both sides: the full Showcase must compile and retain all current Studio features, while target-specific slices must build only where the target contract actually supports them.

## Maintenance rule

**Every substantial Patch Studio RAD/component change must review and, where applicable, update this Showcase in the same development cycle.**

CI deliberately enforces this for the Component Registry and for the current presentation contracts. If a new registered control is added without representation here, `tests/studio-showcase.test.js` fails. A Component Registry version bump also requires updating the visible registry marker in the Showcase.

Keep the primary dashboard readable: preserve the header, Account & input card, Preferences & state card, Details & semantics region, Quick actions Panel and dedicated supporting Forms. A technically valid but visually crowded control dump is considered a regression of the Showcase fixture.

When a target gains support for a feature that currently fails closed, update the Showcase target-boundary tests and this document rather than keeping obsolete exceptions.

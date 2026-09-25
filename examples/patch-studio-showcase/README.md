# Patch Studio Showcase

`patch-studio-showcase.patchproject` is the canonical acceptance project for the **complete current Patch Studio authoring surface** and is also expected to look like a finished RAD demo rather than a raw control test sheet.

It complements, rather than replaces, the Workshop fixtures:

- **Workshop Desk** (`examples/workshop-desk.patchproject`) is the working Project-v4 Studio/Web application. Its controls support one coherent ticket, customer, inventory and diagnostics workflow.
- **Workshop Desk native** (`examples/workshop-desk-native.patch`) is the separate Current Ready desktop acceptance fixture and stays within Native GUI IR 1.9 / payload v19 / runtime v1.10.
- **Patch Studio Showcase** is the exhaustive Studio feature project. Its declared Web target is executable and covers the complete current Studio/Web authoring surface.

## Visual structure

The Showcase uses six Forms with a consistent card/dashboard layout:

- **Patch Studio Showcase** is the primary reviewer workspace. Save profile stores the reviewer state on a Thing through `save_profile` and branches only where the workflow needs it. `reset_showcase` restores the acceptance fixture. The same Form groups input presentations, preferences, Project-v4 details and navigation into the feature labs without artificial scoring.
- **Component Gallery** separates data/component contracts, graphics, project resources and the container demonstration. The same Panel combines GroupBox Stage 1 with ScrollBox Stage 1 and places one Panel Stage-2 child below the visible viewport so real scrolling is exercised without adding another loose demo card.
- **Dialog Lab** isolates result-bearing dialog workflows and makes the transient-result versus explicit-`change` boundary visible.
- **Split Lab** isolates SplitContainer Stage 1 as a two-pane source-backed Panel with a real pointer/keyboard divider, keeping the initial ratio in source and runtime divider movement transient.
- **Calendar Lab** gives the inline Calendar Stage 1 presentation enough room to behave like a real date-selection surface instead of crowding the dashboard.

The visual fixture should remain presentation-ready. New controls should be integrated into an existing section or a deliberately designed new section rather than appended wherever space happens to remain.

## Current coverage

The Showcase is a project-v4 multi-file bundle with a real project PNG resource and currently covers:

- every Component Registry 0.10 type: Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList;
- advanced Table columns as source-backed `# @table-columns 136:left, 174:left, 104:center`, proving per-column pixel/auto width and left/center/right alignment without changing Table row or event semantics;
- PasswordEdit and MaskedEdit source-backed Input presentations;
- NumberEdit as the source-backed `# @number-edit` Input presentation;
- DatePicker as the source-backed `# @input-mode date` Input presentation with ISO date text;
- TimePicker as the source-backed `# @input-mode time` Input presentation with local `HH:MM` text;
- Calendar as the source-backed `# @input-mode calendar` inline month-grid presentation with ISO `YYYY-MM-DD` text;
- LinkLabel as ordinary Button plus source-backed `# @button-mode link`, retaining the normal `clicked` event without implicit navigation;
- Separator as the source-backed Designer preset over ordinary `shape line`, keeping existing Shape Web/native portability;
- CheckedListBox as the list-backed `# @listbox-mode checked` presentation;
- ProgressBar as the passive number-backed Slider `# @slider-mode progress` presentation;
- ScrollBar as the interactive Slider `# @slider-mode scrollbar` presentation with numeric `changed(value)`;
- GroupBox as the source-backed Panel `# @panel-mode group` presentation, reusing Panel Stage 2 containment rather than creating a second container model;
- ScrollBox as block-local `# @panel-scroll auto` on that same Panel, with positioned overflow proving the scrolling path;
- SplitContainer as block-local `# @panel-split vertical 42` plus one explicit `# @panel-split-break`, with a dedicated Split Lab exercising both panes and the divider;
- multiple Forms and Form navigation;
- Project v4 multi-file composition and resource persistence;
- one PNG reused as Window icon, Picture, ImageList/Button image and PaintBox image;
- Object Inspector metadata including layout policy, TabOrder and Locked;
- menus, separators, portable shortcuts, enabled state and checked state;
- informational, confirmation, Open File and Save File dialogs;
- ordinary changed/clicked/ticked/paint events and explicit persistent `change` semantics;
- positioned Panel children and supported Tabs Stage 1 children.

## Target boundary

The project is a **Studio Run and Standalone Web acceptance project**. Its configured Web target must build from the complete Project-v4 source without test-only feature stripping.

Current important boundaries include:

- Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are Studio/Web Stage-1 surfaces at their present contracts and fail closed for Current Ready native 1.9 / payload v19 / runtime v1.10 where no matching native presentation/containment contract exists.
- ProgressBar is deliberately passive. It exposes no Patch event; the dashboard timer changes its explicit `create number completion` state through `change`.
- GroupBox changes Panel presentation only. Its children remain ordinary Panel children and persistent application state still changes only through explicit `change`.
- ScrollBox changes only Panel viewport behavior. Its scroll offset is transient UI state, emits no Patch event and is not persistent application state.
- SplitContainer Stage 1 keeps orientation, pane boundary and initial ratio visible in source. Runtime divider movement is bounded transient UI state, emits no Patch event and does not mutate application state.
- Standalone Window Web v0.10 renders source-backed menus, separators, portable shortcuts, enabled/checked bindings, informational dialogs, confirmation results and browser file-result dialogs. Result values remain transient until an explicit Patch `change` stores them.
- Current Ready native remains a separate, narrower target boundary. The dedicated `workshop-desk-native.patch` fixture owns that acceptance path rather than forcing the richer Workshop or Showcase to pretend they are native-compatible.

CI requires the complete Showcase to compile and build its declared Web target while retaining all current Studio features.

## Maintenance rule

**Every substantial Patch Studio RAD/component change must review and, where applicable, update this Showcase in the same development cycle.**

CI deliberately enforces this for the Component Registry and for the current presentation contracts. If a new registered control is added without representation here, `tests/studio-showcase.test.js` fails. A Component Registry version bump also requires updating the visible registry marker in the Showcase.

Keep the primary dashboard readable: preserve the header, Reviewer & input modes card, Review preferences card, Project & semantics region, Quick actions Panel and dedicated supporting Forms. A technically valid but visually crowded control dump is considered a regression of the Showcase fixture.

When a target gains support for a feature that currently fails closed, update the Showcase target-boundary tests and this document rather than keeping obsolete exceptions.

# Workshop Desk

Workshop Desk is the working Patch Studio sample application.

Workshop Desk is organized around one coherent repair-ticket workflow. Queue selection loads a ticket, Parts selection changes the working item, quote calculation derives an idempotent estimate from quantity, services, rush and priority, Customer Profile persists a customer Thing, Inventory prepares a reorder Thing, and Diagnostics separates completed checks from timer pulses. A single tabbed Studio Feature Lab stays behind one action and covers the complete current Studio/Web component and presentation surface without cluttering the working desk.

## Project-v4 surfaces

The built-in Studio example is this multi-file Project-v4 bundle:

- `main.patch`: all seven source-backed Forms so Designer Form switching remains a first-class stress path.
- `model.patch`: application state, Things and quote/customer/inventory recipes.
- `logic.patch`: event handlers.
- `workshop.mark`: one deterministic project PNG used as the application/Form icon, Picture, PaintBox image and ImageList-backed buttons.

Presentation-only card Shapes are locked so they do not compete with working controls in Designer selection. The Studio Feature Lab covers PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, ScrollBar, LinkLabel, advanced Table columns, TreeView image/hint/state metadata, GroupBox, ScrollBox, SplitContainer, graphics, ImageList-backed Buttons, menus and result dialogs.

## Target boundary

The Project-v4 Workshop is a Studio/Web application and intentionally uses richer language semantics such as Things and recipes. It does not widen the Current Ready native contract.

`../workshop-desk-native.patch` is the separate Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 acceptance fixture. Keeping the two fixtures separate makes the target boundary explicit instead of weakening either example.

# Patch ListBox

Status: **language, Patch Studio, Standalone Window Web and compatibility desktop support implemented; direct native GUI parity is not implemented yet**

Patch ListBox is a single-selection control with the same explicit-persistence rule as Input and ComboBox.

```patch
create text fruit = "Banana"

window "ListBox demo" as main size 480, 300:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 24, 72 size 220, 120
  text "Selected: {fruit}" at 24, 212 size 260, 30

when fruit changed:
  change fruit:
    set = value
```

## Semantics

Selecting an item exposes a transient event-local text value named `value` inside `when ... changed:`.

Selection does **not** silently mutate persistent Patch state. Persistent state changes only through an ordinary semantic `change`. This keeps ListBox behavior on the same mutation path used by the rest of Patch.

ListBox is deliberately single-selection in this stage. Multi-selection would require a list-valued event contract and is kept separate rather than being hidden behind the same text event.

## Options

ListBox options are source-backed expressions separated by commas. At least two options are required.

```patch
listbox "Apple", "Banana", "Cherry" as fruit
```

The compiler preserves those option expressions in Window IR. Studio and Web evaluate them for display.

## Designer

Patch Studio exposes **+ ListBox** in the Toolbox. The source-backed inspector can edit:

- control id;
- option expressions;
- X/Y position;
- width/height.

The default ListBox geometry is 220 by 120 so multiple choices are visible without opening a dropdown. All edits rewrite `main.patch`.

## Web and compatibility desktop

Standalone Window Web runtime v0.7 renders ListBox as a multi-row HTML `<select>` and dispatches the selected text through the shared Window event adapter.

The explicit compatibility desktop renderer also handles both ComboBox and ListBox selection controls. This closes an older gap where compatibility validation could accept ComboBox while the renderer omitted it.

Compatibility runtime templates carrying this renderer are published separately as `studio-runtime-v0.5`; the compiled Window payload format remains v0.4.

## Native boundary

Native GUI IR v0.2 currently supports ComboBox but not ListBox. A direct native Windows/macOS/Linux build containing ListBox therefore fails closed during Native GUI IR preflight rather than silently dropping the control or switching to Electron.

The next native ListBox stage should add one platform-neutral Native GUI IR contract and lower it to:

- Win32 `LISTBOX`;
- AppKit `NSListView` or an equivalent native single-selection list surface;
- GTK3 `GtkTreeView`/list model or an equivalent native single-selection list surface;
- the Windows, macOS and Linux sealed runtimes used by token-free Patch Studio downloads.

That native extension should preserve the same text `value` and explicit `change` semantics defined here.

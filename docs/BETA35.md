# Patch 0.2.0-beta.35

Beta.35 adds browser-first ListBox multi-selection while preserving Patch's explicit persistent-mutation rule.

## List-backed ListBox contract

A ListBox keeps its existing single-select behavior when its `as` id is backed by `create text`:

```patch
create text fruit = "Banana"
listbox "Apple", "Banana", "Cherry" as fruit
```

Its `changed` handler receives transient text `value`.

When the same control id is backed by `create list`, Patch Studio App Preview and Standalone Window Web render a multi-select ListBox:

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits

when fruits changed:
  change fruits:
    set = value
```

The event-local `value` is a copied list of selected display strings. Selecting rows in the toolkit or browser does not itself mutate persistent Patch state. Persistence still requires an ordinary semantic `change`.

## Patch Studio

Patch Studio upgrades list-backed ListBoxes to real HTML multi-select controls in App Preview and Designer rendering. Selection is kept as transient UI state across Studio re-renders and the event is routed through the same semantic Window event adapter used by other controls.

The source file remains the UI source of truth. No hidden form model or hidden persistent selection state is introduced.

## Standalone Web

Standalone Window Web detects list-backed ListBoxes at build time. The generated runtime:

- renders `<select multiple>`;
- initializes selected options from the list value;
- keeps transient selection in a UI-only selection map;
- emits a copied text-list `changed` value;
- fails closed if a list-backed ListBox receives a scalar or mixed-type event value.

Text-backed ListBoxes retain their existing string event behavior.

## Native boundary

Native GUI IR 0.7 supports number, text and boolean persistent state. It does not yet model persistent list state. A list-backed multi-select ListBox therefore fails closed on current Native Ready, Native AOT and offline native Window paths rather than degrading to a single-selection text control.

This is an explicit beta.35 boundary. Native multi-select parity requires a future versioned Native GUI IR/runtime extension.

## Version boundary

Beta.35 changes the Patch product version and Window event adapter contract to **0.7**. It does not change:

- Change IR **0.10**;
- Native GUI IR **0.7** stable / **0.8** Table extension;
- direct native Table backend **0.9**;
- sealed Table payload **v9** / runtime **v1.0**;
- beta.32 Lean assurance scope.

## Regression example

`examples/listbox-multiselect-window.patch` is the canonical beta.35 source example.

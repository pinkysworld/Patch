# Semantic input events

Status: **beta.24 draft contract**

Patch Window input events must preserve State-Change Factorization. Editing a control is an external/UI observation; it is **not** itself a persistent Patch mutation.

## Source model

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

Inside an input `changed` handler, `value` is a transient event-local value containing the current control text.

## Required semantics

```text
DOM/control value changes
      ↓
event-local value
      ↓
Patch event body
      ↓
(optional explicit semantic change)
      ↓
persistent state + history
```

The event adapter itself must never write persistent state.

Consequences:

- `when name changed: show value` may observe the new input text but must leave persistent `name` unchanged.
- `change name: set = value` is the persistent mutation and must create the same semantic Change/history/provenance record as any other Patch `change`.
- `value` exists only while the event handler executes and shadows a persistent binding named `value` in the ordinary local-before-state expression lookup order.
- a `changed` event without an explicit transient value payload is a runtime error rather than silently using stale persistent state.
- rerendered input state is derived from persistent Patch state; transient text becomes persistent only after source commits it.

## Cross-target gate

Beta.24 must not merge until the same contract is wired in:

1. Patch Studio interactive Window preview;
2. Standalone Window Web App runtime;
3. generated Windows/macOS/Linux desktop Window player.

`tests/window-input-cross-target.test.js` intentionally keeps the draft red until those three paths contain the shared semantic adapter/listeners.

## Current supported event pairs

```text
button -> clicked    no event-local value required
input  -> changed    provides local `value`
```

Window `closed` remains unsupported until a portable semantic contract is implemented.

## Research relevance

This feature is primarily product work, not a novelty claim. It is nevertheless a useful consistency test of Patch's central language design: GUI editing does not create a second hidden persistent-write mechanism. Persistent application state still changes only through semantic `change` operations.

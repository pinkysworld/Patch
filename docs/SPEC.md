# Patch Language Specification

Status: **0.2.0-beta.36 development**

This document describes the current source-language surface. Patch is indentation-sensitive; two spaces are recommended. Product/runtime compatibility details live in `docs/ROADMAP.md` and `docs/NATIVE_GUI.md`. The formal assurance boundary is intentionally narrower than the language and remains the **beta.32** milestone described in `docs/FORMAL_MODEL.md` and `docs/RUNTIME_CORRESPONDENCE.md`.

The current Ready desktop Window product contract is **Native GUI IR 1.4 / sealed payload v14 / native runtime v1.5**. Older versioned contracts remain frozen compatibility and reproducibility lines. Product versioning does not widen the beta.32 Lean assurance claim.

## Core rule

After a persistent value is created, ordinary source code cannot assign to it directly. Persistent mutation occurs through an explicit `change` block.

```patch
create number score = 0
change score:
  add 1
show score
```

A direct reassignment such as `score = 2` is invalid outside a `create thing` field declaration.

## Values

Patch currently has numbers, text, booleans, lists and Things.

```patch
create number score = 10
create text name = "Mia"
create boolean ready = true
create list fruits = apple, banana

create thing player:
  name = "Sam"
  score = 0
  active = true
```

Thing fields are application data, not JavaScript prototype metadata. The field names `__proto__`, `prototype` and `constructor` are rejected fail-closed. Runtime Thing storage is prototype-free, and expression lookup only follows own fields.

## Expressions

Expressions support:

- numeric and quoted text literals;
- `true` and `false`;
- variables and Thing paths such as `player.score`;
- list literals such as `[1, 2, 3]`;
- arithmetic `+ - * / %`;
- comparisons `< > <= >=`;
- equality `== !=`;
- Boolean `and`, `or`, `not`;
- parentheses.

Patch value equality is structural. Lists compare by length and element order. Things compare by their own field names and values, independent of object insertion order. `NaN` compares equal to `NaN` for Patch structural equality, and inherited JavaScript properties never participate in a Patch path lookup. JSON serialization is not the equality oracle: `NaN` is not equal to `null`.

## Semantic changes

A `change` block forms one semantic committed change record.

```patch
change score called bonus:
  add 10

change player:
  add 10 to score
  set name = "Alex"
```

Supported source mutation verbs are:

```text
set
add
remove
clear
```

The interpreter/runtime converts these into explicit semantic operations and records enough information for history and inverse operations where supported.

Examples:

```patch
change score:
  add 5

change score:
  remove 2

change player:
  set name = "Lin"

change fruits:
  add pear

change fruits:
  remove apple

change ready:
  clear
```

Field-targeting forms are `set field = value`, `add value to field`, `remove value from field`, and `clear field`.

## Change Signatures

Patch infers a semantic Change Signature for recipes and compiled programs. A signature records semantic effect information such as target/path, operation class, source provenance, and a known amount or amount range where production analysis can establish one.

```patch
make reward(player):
  change player:
    add 5 to score
```

Conceptually:

```text
reward(player)
  player.score -> increase by 5
```

Change IR currently has version **0.10**.

## Change Capabilities

A recipe can state which semantic effects it may produce.

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

Capability rules use:

```text
target[.field] may operation [up to number]
```

Current policy operations are `increase`, `decrease`, `add`, `remove`, `set`, and `clear`. `up to` applies to quantitative increase/decrease/add/remove rules. The production compiler rejects a protected recipe when its inferred committed effects are not covered by the declared rules.

## Ranged recipe parameters

Numeric recipe parameters can carry an inclusive range contract.

```patch
make reward(points number 0..100):
  show points
```

The production interval analyzer supports the documented arithmetic fragment and fails conservatively when it cannot prove a required quantitative bound. Runtime calls also enforce declared parameter ranges.

## Recipes and calls

```patch
make greet(name):
  show "Hello " + name

do greet("Ada")
```

Recipes can return a value:

```patch
make identity(value):
  return value
```

Current assurance tooling supports progressively stronger finite, acyclic recipe-call fragments. Recursion/cycles are not silently certified by the finite-call assurance pipeline.

## Control flow

```patch
if score >= 10:
  show "winner"
else:
  show "keep going"

repeat 5:
  change score:
    add 1
```

Inside `repeat`, `count` is a one-based local number. Production execution limits a repeat count to a whole number from 0 through 100000.

## History, undo, redo and preview

Committed semantic changes are visible through history.

```patch
history score
undo bonus
redo
```

Named undo is restricted to the latest committed change when that name is supplied.

`preview` runs against cloned state/history and restores committed state afterwards:

```patch
preview:
  change score:
    add 100
```

Preview comparison uses the same structural Patch value equality as `==` and list removal.

## Watch and provenance

```patch
watch score
why score
why score > 100
```

`watch` reports later committed transitions. `why` uses recorded semantic history and known recipe/event causes. This is historical provenance, not a general counterfactual-causality system.

## Window applications and Forms

A Window project uses the same persistent state/change machinery as a Console project.

```patch
create number count = 0

window "Counter" as counter size 520, 360:
  text "Count: {count}"
  button "Add" as add_button at 24, 64 size 120, 34

when add_button clicked:
  change count:
    add 1
```

Named Forms can be opened and closed:

```patch
open settings
close settings
```

Unnamed legacy windows remain source-compatible.

## Window controls

The current source-language Window control families are:

- `text`
- `button`
- `input`
- `checkbox`
- `radio`
- `combo`
- `listbox`
- `slider`
- `table`
- `tree`
- `tabs`
- `panel`
- `timer`
- `picture`
- `statusbar`

Examples:

```patch
checkbox "Enabled" as enabled_box
radio "Small", "Large" as size_choice
combo "Red", "Green", "Blue" as color_choice
listbox "One", "Two", "Three" as choices
slider 0..100 as volume step 5
panel as tools:
  text "Grouped tools"
  button "Run" as run_tools
timer as refresh_clock interval 1000
picture "Preview" as preview_image
statusbar "Ready" as app_status
```

`panel`, `timer`, `picture` and `statusbar` belong to the Native GUI IR 1.4 / payload v14 / runtime v1.5 Chrome Stage 1 source surface. Their Studio authoring/runtime parity is intentionally tracked separately. In particular, PictureBox image-source decoding is not yet claimed as a complete cross-platform asset pipeline.

Controls may use source-backed layout:

```text
at x, y
at x, y size width, height
```

Control positions must be non-negative. Explicit control sizes must be at least 16 by 16. Explicit Window sizes must be at least 120 by 80.

## Tables

A Table declares source-backed columns and rows.

```patch
table "Name", "Role" as people:
  row "Ada", "Engineer"
  row "Lin", "Researcher"
```

Every row must have exactly the declared number of values.

## TreeView

```patch
tree as files:
  node "src"
    node "parser.js"
    node "interpreter.js"
  node "README.md"
```

Tree hierarchy is source-backed. Selection is transient UI state unless a handler explicitly commits persistent state through `change`.

## Tabs

Tabs contain at least two source-backed pages. Nested page controls currently use flow layout.

```patch
tabs as settings_tabs:
  tab "General":
    text "General settings"
    input user_name
  tab "Advanced":
    checkbox "Enabled" as advanced_enabled
```

Nested Tabs controls use the same source-backed control/event semantics as their top-level counterparts where supported.

## Menus

```patch
menu "File":
  item "Open" as open_item shortcut "Ctrl+O"
  separator
  item "Enabled mode" as enabled_item checked mode_enabled
```

Menu items may carry portable shortcuts plus source-backed Boolean `enabled` and `checked` bindings. Separators must appear between clickable items.

## Dialogs and file results

Informational dialog:

```patch
dialog "About", "Patch"
```

Result-producing forms include:

```patch
confirm "Delete?", "This cannot be undone." as delete_result
open file "Choose a file" as open_result
save file "Save project" as save_result
```

Their result events are transient. Persistent application state changes only when event code executes an explicit `change`.

## Events

Current event words are:

```text
clicked
changed
closed
confirmed
chosen
cancelled
ticked
```

Examples:

```patch
when volume changed:
  change level:
    set = value

when refresh_clock ticked:
  change ticks:
    add 1
```

Event-local UI values are transient until explicitly committed by source code.

## Application kind

Projects are `console` or `window` applications. Both compile through the same Change IR and persistent state/change semantics. GUI/runtime target support is a product capability boundary, not a different mutation model.

## Current assurance metadata

Change IR **0.10** carries the production semantic program plus assurance metadata for supported fragments, including source/semantic views and call/source/guard validation artifacts.

The repository currently contains these assurance layers:

1. production Change Signatures and Change Capabilities;
2. Lean-checked source/evidence/signature/policy relations for supported explicit changes;
3. integer `RangeExpr` evidence;
4. independent raw-source/range and guard extraction checks for supported fragments;
5. independent raw static `do recipe(args)` call-site identity checking;
6. ranked finite abstract call composition and exact safe-integer concrete binding;
7. structured and guard-selected callee traces;
8. finite transitive exact call trees;
9. direct-Wasm execution with independently validated semantic observations;
10. **beta.32** independently reconstructed invocation frames, including repeated identical calls and mixed concrete guard paths.

This is deliberately **not** an end-to-end verified compiler/runtime theorem.

Trusted or proof-free boundaries still include general parser/extractor correctness outside the independently checked subsets, JavaScript lowering/backend correctness, runtime capture, independent-validator implementation correctness, and the executing Wasm engine. GUI execution is outside the beta.32 Lean runtime-correspondence claim. Thing records, lists and non-numeric Console state are likewise outside that Lean claim; direct Wasm and portable C99 fail closed on them.

Unsupported constructs are reported as unsupported rather than silently called verified.

## Certificate commands

Core source/evidence certificate:

```bash
patch certify program.patch --out Program.patchcert.lean
```

Coverage report:

```bash
patch formal program.patch
```

The repository additionally exposes dedicated commands/scripts for call, concrete-call, structured-callee, transitive-call and runtime-correspondence certificates. See `docs/FORMAL_MODEL.md` and `docs/RUNTIME_CORRESPONDENCE.md` for the exact current theorem boundary.

## Source syntax words

The current source syntax includes the following structural words:

```text
create thing number text boolean list
change called set add remove clear
show why watch history undo redo preview
if else repeat make do return
allow may increase decrease up to
window as size at
text button input checkbox radio combo listbox slider step
panel timer interval picture statusbar
table row tree node tabs tab
menu item separator enabled checked shortcut
dialog confirm open close save file
when clicked changed closed confirmed chosen cancelled ticked
true false and or not
```

This is a synchronization list for the current language surface, not a promise that every word is forbidden as an identifier in every grammatical position. `formal`, `certify`, `run`, `build`, and related names are CLI commands rather than source-language constructs.

## Error design

Patch errors should state what failed, where possible give the source line, and prefer a concrete correction over parser jargon. Capability, range, target and assurance boundaries fail conservatively when the implementation cannot establish the required condition.

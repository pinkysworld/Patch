# Patch Language Specification

Status: **0.2.0-beta.2 development**

Patch is indentation-sensitive. Two spaces are recommended.

## Core rule

After a value is created, ordinary source code cannot assign to it directly. Persistent mutation occurs only inside `change`.

```patch
create number x = 1
change x:
  add 1
```

Direct reassignment such as `x = 2` is intentionally invalid outside a `create thing` field block.

## Values

```patch
create number score = 10
create text name = "Mia"
create boolean ready = true
create list fruits = apple, banana
```

Lists can also use expression form: `create list values = [1, 2, 3]`.

Things are simple records:

```patch
create thing player:
  name = "Sam"
  score = 0
  active = true
```

## Expressions

Current expressions include numbers, strings, booleans, variables, thing fields such as `player.score`, arithmetic `+ - * / %`, comparisons, `and`, `or`, `not`, parentheses, and list literals.

## Change

A `change` block is atomic from the language-history perspective: all operations in one block form one semantic change record.

### set

```patch
change name:
  set = "Alex"

change player:
  set name = "Alex"
```

### add

```patch
change score:
  add 10

change fruits:
  add orange

change player:
  add 10 to score
```

For numbers `add` performs numeric addition; for lists it appends; for text it appends text.

### remove

```patch
change lives:
  remove 1

change fruits:
  remove banana

change player:
  remove 1 from lives
```

For numbers `remove` subtracts; for lists it removes the first semantically equal item.

### clear

```patch
change fruits:
  clear
```

The beta maps clear to the natural empty value: `[]`, `""`, `0`, or `{}`.

## Semantic Change Signatures

Patch 0.2 beta.2 automatically infers a semantic **Change Signature** for each recipe.

```patch
make reward(player):
  change player:
    add 5 to score
```

The compiler infers approximately:

```text
reward(player)
  player.score -> increase by 5
```

This is compiler information, not syntax the beginner has to write. The signature records the target/path, semantic operation class, statically known amount when available, source location, and simple transitive effects through recipe calls.

The current semantic classes are:

- `increase` and `decrease` when the compiler can prove a numeric literal change;
- `add` and `remove` when the value/type cannot be proven more precisely;
- `set`;
- `clear`.

Preview-only changes are represented in signatures but marked as non-committing.

Use the CLI to inspect inferred signatures:

```text
patch changes program.patch
```

Patch Studio exposes the same information in the **Change Contract** tab.

## Change Capabilities

A recipe can optionally declare which semantic changes it is allowed to produce.

```patch
allow reward:
  player.score may increase up to 10

make reward(player):
  change player:
    add 5 to score
```

The `allow` block is a compile-time policy. It does not execute at runtime.

A rule has the form:

```text
target[.field] may operation [up to number]
```

Current operations:

```text
increase
decrease
add
remove
set
clear
```

Examples:

```patch
allow inventory_action:
  player.inventory may add
  player.inventory may remove
```

```patch
allow reward:
  player.score may increase up to 10
```

If a protected recipe produces a committed change that is not covered by a rule, compilation fails.

For example, this is rejected:

```patch
allow reward:
  player.score may increase up to 10

make reward(player):
  change player:
    set score = 999
```

This is also rejected because the bound is exceeded:

```patch
make reward(player):
  change player:
    add 25 to score
```

### Conservative proof rule

When a bounded policy uses `up to`, Patch must be able to prove the amount statically in the current beta.

```patch
allow reward:
  player.score may add up to 10

make reward(player, bonus):
  change player:
    add bonus to score
```

The compiler rejects this form because it cannot yet prove that `bonus <= 10`. Later typed/range analysis can make more dynamic cases provable.

### Transitive recipe effects

Patch follows simple recipe calls when it can map a callee parameter to a simple caller identifier.

```patch
make add_points(target):
  change target:
    add 5 to score

allow reward:
  player.score may increase up to 10

make reward(player):
  do add_points(player)
```

The inferred signature for `reward` contains `player.score -> increase by 5`, and the capability is checked against that transitive effect.

If recursion, an unknown recipe, or a dynamic target prevents a safe proof inside a capability-protected recipe, the compiler rejects the proof rather than guessing.

## Window applications

Patch 0.2 introduces the first intentionally small Patch UI slice. The same state and `change` semantics are used in console and window programs.

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

### window

```patch
window "My App":
  ...
```

A program may declare one or more windows. In the browser beta they are represented by a virtual Patch UI model and rendered by Patch Studio.

### text

```patch
text "Hello"
text "Count: {count}"
```

Text supports simple `{name}` interpolation from Patch state in the current UI runtime.

### button

```patch
button "Save" as save_button
```

The identifier after `as` is used by event handlers.

### input

```patch
input name
```

The first parser/runtime slice recognizes inputs and renders them. Binding input changes back into Patch state is not yet part of the 0.2 event model.

### when

```patch
when save_button clicked:
  show "clicked"
```

Recognized event names are currently `clicked`, `changed`, and `closed`; the browser beta executes `clicked` for buttons. The other event kinds reserve stable syntax while their host wiring is implemented.

### Planned Patch UI controls

The stable UI vocabulary is intended to grow carefully with `list`, `image`, `checkbox`, `slider`, `menu`, `tabs`, and `canvas`. These are roadmap items, not implemented syntax yet.

## Named changes

```patch
change score called bonus:
  add 10
```

A name can be used by `undo` when it is the latest committed change.

## Undo / redo

```patch
undo
redo
```

or `undo bonus` for the latest named change. Arbitrary non-last undo is deliberately deferred because it requires rebasing/commutation semantics.

## Preview

```patch
preview:
  change score:
    add 100
```

The body executes against cloned state/history. Patch reports the proposed state difference and restores the committed state.

## History and watch

```patch
history score
watch score
```

History is semantic rather than merely textual: it records normalized operations plus before/after state. `watch` reports future committed transitions.

## Conditions

```patch
if score >= 10:
  show "winner"
else:
  show "keep going"
```

## Repeat

```patch
repeat 5:
  change score:
    add 1
```

Inside a loop, `count` is available as a one-based local number.

## Recipes

```patch
make greet(name):
  show "Hello " + name

do greet("Ada")
```

## Compiler-visible application kind

A project is currently marked `console` or `window` in Patch Studio/build options. The compiler can also infer a window-oriented program when the AST contains `window` declarations.

Both kinds compile through the same Change IR.

## Reserved words

`create thing number text boolean list change called set add remove clear show watch history undo redo preview if else repeat make do return allow may increase decrease up to window text button input when clicked changed closed as true false and or not`

## Error design

Patch errors should answer what went wrong, where, and how to fix it, while avoiding unnecessary compiler terminology. Example: `line 4: I cannot change 'score' because it does not exist.`

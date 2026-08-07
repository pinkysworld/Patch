# Patch Language Specification

Status: **0.2.0-beta.3 development**

Patch is indentation-sensitive. Two spaces are recommended.

## Core rule

After a value is created, ordinary source code cannot assign to it directly. Persistent mutation occurs only inside `change`.

```patch
create number x = 1
change x:
  add 1
```

Direct reassignment such as `x = 2` is intentionally invalid outside a `create thing` field block.

## Values and expressions

```patch
create number score = 10
create text name = "Mia"
create boolean ready = true
create list fruits = apple, banana
```

Things are simple records:

```patch
create thing player:
  name = "Sam"
  score = 0
  active = true
```

Expressions include numbers, strings, booleans, variables, thing fields such as `player.score`, arithmetic `+ - * / %`, comparisons, `and`, `or`, `not`, parentheses, and list literals.

## Change

A `change` block forms one semantic change record.

```patch
change score:
  add 10

change player:
  add 10 to score
  remove 1 from lives
  set name = "Alex"
```

Supported source operations are `set`, `add`, `remove`, and `clear`. The runtime normalizes these into semantic operations and generated inverses where supported.

## Semantic Change Signatures

Patch automatically infers a semantic Change Signature for every recipe.

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

Signatures contain target/path, semantic operation class, source information, and a known amount or amount range when the analyzer can prove one. Preview-only changes are marked non-committing. Simple recipe calls are followed transitively.

## Change Capabilities

A recipe can optionally state what semantic changes it may produce.

```patch
allow reward:
  player.score may increase up to 10
```

Rules use:

```text
target[.field] may operation [up to number]
```

Current operations are `increase`, `decrease`, `add`, `remove`, `set`, and `clear`.

A protected recipe is rejected if its inferred committed changes are not covered by its rules.

## Ranged recipe parameters

Beta 3 introduces bounded numeric parameters:

```patch
make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

A ranged parameter is still used like an ordinary number. The annotation is an optional contract for the compiler/runtime, not a new numeric type visible in ordinary expressions.

The compiler uses interval analysis to reason about simple arithmetic:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

`bonus * 2` is inferred as `0..10`, so the capability is proven. If the declared input range were `0..6`, the possible result would be `0..12` and compilation would fail.

The current interval analyzer supports numeric literals, ranged parameter names, unary `+`/`-`, parentheses, and `+`, `-`, `*`, `/`. Division is not proven when the denominator interval can contain zero.

Calls to ranged recipes are also guarded at runtime. For example, a recipe declaring `bonus number 0..10` rejects a call with `11`. This guard is part of the assumptions behind signature soundness until a stronger static call proof is mechanized.

## Causal provenance and `why`

Committed semantic changes retain:

- source line;
- change target and before/after values;
- semantic operations;
- active recipe-call chain;
- GUI event cause when a change occurs from an event handler.

To explain the current value of a target:

```patch
why score
```

Patch reports the recorded changes that led to the current value and includes known recipe/event causes.

A condition can also be queried:

```patch
why score > 100
```

For the deterministic in-memory history, Patch reconstructs the pre-change state and replays committed changes until it finds the first transition where the condition changed from false to true. If the condition is false now or was already true before the recorded changes, Patch reports that instead.

`why` is a provenance/debugging facility. It does not claim to infer philosophical or counterfactual causation, and it does not yet reason about arbitrary external effects.

## Window applications

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

Current GUI syntax includes `window`, `text`, `button`, `input`, and event syntax `when control clicked:`. The same persistent-state semantics and provenance model apply inside event handlers.

## Named changes, undo, preview, history

```patch
change score called bonus:
  add 10

history score
undo bonus
redo
```

Named undo is currently restricted to the latest committed change.

Preview executes against cloned state/history and restores committed state:

```patch
preview:
  change score:
    add 100
```

`watch score` reports future committed transitions.

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

Inside `repeat`, `count` is a one-based local number.

## Recipes

Plain parameters remain valid:

```patch
make greet(name):
  show "Hello " + name

do greet("Ada")
```

Ranged parameters are optional and currently numeric only:

```patch
make award(points number 0..100):
  show points
```

## Compiler-visible application kind

Projects are `console` or `window` applications. Both compile through the same Change IR.

## Reserved words

`create thing number text boolean list change called set add remove clear show why watch history undo redo preview if else repeat make do return allow may increase decrease up to window text button input when clicked changed closed as true false and or not`

## Error design

Patch errors should answer what went wrong, where, and how to fix it while avoiding unnecessary compiler terminology. Range/capability failures deliberately fail conservatively when the compiler cannot prove a bounded change safe.

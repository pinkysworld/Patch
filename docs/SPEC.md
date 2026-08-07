# Patch Language Specification

Status: **0.1.0-beta.1**

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

Beta expressions include numbers, strings, booleans, variables, thing fields such as `player.score`, arithmetic `+ - * / %`, comparisons, `and`, `or`, `not`, parentheses, and list literals.

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

## Reserved words

`create thing number text boolean list change called set add remove clear show watch history undo redo preview if else repeat make do return true false and or not`

## Error design

Patch errors should answer what went wrong, where, and how to fix it, while avoiding unnecessary compiler terminology. Example: `line 4: I cannot change 'score' because it does not exist.`

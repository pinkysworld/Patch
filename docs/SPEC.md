# Patch Language Specification

Status: **0.2.0-beta.6 development**

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

Signatures contain target/path, semantic operation class, source information, and a known amount or amount range when the analyzer can prove one. Preview-only changes are marked non-committing. Simple recipe calls are followed transitively by the production analyzer.

The Lean formal core machine-checks signature soundness for sequencing, branch choice and bounded repetition. The production/formal bridge covers a conservative subset of the real language. This bridge and the beta-6 certificate system are compiler tooling, not new beginner syntax.

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

A protected recipe is rejected by the production compiler if its inferred committed changes are not covered by its rules.

For the structured Lean core, the end-to-end relation is machine checked:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

## Production/formal validation metadata

Patch IR 0.5 includes a `formalBridge` object. It records whether each program/recipe entry is inside the currently supported production-to-formal correspondence subset, the reconstructed formal-style signature, the normalized production signature, and reasons for unsupported constructs.

A supported signature mismatch is a compiler error.

Inspect the current boundary with:

```bash
patch formal program.patch
```

Current bridge coverage includes direct supported semantic changes, sequence, `if` alternatives, literal bounded `repeat`, and supported numeric range amounts. Recipe calls, dynamic repetition, undo/redo, return control flow, and GUI/event execution are currently reported as outside this bridge subset.

## Verified semantic policy certificates

Beta 6 adds a certificate command for protected recipes inside the formal bridge subset:

```bash
patch certify program.patch --out Program.patchcert.lean
```

The generated Lean artifact contains the bridge-produced formal statement, semantic policy, Patch IR version and source SHA-256. It is checked against `formal/PatchChecker.lean`.

The verified checker proves that:

```text
checkProtected(stmt, policy) = true
```

implies the formal relational policy judgment and, together with Change Signature Soundness, that any modeled execution of that statement cannot emit a semantic effect outside the policy.

This guarantee applies to the **translated formal statement**. Beta 6 does not yet prove the JavaScript source-to-formal translation correct. Certificate generation therefore refuses protected recipes outside the bridge subset, and documentation must not present a generated certificate as full compiler verification.

## Ranged recipe parameters

Patch supports bounded numeric parameters:

```patch
make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

A ranged parameter is still used like an ordinary number. The annotation is an optional contract for the compiler/runtime.

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

Calls to ranged recipes are guarded at runtime. The beta-6 Lean checker independently verifies interval **containment once the interval is in the certificate**, but production interval-analysis soundness itself is not yet mechanized.

## Causal provenance and `why`

Committed semantic changes retain source line, target/before/after values, semantic operations, active recipe-call chain, and GUI event cause when relevant.

```patch
why score
why score > 100
```

`why score` reports recorded transitions and known recipe/event causes. A condition query reconstructs pre-change state and replays committed changes until it finds the first false-to-true transition when possible.

`why` is a provenance/debugging facility. It does not claim general counterfactual causal inference.

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

Current GUI syntax includes `window`, `text`, `button`, `input`, and `when control clicked:`. The same persistent-state semantics and provenance model apply inside event handlers. GUI/event execution is not yet in the formal certificate subset.

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

`formal` and `certify` are CLI commands, not source-language reserved words.

## Error design

Patch errors should answer what went wrong, where, and how to fix it while avoiding unnecessary compiler terminology. Range/capability failures deliberately fail conservatively when the compiler cannot prove a bounded change safe. Formal bridge and certificate coverage follow the same principle: code outside the correspondence subset is reported as unsupported, never silently treated as verified.

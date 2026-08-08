# Patch Language Specification

Status: **0.2.0-beta.8 development**

Patch is indentation-sensitive. Two spaces are recommended.

## Core rule

After a value is created, ordinary source code cannot assign to it directly. Persistent mutation occurs only inside `change`.

```patch
create number x = 1
change x:
  add 1
```

Direct reassignment such as `x = 2` is intentionally invalid outside a `create thing` field initializer.

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

Supported source mutation verbs are `set`, `add`, `remove`, and `clear`. The runtime normalizes these into semantic operations and generates inverses where supported.

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

Signatures contain target/path, semantic operation class, source information, and a known amount or amount range when the analyzer can prove one. Preview-only changes are marked non-committing. Simple recipe calls can be followed transitively by the production analyzer, although recipe calls remain outside the current formal certificate subset.

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

Current policy operations are `increase`, `decrease`, `add`, `remove`, `set`, and `clear`. The verified formal policy vocabulary currently uses normalized `increase`, `decrease`, `set`, and `clear` effects.

A protected recipe is rejected by the production compiler if its inferred committed changes are not covered by its rules.

For the structured Lean core, the machine-checked relation is:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
---------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

## Ranged recipe parameters

Patch supports bounded numeric parameters:

```patch
make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

A ranged parameter is still used as an ordinary number. The annotation gives the analyzer/runtime a declared input contract.

The production interval analyzer currently supports numeric literals, ranged parameter names, unary `+`/`-`, parentheses, and `+`, `-`, `*`, `/`. Division is not proven when the denominator interval can contain zero.

Example:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production analyzer infers `bonus * 2` as `0..10`. With `bonus number 0..6`, the possible range becomes `0..12` and the current capability checker rejects the program.

Calls to ranged recipes are guarded at runtime. Production interval-analysis soundness itself is still a formal proof obligation.

## Formal metadata in Change IR 0.6

Patch IR 0.6 contains both:

```text
formalSource
formalBridge
```

in addition to ordinary instructions, runtime capabilities, Change Signatures, and Change Capability policies.

### `formalSource`

`formalSource` preserves source mutation verbs for the supported formal subset:

```text
add | remove | set | clear
```

plus sequence, branch and literal-repeat structure. Numeric `add`/`remove` nodes carry the production-inferred raw amount range.

### `formalBridge`

`formalBridge` contains the independent semantic view used for production translation validation. Numeric changes are normalized there to semantic operation classes such as `increase` and `decrease`.

`patch formal program.patch` reports coverage of both views. Unsupported constructs are listed explicitly.

## Beta 8 source/evidence certificates

For protected recipes inside both supported formal subsets:

```bash
patch certify program.patch --out Program.patchcert.lean
```

emits a Lean-checkable artifact containing separate claims:

```text
SourceStmt
EvidenceStmt
production Change Signature
semantic policy
source SHA-256
Patch IR version
source/evidence schema versions
```

The important distinction is that the source artifact still says source-level `add`, `remove`, `set`, or `clear`.

For example:

```patch
change player:
  add -5 to score
```

can be represented in the formal source artifact as:

```text
add amount [-5,-5]
```

while the separate semantic evidence says:

```text
decrease amount [5,5]
```

`formal/PatchSource.lean` validates the raw amount bounds and performs this semantic normalization itself. Lean then checks that the independently emitted semantic evidence matches the source lowering.

The executable source/evidence check is:

```text
checkSourceEvidence(source, evidence)
```

and successful checking implies:

```text
lowerSourceStmt(source) = some evidence
```

The source/signature path is:

```text
SourceStmt
  -> Lean source normalization
  -> EvidenceStmt
  -> Lean evidence decoding
  -> CoreStmt
  -> formal inferSignature
  -> compare with separate production Change Signature claim
```

For the formal Source-core execution relation, Lean also proves that a successful source policy check prevents modeled runtime effects outside policy.

## Important verification boundary

Beta 8 is **not full compiler verification**.

Still trusted/unproved:

```text
Patch source bytes
  -> JavaScript parser / AST
  -> SourceStmt extraction
```

and:

```text
Patch numeric expression
  -> production-inferred amount interval
```

Lean-checked after the formal source boundary:

```text
SourceStmt
  -> semantic normalization
  -> EvidenceStmt correspondence
  -> CoreStmt decoding
  -> formal signature reconstruction
  -> production-signature correspondence
  -> semantic policy checking
  -> runtime containment for formal SourceExecutes traces
```

The production JavaScript runtime is also not yet proved to correspond to the formal `SourceExecutes` relation.

Certificate generation refuses protected recipes outside the source/semantic formal subset. Unsupported code is not silently called verified.

## Current formal certificate subset

Currently supported:

- direct `add`, `remove`, `set`, `clear` source changes;
- non-mixed-sign proven numeric amount ranges for `add`/`remove`;
- sequence;
- `if` alternatives;
- literal non-negative `repeat`;
- preview as no committed formal effect.

Currently outside the subset:

- recipe calls and cross-call substitution;
- dynamic repeat counts;
- `return`;
- `undo` / `redo`;
- GUI/window/event execution;
- mixed-sign numeric ranges;
- numeric mutation amounts for which no range is proved;
- external effects and richer source semantics not represented by the current formal core.

## Causal provenance and `why`

Committed semantic changes retain source line, target/before/after values, semantic operations, active recipe-call chain, and GUI-event cause when relevant.

```patch
why score
why score > 100
```

`why score` reports recorded transitions and known recipe/event causes. A condition query reconstructs pre-change state and replays committed changes until it finds the first recorded false-to-true transition when possible.

This is historical provenance, not a general counterfactual causality system.

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

Current GUI syntax includes `window`, `text`, `button`, `input`, and `when control clicked:`. GUI/event execution uses the same production mutation machinery but is not yet in the formal certificate subset.

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

Inside production `repeat`, `count` is a one-based local number. Only literal non-negative repeat counts are currently in the formal source certificate subset.

## Recipes

```patch
make greet(name):
  show "Hello " + name

do greet("Ada")
```

Ranged parameters are optional and numeric only in the current beta:

```patch
make award(points number 0..100):
  show points
```

## Application kind

Projects are `console` or `window` applications. Both compile through the same Change IR and state/change semantics.

## Reserved words

`create thing number text boolean list change called set add remove clear show why watch history undo redo preview if else repeat make do return allow may increase decrease up to window text button input when clicked changed closed as true false and or not`

`formal` and `certify` are CLI commands, not source-language reserved words.

## Error design

Patch errors should explain what went wrong, where, and how to fix it without unnecessary compiler jargon. Capability/range/formal checks deliberately fail conservatively when they cannot prove the required property.

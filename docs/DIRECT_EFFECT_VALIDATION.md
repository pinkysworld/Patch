# Direct semantic-effect validation

Patch 0.2.0-beta.15 extends the independent direct-Wasm transition validator from state transitions to Patch's semantic effect vocabulary.

The runtime still reports only the minimum transition observation:

```text
patch.change_number(targetId, before, after)
```

It does **not** report `increase`, `decrease`, `set`, `clear`, magnitude, Change Signature membership, or capability admission. Those semantic facts are reconstructed and checked outside the Wasm lowerer.

## Independent concrete effect reconstruction

For each executed Change-IR operation the validator independently evaluates its concrete expression and normalizes the source operation:

```text
add +k      -> increase by k
add -k      -> decrease by k
remove +k   -> decrease by k
remove -k   -> increase by k
set v       -> set
clear       -> clear
```

The reconstructed effect records the operation-level before/after values and concrete magnitude. A single Patch `change` block may therefore contain several semantic effects while still producing one committed block-level transition event.

Example:

```patch
create number score = 10

change score:
  add 2
  remove 1
  set 20
```

The direct runtime reports one transition:

```text
score: 10 -> 20
```

The independent validator reconstructs the ordered semantic effects:

```text
increase score by 2
decrease score by 1
set score
```

This distinction is important because semantic authority in Patch is operation-sensitive, not merely write-sensitive.

## Change Signature validation

`validateDirectSemanticEffects(ir, observedTrace)` first performs the beta.14 transition validation. It then requires every independently reconstructed concrete runtime effect to be covered by the production Change Signature of the executing scope.

For a concrete numeric effect, coverage requires:

```text
same target
same field
same semantic operation
concrete magnitude inside the static amount/range evidence
```

`set` and `clear` are matched by semantic identity without pretending they are bounded increases or decreases.

Recipe-call occurrences are attributed to the recipe whose Change site actually executes. A wrapper recipe that calls another recipe does not cause the validator to relabel the callee's concrete transition as a local write.

## Change Capability validation

If the executing recipe has an `allow` policy, the same concrete runtime effect is independently checked against that policy:

```text
same target
same field
same semantic operation
concrete magnitude <= declared maximum when bounded
```

For example:

```patch
allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

with `bonus = 4` reconstructs:

```text
score increase by 8
```

The beta.15 gate checks that this concrete effect is covered by the static Change Signature and admitted by the `increase up to 10` capability.

## Tamper tests

The tests deliberately modify otherwise successfully compiled IR after direct execution.

They verify that validation rejects:

```text
an emptied/tampered Change Signature
an artificially narrowed Change Capability
a transition value modified after Wasm execution
missing or reordered transition events
```

These tests demonstrate that the effect-validation result is not merely a consequence of the production compiler having accepted the original source.

## Quality gate

`npm run validate:wasm-direct` now performs the complete dynamic validation chain for the protected direct-Wasm example:

```text
Patch source
   -> production compile + Change Capability check
   -> direct Wasm
   -> execute Wasm
   -> observe target/before/after transitions

Change IR
   -> independent transition execution model
   -> independent semantic-effect reconstruction
   -> compare observed transition sequence
   -> validate concrete effects against Change Signature
   -> validate protected concrete effects against Change Capability
```

This runs on Windows, macOS and Linux with Node 22 and 24.

## What beta.15 establishes

For the exercised supported numeric executions, the quality gate checks that:

1. the observed direct-Wasm transition sequence agrees with an independent Change-IR execution model;
2. each concrete source operation is independently normalized to a semantic runtime effect;
3. each effect is covered by the static Change Signature of the executing scope; and
4. each effect in a protected recipe is admitted by its declared Change Capability.

This is a substantially more semantic backend check than output/final-state equivalence alone.

## What it does not establish

Beta.15 remains **translation-validation evidence**, not a verified compiler.

The validation layer still trusts the supplied production Change IR, including the static Change Signatures and Change Capabilities it checks against. It independently reconstructs concrete runtime effect identity and magnitude, but it does not prove source/AST-to-IR correctness.

The current direct trace is numeric only and the validator's finite-number subset is intentionally narrower than unrestricted WebAssembly `f64` behavior.

The following remain open:

```text
source bytes -> parser / AST -> Change IR correctness
formal SourceStmt / RangeExpr extraction correspondence
direct runtime -> Lean SourceExecutes / Executes correspondence
static proof of generated Wasm for all inputs
non-numeric direct values
host trace integrity outside the reference runtime
```

## Research significance

Patch's candidate contribution is not simply that WebAssembly can be tested against an interpreter. The useful property is that mandatory semantic mutation creates a common unit of observation across:

```text
source Change block
Change IR site
static Change Signature
Change Capability
formal semantic effect
runtime direct-Wasm transition
```

Beta.15 makes that connection executable for a useful numeric subset without asking the backend to self-report its own semantic labels.

## Next step

The strongest next step is to reduce trust in the static side of this validation chain. Two particularly valuable directions are:

1. a typed expression/core IR with an independently checked lowering contract; and
2. a machine-checked or independently generated relation connecting the validator's semantic effect occurrences to the Lean `Executes` / Change Signature Soundness model.

A benchmark suite can then measure the cost of the direct trace, transition validator and effect/capability checks separately.

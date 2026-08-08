# Direct runtime → Lean correspondence

Status: **0.2.0-beta.22**

Patch connects observed direct-WebAssembly executions to the Lean source/effect semantics with proof-free concrete occurrences and an untrusted `RuntimePath`. Beta.22 additionally composes that correspondence with the verified semantic policy checker, yielding Lean-checked **concrete runtime capability containment**.

This is an assurance layer, not end-to-end compiler verification.

## Pipeline

```text
Patch source
   ├─ formalSource + independent source validation -> SourceStmt
   └─ direct Wasm -> actual execution
                         ↓
                target/before/after transitions
                         ↓
              independent semantic validator
                         ↓
               concrete EvidenceEffect list

same execution context
   -> runtime-path-witness.js
   -> untrusted RuntimePath per protected invocation

SourceStmt + EvidenceEffect + RuntimePath + policy
   -> GeneratedRuntimeCertificate.lean
   -> PatchRuntime / PatchRuntimeCapability
```

## Effect refinement

A concrete runtime amount is represented as a singleton interval. For example:

```text
actual: increase [4,4]
formal: increase [0,5]
```

`EffectRefines actual expected` requires target, field and semantic operation equality and quantitative containment where amounts exist. `TraceRefines` lifts that relation pointwise to complete ordered traces.

## RuntimePath

The proof-free path vocabulary is:

```text
leaf
seq
branchThen
branchElse
repeatZero
repeatSucc
```

Lean's `decodeCorePath` validates a proposed path against formal `CoreStmt`; `decodeCorePath_sound` proves a successfully decoded path yields a genuine `Executes` trace.

A malformed JavaScript witness cannot establish correspondence merely because the producer emitted it.

## Main runtime correspondence theorem

```text
checkSourceRuntimeEvidence source observed path = true
------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

This is `checkSourceRuntimeEvidence_sound`.

Supported literal repeats are witnessed inductively with `repeatSucc` and `repeatZero`. Multiple protected recipe invocations are emitted and checked separately; different invocations may supply different branch/repeat witnesses.

## Beta.22 concrete runtime capability containment

`PatchRuntimeCapability.lean` adds three composition results.

### `allowsRefinedEffect`

```text
EffectRefines actual expected
Allows rule expected
-----------------------------
Allows rule actual
```

For magnitude-aware rules this is interval transitivity: `actual ⊆ expected ⊆ permitted` implies `actual ⊆ permitted`.

### `traceRefinesPreservesPolicy`

If every effect in a formal trace is admitted by the policy and an actual trace `TraceRefines` that formal trace, then every actual effect is admitted by the same policy.

### `checkedConcreteRuntimeCannotEscape`

```text
checkSourceRuntimeEvidence source observed path = true
checkSourceProtected source policy = true
-------------------------------------------------------
exists actualTrace,
  decodeRuntimeTrace observed = some actualTrace
  and every effect in actualTrace is allowed by policy
```

Generated runtime certificates now define the policy for each protected invocation, prove the source policy check with `native_decide`, and derive a theorem such as:

```text
runtime_reward_1_concrete_policy_safe
```

Therefore the final formal result is about the **decoded concrete observed effects**, not only the abstract formal trace.

## Multiple invocations example

```patch
create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    repeat 2:
      change score:
        add bonus

do reward(4)
do reward(0)
```

The producer can emit separate entries `reward#1` and `reward#2`; their occurrence lists and paths are checked independently against the same formal recipe/policy.

## Critical branch-condition boundary

The current formal effect core represents:

```text
branch thenBranch elseBranch
```

but does not retain the original Boolean guard. Accordingly `branchThen` and `branchElse` validate **structural execution alternatives**. Lean does not yet prove that the source expression guarding the branch evaluated to the selected Boolean.

This is now the highest-value correspondence gap. The next formal feature is a typed, guard-aware integer/Boolean execution core. Its branch rule should require actual guard evaluation and then erase/refine into the existing effect-only `CoreStmt` so current signature/capability proofs remain reusable.

## Producer boundary

`src/runtime-certificate.js` is not verified. It compiles/executes direct Wasm, receives the independently validated concrete effect stream, segments protected invocations, attaches RuntimePath evidence and emits Lean source. Source/trace SHA-256 hashes bind the artifact to exact bytes/observations but are not compiler-correctness proofs.

The JavaScript RuntimePath producer is also not verified. Its output is untrusted evidence checked by Lean; however, because the current formal branch core is guard-free, its branch choice is checked only against branch structure, not original condition truth.

## Current covered fragment

- SourceStmt direct changes and sequences;
- structural branch paths (`branchThen` / `branchElse`);
- literal repeats (`repeatSucc` / `repeatZero`);
- multiple observed protected recipe invocations;
- safe-integer quantitative concrete effects;
- verified formal policies;
- concrete runtime capability containment.

Outside the theorem today:

- source guard truth correspondence;
- recipe calls nested inside protected formal recipe bodies;
- dynamic repeats outside the literal core;
- GUI/event execution correspondence;
- undo/redo/preview/return semantics outside the formal source fragment;
- non-integer/floating-point correspondence;
- full language/compiler correctness.

## Correct claim

For accepted protected direct-Wasm invocations, proof-free concrete semantic occurrences and a control-flow witness are checked by Lean against a formal `SourceExecutes` trace. If the same formal source passes the verified Change Capability policy checker, Lean proves every decoded concrete effect is admitted by that policy.

Do **not** summarize this as “Patch is a verified compiler.”

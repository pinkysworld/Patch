# Direct runtime → Lean correspondence

Status: **0.2.0-beta.23** · Change IR **0.9**

Patch connects observed direct-WebAssembly executions to Lean source/effect semantics with proof-free concrete effects, `RuntimePath`, and concrete recipe invocation environments. Beta.23 additionally checks supported source branch guards against those environments before deriving runtime/capability conclusions.

This is a restricted assurance layer, not end-to-end compiler verification.

## Pipeline

```text
exact Patch source
   ├─ production AST -> SourceStmt + GuardTree + range/guard claims
   ├─ independent SourceStmt/range parser --------------------------┐
   └─ independent raw GuardTree/control-flow parser ---------------┤ compare
                                                                   ↓
actual direct Wasm -> observed target/before/after transitions     validated formal artifacts
   ↓
independent semantic reconstruction
   ↓
concrete EvidenceEffect list

same concrete invocation
   -> proof-free RuntimePath
   -> proof-free recipe parameter environment

Lean PatchGuarded
   -> GuardShape
   -> evalGuard
   -> GuardPathValid
   -> SourceExecutes + TraceRefines
   -> verified concrete Change Capability containment
```

## Effect refinement and capability containment

A concrete amount is represented as a singleton interval. For example:

```text
actual: increase [4,4]
formal: increase [0,5]
```

`EffectRefines` requires target/field/semantic-operation equality plus amount containment. `PatchRuntimeCapability.lean` proves authority is downward closed under this refinement and derives `checkedConcreteRuntimeCannotEscape` for accepted beta.22-style runtime evidence.

Beta.23 reuses that result inside `checkedGuardedConcreteRuntimeCannotEscape`, adding guard truth to the checked premises/conclusion.

## RuntimePath remains proof-free

```text
leaf
seq
branchThen
branchElse
repeatZero
repeatSucc
```

`PatchRuntime.lean` still checks structural execution and reconstructs an actual `SourceExecutes` trace. `RuntimePath` is not trusted simply because JavaScript emitted it.

## Beta.23 guard-aware layer

`PatchGuarded.lean` defines:

```text
GuardExpr
evalGuard
GuardTree
GuardShape
checkGuardShape / checkGuardShape_sound
GuardPathValid
checkGuardPath / checkGuardPath_sound
checkGuardedSourceRuntimeEvidence
checkGuardedSourceRuntimeEvidence_sound
checkedGuardedConcreteRuntimeCannotEscape
```

`GuardTree` runs in parallel with SourceStmt; it does not replace the effect-only core used by existing signature/capability proofs.

### GuardShape

The executable shape checker confirms GuardTree and SourceStmt contain the same sequence/branch/repeat skeleton. An independently extracted guard tree therefore cannot describe a different control-flow layout while reusing a SourceStmt proof.

### GuardPathValid

For a branch:

```text
branchThen path
```

requires Lean to establish:

```text
evalGuard guard invocationEnv = some true
```

while `branchElse` requires `some false`.

Thus branch choice is no longer only structurally possible; within the supported guard fragment it must agree with concrete guard evaluation.

## Example: two invocations

```patch
create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus

do reward(4)
do reward(0)
```

The producer supplies proof-free evidence equivalent to:

```text
reward#1:
  env bonus = 4
  path branchThen(...)

reward#2:
  env bonus = 0
  path branchElse(...)
```

The normalized guard is `0 < bonus`. Lean evaluates it itself. The first invocation can pass `branchThen`; the second must pass `branchElse`.

## Main theorem

A successful:

```text
checkGuardedSourceRuntimeEvidence
  source guardTree env observed path = true
```

implies:

```text
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
  and GuardShape source guardTree
  and GuardPathValid env guardTree path
```

`checkedGuardedConcreteRuntimeCannotEscape` additionally requires `checkSourceProtected source policy = true` and proves every decoded concrete runtime effect is allowed by that policy while retaining the GuardShape/GuardPathValid evidence.

## Independent guard translation validation

Change IR 0.9 contains `guardValidation` in addition to `sourceValidation`.

The production parser produces a GuardTree and normalized guard claims. `guard-validation.js` independently parses raw indentation/control-flow and compares its GuardTree, guard claims and recipe parameter vocabulary with production extraction. It does not import `parser.js` or consume the production AST.

The expression normalizer itself is shared; the independent claim is specifically about source/control-flow extraction and agreement of normalized claims, not two independently implemented expression parsers.

## Current formal guard fragment

Supported for guard-aware runtime certification:

```text
safe-integer recipe parameter values
integer literals + recipe parameter variables
+  -  unary -
scale by a non-negative integer literal
== != < > <= >=
true false
not and or
parentheses
```

Source `>`, `>=`, `!=` normalize into the smaller Lean GuardExpr vocabulary.

The stronger runtime checker rejects:

- persistent/global state in guards;
- decimal/non-integer concrete guard values;
- division/general variable multiplication;
- dynamic repeats outside the literal SourceStmt core;
- recipe calls nested inside protected formal bodies;
- GUI/event execution and wider language constructs.

These limitations do not automatically remove older static SourceStmt/signature/capability coverage. Guard-aware runtime certification is a separate stricter layer.

## Certificate producer boundary

`src/runtime-certificate.js` is not verified. It compiles/executes direct Wasm, receives independently validated concrete effects, segments protected invocations and emits source/guard/path/environment/policy data into Lean. Exact source bytes and observed transition trace are hash-bound in the certificate.

`runtime-path-witness.js` is also not verified. Beta.23 records concrete recipe parameter values alongside each protected invocation, but Lean evaluates the formal guard using those supplied values before accepting branch choice. Correct binding of JavaScript invocation values to machine-level Wasm parameters remains a validation/trust boundary, not a compiler-correctness theorem.

## Correct claim

For the beta.23 parameter-guard fragment, accepted protected direct-Wasm invocation evidence is checked by Lean for source/guard shape, concrete guard/path agreement, formal `SourceExecutes`, concrete effect refinement, and semantic Change Capability containment.

Do **not** summarize this as “Patch is a verified compiler.”

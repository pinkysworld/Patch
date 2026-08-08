# Patch Core Formal Model

Status: **beta.23: mechanized semantic-change contracts, independently translation-validated source/guard extraction, guard-aware runtime correspondence, and concrete runtime capability containment**.

Patch is not a fully verified compiler. The Lean model covers explicit fragments; the JavaScript frontend, WebAssembly lowering/runtime and implementation-side reconstruction remain named trust/validation boundaries.

## Lean modules

- `PatchFormal.lean` — semantic operations, changes, state, intervals, effects and policies.
- `PatchSignature.lean` — effect-only `CoreStmt`, `Executes`, `inferSignature`, Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic policy checker.
- `PatchEvidence.lean` — proof-free EvidenceStmt decoding/correspondence.
- `PatchSource.lean` — source `add/remove/set/clear`, normalization and `SourceExecutes`.
- `PatchRange.lean` — integer `RangeExpr` evaluation/analysis and `rangeAnalysisSound`.
- `PatchRuntime.lean` — `EffectRefines`, `TraceRefines`, proof-free `RuntimePath` and runtime correspondence.
- `PatchRuntimeCapability.lean` — concrete runtime capability containment.
- **`PatchGuarded.lean`** — beta.23 integer/Boolean guard evaluation, GuardTree/SourceStmt shape checking and guard-aware RuntimePath validity.

Formal CI builds every module, compiles generated static/runtime certificates under pinned Lean, and rejects `sorry`/`admit`.

## Core containment

For the effect-only structured core:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) ⊆ inferSignature(stmt)
```

Combined with the verified semantic policy checker:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

`allowsRefinedEffect`, `traceRefinesPreservesPolicy` and `checkedConcreteRuntimeCannotEscape` additionally transfer that authority result to decoded concrete runtime effects that refine the formal trace.

## Source and range translation validation

Production extraction:

```text
Patch source -> parser.js -> AST -> formalSource
```

Independent extraction:

```text
Patch source bytes -> source-validation.js -> raw SourceStmt/ranges
```

For supported static certification the two SourceStmt/range views must agree. Lean then performs source semantic normalization and checks integer range claims. This is translation validation, not parser verification.

## Beta.23 GuardExpr and GuardTree

The old effect-only `CoreStmt.branch` intentionally discarded the source condition. Beta.23 does **not** replace that mature effect core. Instead it adds a parallel guard artifact whose leaves line up with `SourceStmt`:

```text
GuardTree.leaf
GuardTree.seq
GuardTree.branch GuardExpr then else
GuardTree.repeat count body
```

The guard expression vocabulary is deliberately small:

```text
integer RangeExpr operands
true / false
==  <  <=
not / and / or
```

Source `!=`, `>` and `>=` are normalized into those constructors. Integer operands reuse `RangeExpr`: literal, parameter variable, addition, subtraction, negation and scale by a non-negative integer literal.

`evalGuard : GuardExpr -> IntEnv -> Option Bool` reuses the existing concrete integer evaluator from `PatchRange.lean`.

## Independent guard extraction validation

Change IR 0.9 adds `guardValidation`.

Production path:

```text
AST -> formalSource.guardTree + guardClaims
```

Independent path:

```text
raw source -> guard-validation.js indentation/control-flow parser
           -> raw GuardTree + guardClaims + parameter vocabulary
```

The raw guard parser does not import `parser.js` and does not consume the production AST. It shares only the small formal guard-expression normalizer; source/control-flow extraction is independent. Runtime certification requires exact agreement of GuardTree, guard claims and recipe guard variables.

## GuardShape

`GuardShape source tree` states that a GuardTree has the same control-flow skeleton as a `SourceStmt`. `checkGuardShape` is executable, and Lean proves:

```text
checkGuardShape source tree = true
=> GuardShape source tree
```

Thus guard evidence cannot silently describe a different branch/repeat layout from the source-core artifact.

## GuardPathValid

`RuntimePath` remains proof-free input:

```text
leaf
seq
branchThen
branchElse
repeatZero
repeatSucc
```

Beta.23 strengthens branch validation:

```text
GuardPathValid values (.branch guard then else) (.branchThen path)
```

requires

```text
evalGuard guard values = some true
```

and the else constructor requires `some false`.

`checkGuardPath` is executable and `checkGuardPath_sound` proves an accepted path satisfies this relational judgment. Repeat witnesses are checked inductively as before.

## Main beta.23 theorem

The combined checker is:

```text
checkGuardedSourceRuntimeEvidence
  source guardTree invocationEnv observedEffects runtimePath
```

A successful check implies:

```text
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
  and GuardShape source guardTree
  and GuardPathValid invocationEnv guardTree runtimePath
```

The theorem is `checkGuardedSourceRuntimeEvidence_sound`.

The capability corollary `checkedGuardedConcreteRuntimeCannotEscape` adds the verified policy premise and proves every decoded concrete runtime effect is admitted by the declared Change Capability while retaining `GuardShape` and `GuardPathValid` in the conclusion.

## Example

For:

```patch
make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus
```

one direct invocation may produce proof-free evidence:

```text
bonus = 4
RuntimePath.branchThen(...)
```

The certificate encodes the normalized guard as `0 < bonus`; Lean evaluates it under `bonus ↦ 4` and accepts the Then witness only if the result is true. A second invocation with `bonus ↦ 0` requires the Else witness.

## Current guard-aware boundary

Covered:

- safe-integer recipe parameter values;
- integer literals/parameter variables;
- `+`, `-`, unary `-`, multiplication by a non-negative integer literal;
- comparisons and Boolean `not/and/or`;
- branch/repeat/sequence structure;
- multiple protected invocations;
- concrete runtime effect refinement and capability containment.

Rejected by the stronger beta.23 runtime theorem:

- persistent/global state in guards;
- decimal/non-integer guard values;
- division and general variable multiplication;
- dynamic repeats outside the literal formal core;
- nested recipe-call semantics inside protected formal bodies;
- GUI/event execution and the wider Patch language.

A program may still be covered by the older static SourceStmt/signature/capability theorem even when its guard is outside beta.23. Guard-aware runtime coverage is deliberately a separate, stricter layer.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- JavaScript -> Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness outside the supported ABI;
- JavaScript semantic-effect reconstruction correctness;
- JavaScript RuntimePath/environment producer correctness.

The last item is why path/environment values remain proof-free inputs: Lean checks them against the independently validated formal guard/source artifacts.

## Research boundary

Guard semantics, operational semantics, refinement relations, proof-carrying evidence, translation validation and verified checkers all have substantial prior art. `PatchGuarded` is supporting assurance for Patch's primary design hypothesis, not a standalone firstness claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.

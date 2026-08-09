# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.29`** · **Change IR: `0.10`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

The same mutation substrate supports history, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and formal certificates without making normal source verbose.

## Status

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend; **Change IR 0.10** |
| Semantic contracts | Change Signatures + optional operation/magnitude-aware Change Capabilities |
| Static formal core | State-Change Factorization, signature soundness, policy containment, source/evidence correspondence and integer range soundness in Lean 4 |
| Guard-aware runtime | For a conservative safe-integer recipe-parameter fragment, Lean checks branch truth plus runtime-effect/capability correspondence |
| Abstract recipe calls | Lean-checked finite acyclic recipe environment with rank decrease, argument-interval fit and callee-signature containment |
| Exact recipe calls | Exact safe-integer `RangeExpr` argument evaluation/binding, arithmetic direct effects and **complete guard-selected traces for a conservative branch/sequence/static-repeat callee-body fragment** |
| Studio Designer | Source-backed control selection/property editing for Text, Button and Input |
| Window input | `input changed` exposes transient event-local `value`; persistent state changes only through explicit `change` |
| Targets | Web, Windows, macOS, Linux; FreeBSD Console via portable C99 |

## Try Patch

Node.js 22+ is required for the current CLI toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install
npm test

patch run examples/score.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
patch call-certify examples/formal-calls.patch --out Calls.patchcert.lean
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
npm run guarded-callee-trace-certify:example
```

## State-Change Factorization and semantic authority

Patch does not treat mutation as an ordinary write plus optional logging. Existing persistent state changes through the semantic `change` route. The compiler can therefore distinguish bounded increase from arbitrary replacement:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

For the structured effect core, Lean proves the containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.29: guard-aware exact structured callee traces

Beta.29 extends beta.28 with exact branch selection using the **existing verified `GuardExpr` semantics**. It does not introduce a second guard language or a new Change IR schema.

The supported `BoundStmt` fragment is now:

```text
skip
quantitative emit
sequence
static repeat
branch GuardExpr thenBody elseBody
```

For example:

```patch
create number score = 0
create number coins = 0

make award(amount number 1..5):
  if amount >= 3:
    change score:
      add amount
  else:
    change coins:
      add amount * 2

make caller_high(bonus number 0..4):
  do award(bonus + 1)

make caller_low(bonus number 0..4):
  do award(bonus + 1)

do caller_high(2)
do caller_low(0)
```

The concrete calls bind `amount = 3` and `amount = 1`. The proof-free production witness claims only the selected trace for each call:

```text
caller_high -> award: score increase [3,3]
caller_low  -> award: coins increase [2,2]
```

Lean independently reconstructs exact caller-to-callee binding, converts that `BindingList` into the same `IntEnv` used by the verified range semantics, evaluates the formal guard, evaluates only the selected branch body and checks the claimed trace through `evalBoundStmtEqBool_sound`.

Static body coverage remains stronger than the selected trace: `BoundBodyCovered` requires **both branch arms** to be represented in the callee semantic signature. `checkedConcreteCallBodyRefinesCallerSignature` then combines exact binding, selected trace evaluation, both-arm callee coverage and beta.25 `SignatureCovers` to establish that every concrete occurrence in the selected callee trace is represented by the caller signature.

`GeneratedGuardedCallBodyCertificate.lean` is generated from `examples/formal-callee-guard.patch`, and focused beta.29 CI verifies it with pinned Lean alongside the unchanged beta.28 regression certificate.

### Exact beta.29 boundary

Covered:

- beta.27 safe-integer exact argument binding;
- direct quantitative `add`/`remove` effects using the existing integer `RangeExpr` fragment;
- sequence;
- literal non-negative static repeat;
- `GuardExpr` Boolean/comparison composition over exact recipe-parameter bindings;
- exact true/false branch selection;
- complete concrete effect trace for the selected branch path;
- static callee-signature coverage for both branch arms;
- callee-to-caller signature import.

Still deliberately excluded:

- guard variables that depend on persistent state rather than exact recipe parameters;
- nested recipe calls inside the certified body;
- dynamic repeat counts;
- arbitrary amount/guard expressions outside the formal integer/Boolean fragments;
- complete transitive concrete traces across a nested call tree;
- recursive/floating-point call semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

Unsupported cases fail rather than being flattened into a stronger claim.

## Beta.28: exact structured callee traces

Beta.28 lifted the beta.26/27 concrete-call result from one direct quantitative leaf effect to a **complete exact semantic-effect trace** for a deliberately conservative branch-free callee-body fragment:

```text
skip
quantitative emit
sequence
static repeat
```

`GeneratedConcreteCallBodyCertificate.lean` remains generated and verified on every guarded-trace run as a regression certificate. Beta.29 is a strict extension of this branch-free fragment.

## Beta.27: arithmetic concrete call certificates

Beta.27 carries the already mechanized safe-integer `RangeExpr` grammar through the production certificate boundary:

```text
RangeExpr.lit
RangeExpr.var
RangeExpr.add
RangeExpr.sub
RangeExpr.neg
RangeExpr.scale Nat
```

For `do leaf(bonus + 1)` and `add amount * 2`, `GeneratedArithmeticCallCertificate.lean` preserves the formal expression tree. Lean re-evaluates it, reconstructs exact positional binding and checks the exact direct quantitative effect through `checkedConcreteBoundEffectRefinesCallerSignature`.

This is a coverage extension of existing mechanized arithmetic semantics, not a new arithmetic-analysis novelty claim.

## Beta.26: exact binding and direct effect refinement

`PatchCallSubstitution.lean` re-evaluates proof-free call arguments in an exact caller `IntEnv`, constructs positional `BindingList` evidence, and proves `concreteCallBinding_sound`. `PatchCallRefinement.lean` connects exact values through beta.25 argument intervals to declarations. `PatchCallEffect.lean` uses `EffectRefines` and proves direct quantitative leaf-effect refinement into the caller signature.

## Beta.25: abstract recipe-call composition

`PatchCalls.lean` checks a finite `RecipeEnv`: direct effects must occur in recipe signatures; calls must resolve to lower-rank recipes; argument intervals must fit declarations; and callee signatures must be contained in caller signatures. `callSignatureSoundness` proves modeled finite rank-decreasing call effects remain inside the caller signature.

## Semantic Window input

GUI input does not create a second persistent-write path:

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

`value` is transient event-local data. Editing the control does not assign persistent state; only explicit semantic `change` commits it.

## Change IR 0.10

The compiler carries separate assurance artifacts:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
formalCalls
sourceValidation
guardValidation
```

Beta.29 does **not** bump Change IR. Guard-aware structured concrete-call witnesses and certificates remain separate research artifacts derived from the existing AST + `formalCalls` boundary and reuse the existing formal guard representation.

## Window builds

The shared Window preflight supports button `clicked` and input `changed`, rejects duplicate/missing controls and prevents unsupported event/control combinations from being packaged.

| Target | Current result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

Console ready-app builds use project-specific sealed executables. Window ready-app builds use a hardened Electron player with `sandbox: true`, context isolation, no renderer Node integration and a minimal validated IPC payload bridge.

## WebAssembly and C99 boundaries

`--target wasm-direct` is a Console backend for the conservative numeric/control-flow/recipe subset. Raw `.direct.wasm` uses Patch's small host ABI and is **not yet a standalone WASI command module**.

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Formal and implementation modules

```text
src/formal-calls.js                       conservative finite abstract call artifact
src/concrete-call-witness.js              proof-free exact call/binding witness producer
src/concrete-call-certificate.js          exact/arithmetic binding/effect Lean certificate
src/concrete-call-body.js                 branch/sequence/repeat callee-body witness producer
src/concrete-call-body-certificate.js     guard-aware full-trace Lean certificate generator
formal/PatchRange.lean                    integer evaluator/range soundness
formal/PatchGuarded.lean                  verified GuardExpr evaluator + guarded runtime layer
formal/PatchCalls.lean                    ranked acyclic call composition
formal/PatchCallSubstitution.lean         exact argument evaluation + positional binding
formal/PatchCallRefinement.lean           exact value → abstract/declaration interval composition
formal/PatchCallEffect.lean               exact quantitative effect refinement
formal/PatchCallBody.lean                 executable guarded exact body traces
formal/PatchCallBodyImport.lean           whole-trace callee → caller signature composition
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, procedure-call semantics, parameter substitution, call graphs, interprocedural effect composition, arithmetic evaluation, structured operational semantics, guard evaluation, effect refinement, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI event plumbing.

The primary candidate contribution remains: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.29 strengthens the assurance story by checking exact guard-selected concrete callee traces while statically covering both arms. It is supporting assurance, not a separate firstness claim.

Patch is still **not a fully verified compiler**. Production parser/extractor correctness, JavaScript→Wasm lowering, the Wasm engine, proof-free witness extraction, nested/transitive concrete body semantics and production runtime equivalence remain explicit boundaries.

## Next priorities

Research: extend beta.29 with **nested/transitive exact concrete call traces**, then connect those certificates to observed direct-Wasm call execution; build semantic-security/plugin case studies, measure certificate/checker overhead and harden reproducibility/related work.

Product: drag positioning/resizing in the source-backed Designer, richer controls/event editing, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and direct-native compiler work.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

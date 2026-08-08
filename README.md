# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.24`** · **Change IR: `0.9`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0

change score:
  add 1

show score
```

The same structured mutation substrate supports history, undo/redo, preview, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and formal certificates without making ordinary source verbose.

## Status

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend; **Change IR 0.9** |
| Semantic contracts | Change Signatures + optional operation/magnitude-aware Change Capabilities |
| Static formal core | State-Change Factorization, signature soundness, policy containment, SourceStmt/evidence correspondence and integer range soundness in Lean 4 |
| Source validation | Independent raw-source parser translation-validates supported SourceStmt/range claims against the production AST path |
| Guard validation | **Independent raw-source guard parser** checks GuardTree, guard claims and recipe parameter vocabulary against production extraction |
| Runtime → Lean | Direct Wasm execution + proof-free effects/path/invocation environment → checked `SourceExecutes` + `GuardPathValid` |
| Branch truth | For the beta.23 parameter fragment, Lean checks `branchThen`/`branchElse` against actual integer/Boolean guard evaluation |
| Window input | **`input changed` exposes transient event-local `value`; persistent state changes only through explicit `change`** |
| Web/Desktop | Console + Standalone Window Web App; Windows/macOS/Linux Console + Window; FreeBSD Console via portable C99 |

## Try Patch

Node.js 22+ is required for the current CLI toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install
npm test

patch run examples/score.patch
patch formal examples/runtime-correspondence.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
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

For the structured effect core, Lean proves the familiar containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.24: semantic Window input events

GUI input must not create a second, invisible persistent-write path. Beta.24 therefore treats the current control value as **event-local data**:

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

`value` exists for the `changed` handler. Editing the DOM/control by itself does **not** assign to `name`. If a handler merely executes `show value`, the new text can be observed but persistent Patch state and history remain unchanged. Only an ordinary semantic `change` commits the value.

This contract is wired consistently through:

- Patch Studio interactive Window preview;
- the Standalone single-file Window Web runtime;
- generated Windows/macOS/Linux desktop Window players.

`src/window-events.js` is the shared adapter for interpreter-backed Window targets. The generated single-file browser runtime implements the same transient-value rule internally. Cross-target and executable fake-DOM regression tests cover both the observation-only and explicit-commit cases.

The shared Window preflight now permits exactly the portable event pairs **button `clicked`** and **input `changed`**. Unsupported combinations are rejected before packaging.

## Beta.23: guard-aware runtime correspondence

Beta.21/22 connected concrete direct-Wasm effects to formal execution and capability containment, but the old effect-only `CoreStmt.branch` erased the original source Boolean condition. Beta.23 closes that gap for a conservative fragment of guards over **concrete recipe parameters**.

Example:

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

The implementation produces separate proof-free invocation records such as:

```text
reward#1: bonus = 4, RuntimePath.branchThen(...)
reward#2: bonus = 0, RuntimePath.branchElse(...)
```

The assurance chain is:

```text
exact Patch source
  ├─ production AST -> SourceStmt + GuardTree + guard claims
  └─ independent raw-source parsers ---------------------┘ compare

actual direct-Wasm execution
  -> observed before/after transitions
  -> independently reconstructed semantic effects
  -> proof-free RuntimePath + concrete invocation IntEnv

Lean PatchGuarded
  -> GuardShape(SourceStmt, GuardTree)
  -> evalGuard guard IntEnv
  -> GuardPathValid(IntEnv, GuardTree, RuntimePath)
  -> SourceExecutes + TraceRefines
  -> checked concrete Change Capability containment
```

`PatchGuarded.lean` includes `GuardExpr`, `evalGuard`, `GuardTree`, `GuardShape`, `GuardPathValid`, `checkGuardedSourceRuntimeEvidence_sound`, and `checkedGuardedConcreteRuntimeCannotEscape`.

Persistent/global state in a guard, decimal guard values, division and general variable-by-variable multiplication remain outside this stronger guard-aware runtime-certification fragment. This does **not** invalidate the static SourceStmt/signature/capability proof path.

## Change IR 0.9

The compiler carries both source and guard translation-validation artifacts:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
sourceValidation
guardValidation
```

`formalSource` version 0.3 contains the SourceStmt/range representation plus a parallel GuardTree and formal guard claims. `guardValidation` comes from a separate indentation/control-flow parser that does not import the production parser or consume its AST.

This is **translation validation**, not a proof that either JavaScript parser is correct.

## Window builds

A standard button example remains:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

The shared Window preflight consumes normalized `code: 'WINDOW'` IR, rejects duplicate control ids and invalid handlers, and supports the two portable event pairs documented above. The generated Standalone Window Web runtime is executed in differential tests against `PatchInterpreter`, including real event rerendering and multi-operation semantic changes.

| Target | Current result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

## WebAssembly and C99 boundaries

`--target wasm-direct` is a Console backend for the conservative numeric/control-flow/recipe subset. Raw `.direct.wasm` uses the small Patch host ABI and is **not yet a standalone WASI command module**.

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1. For example: `patch build program.patch --target c99 --out Program.c`. FreeBSD GUI, OpenBSD and NetBSD remain unclaimed until separately tested.

## Formal and implementation modules

```text
src/source-validation.js       independent SourceStmt/range extraction validation
src/formal-guard.js            conservative integer/Boolean guard normalizer
src/guard-validation.js        independent raw-source GuardTree validation
src/runtime-path-witness.js    proof-free path + invocation environment producer
src/runtime-certificate.js     direct execution + guard-aware Lean certificate
src/window-events.js           transient Window event-local payload adapter
formal/PatchFormal.lean        factorization, intervals, effects, policies
formal/PatchSignature.lean     effect-only execution + signature soundness
formal/PatchChecker.lean       verified semantic policy checker
formal/PatchEvidence.lean      proof-free evidence decoding
formal/PatchSource.lean        source normalization + SourceExecutes
formal/PatchRange.lean         integer evaluator/range soundness
formal/PatchRuntime.lean       EffectRefines + RuntimePath correspondence
formal/PatchRuntimeCapability.lean  concrete runtime capability containment
formal/PatchGuarded.lean       guard truth + guarded runtime/capability correspondence
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, guard semantics, refinement relations, execution witnesses, translation validation, verified checkers, Proof-Carrying Code, WebAssembly/C generation, GUI event plumbing or native packaging.

The primary candidate contribution remains: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.24 is product/semantic-consistency evidence for that design principle, not a new primary novelty claim.

Patch is still **not a fully verified compiler**. Production parser correctness, JavaScript→Wasm lowering, the Wasm engine, runtime observation and JavaScript semantic reconstruction remain explicit trust/validation boundaries.

## Next priorities

Research: formal recipe-call/substitution semantics for the already implemented acyclic direct subset, then semantic-security case studies, certificate/checker overhead measurement and reproducibility hardening.

Product: richer Designer interaction, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a less token-dependent build service.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

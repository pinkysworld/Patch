# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.25`** · **Change IR: `0.10`**

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
| Recipe calls | **Lean-checked finite acyclic recipe environment with rank decrease, argument-interval fit and callee-signature containment** |
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

## Beta.25: formal recipe-call composition

Direct Wasm already executes acyclic numeric recipe-to-recipe calls. Beta.25 adds a conservative formal layer for that existing subset.

```patch
create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)
```

The production compiler emits a separate `formalCalls` artifact. For this example it assigns a well-founded rank such as:

```text
add_points     rank 0
reward         rank 1
double_reward  rank 2
```

`PatchCalls.lean` checks a finite `RecipeEnv`. Each direct effect must occur in the recipe's semantic signature. Each call must:

- resolve to an existing recipe;
- go to a strictly lower rank;
- pass an argument interval contained by the callee's declared parameter interval;
- import a callee semantic signature contained by the caller's semantic signature.

The executable checker is `checkRecipeEnv`. Its soundness theorem establishes `EnvironmentChecked`, and `callSignatureSoundness` proves that effects from a modeled finite rank-decreasing call execution remain inside the caller signature. `checkedRecipeExecutionCannotEscape` packages that result for a checked environment and looked-up root recipe.

`patch call-certify` turns the production `formalCalls` artifact into proof-free Lean data. Formal CI compiles the generated `GeneratedCallCertificate.lean` and requires:

```text
checkRecipeEnv callEnv = true
```

via `native_decide`.

### Exact beta.25 boundary

This is **abstract call composition**, not concrete substitution semantics. Call arguments are represented by statically established safe-integer intervals. Beta.25 does not yet prove that a concrete caller expression evaluates to a particular value, that this exact value is bound to the callee parameter, or that execution of the value-substituted callee body matches the production runtime. That is the next formal refinement.

Unknown callees, recursive/cyclic call graphs, duplicate recipe names, unbounded formal parameters, unsupported argument expressions and unsupported body constructs fail conservatively instead of being labelled verified.

## Beta.24: semantic Window input events

GUI input does not create a second persistent-write path:

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

`value` is transient event-local data. Editing the control itself does not assign persistent state; only the explicit semantic `change` commits it. Patch Studio, the standalone Window Web runtime and generated Windows/macOS/Linux Window players use the same contract.

## Beta.23: guard-aware runtime correspondence

For supported protected direct-Wasm recipes, proof-free concrete effects, `RuntimePath` and concrete recipe-parameter environments are checked by Lean against `SourceExecutes`, normalized source-guard truth and Change Capability containment. `PatchGuarded.lean` includes `GuardShape`, `GuardPathValid`, `checkGuardedSourceRuntimeEvidence_sound` and `checkedGuardedConcreteRuntimeCannotEscape`.

This remains a restricted formal fragment. Persistent/global state guards, floating-point guard correspondence and other unsupported expressions remain outside the stronger runtime theorem.

## Change IR 0.10

The compiler now carries separate assurance artifacts rather than overloading one representation:

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

`formalCalls` version 0.1 is intentionally separate from `formalSource`: beta.25 does not pretend recipe calls have suddenly become part of the older source/runtime correspondence theorem. The call artifact is checked by `PatchCalls` through its own explicit boundary.

## Window builds

The shared Window preflight supports the portable event pairs button `clicked` and input `changed`, rejects duplicate or missing controls and prevents unsupported event/control combinations from being silently packaged.

| Target | Current result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

## WebAssembly and C99 boundaries

`--target wasm-direct` is a Console backend for the conservative numeric/control-flow/recipe subset. Raw `.direct.wasm` uses Patch's small host ABI and is **not yet a standalone WASI command module**.

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Formal and implementation modules

```text
src/formal-calls.js            production-side conservative finite call artifact
src/call-certificate.js        generated proof-free Lean RecipeEnv certificate
src/source-validation.js       independent SourceStmt/range extraction validation
src/guard-validation.js        independent raw-source GuardTree validation
src/runtime-certificate.js     direct execution + guard-aware Lean certificate
src/window-events.js           transient Window event-local payload adapter
formal/PatchFormal.lean        factorization, intervals, effects, policies
formal/PatchSignature.lean     effect-only execution + signature soundness
formal/PatchChecker.lean       verified semantic policy checker
formal/PatchSource.lean        source normalization + SourceExecutes
formal/PatchRange.lean         integer evaluator/range soundness
formal/PatchRuntime.lean       EffectRefines + RuntimePath correspondence
formal/PatchRuntimeCapability.lean  concrete runtime capability containment
formal/PatchGuarded.lean       guard truth + guarded runtime/capability correspondence
formal/PatchCalls.lean         ranked acyclic call composition + call-aware signature soundness
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, call graphs, well-founded/ranked recursion restrictions, interprocedural effect composition, guard semantics, refinement, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI event plumbing.

The primary candidate contribution remains narrower: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.25 strengthens assurance that this semantic authority composes across an explicit acyclic recipe-call fragment; it is not a separate firstness claim.

Patch is still **not a fully verified compiler**. Production parser correctness, JavaScript→Wasm lowering, the Wasm engine, runtime observation and concrete recipe-value substitution remain explicit boundaries.

## Next priorities

Research: concrete recipe argument evaluation/parameter binding and substitution semantics, then semantic-security case studies, certificate/checker overhead measurement and reproducibility hardening.

Product: richer Designer interaction, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a less token-dependent build service.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

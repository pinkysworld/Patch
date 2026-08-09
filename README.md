# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.27`** · **Change IR: `0.10`**

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
| **Concrete recipe calls** | **Exact safe-integer `RangeExpr` argument evaluation/binding; arithmetic direct leaf effects refine imported caller-signature effects** |
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

## Beta.27: arithmetic concrete call certificates

Beta.26 established exact concrete binding for inter-recipe variable pass-through calls. Beta.27 removes that certificate-only restriction for the **already mechanized safe-integer `RangeExpr` fragment**. No new language syntax or theorem vocabulary is introduced; the production-to-Lean encoder now preserves:

```text
integer literals
ranged variables
addition
subtraction
unary negation
multiplication by a non-negative integer literal
```

For example:

```patch
create number score = 0

make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)
show score
```

The production witness says that `bonus = 4`; the generated Lean certificate encodes the actual source-side formal expressions rather than replacing them with their JavaScript results:

```text
call argument:  RangeExpr.add (RangeExpr.var "bonus") (RangeExpr.lit 1)
leaf amount:    RangeExpr.scale 2 (RangeExpr.var "amount")
```

Lean then re-evaluates the first expression to `5`, reconstructs the exact positional binding `amount = 5`, checks the concrete value through the beta.25 abstract interval into the declared range, re-evaluates `amount * 2` to `10`, constructs the singleton semantic effect `score increase [10,10]`, and checks that it refines an effect imported into the caller signature.

`GeneratedArithmeticCallCertificate.lean` is produced from `examples/formal-calls-arithmetic.patch` and compiled under the pinned Lean toolchain. Standard Formal CI checks both the original beta.26 variable-only example and this arithmetic example; a dedicated `Patch Beta27 Arithmetic Calls` workflow independently exercises the new certificate path.

### Exact beta.27 boundary

The concrete certificate now covers the formal integer expression fragment above for inter-recipe arguments and direct quantitative leaf amounts. It still deliberately rejects or excludes:

- division;
- general variable-by-variable multiplication;
- decimal/floating-point expressions;
- root-program concrete call certification;
- arbitrary multi-statement/branch/repeat/nested-call callee-body execution under exact bindings;
- recursive concrete calls;
- equivalence between formal concrete calls and production JavaScript/direct-Wasm execution.

This is a **coverage extension of an existing mechanized arithmetic semantics**, not a new arithmetic-analysis novelty claim and not full compiler verification.

## Beta.26: exact binding and direct effect refinement

Beta.26 introduced the concrete call assurance substrate. `PatchCallSubstitution.lean` re-evaluates proof-free call arguments in an exact caller `IntEnv`, constructs positional `BindingList` evidence, and proves `concreteCallBinding_sound`. `PatchCallRefinement.lean` connects exact values through beta.25 argument intervals to declarations. `PatchCallEffect.lean` uses the existing `EffectRefines` relation and proves `checkedConcreteBoundEffectRefinesCallerSignature` for a conservative direct quantitative leaf Change.

The production-generated `GeneratedConcreteCallCertificate.lean` is compiled under pinned Lean. Duplicate parameter names are rejected explicitly at the concrete binding boundary so `BindingList → IntEnv` cannot silently depend on shadowing order.

## Beta.25: abstract recipe-call composition

Direct Wasm already executes acyclic numeric recipe-to-recipe calls. Beta.25 added a conservative formal layer for that existing subset. The production compiler emits a separate `formalCalls` artifact with a well-founded rank, bounded safe-integer argument intervals and semantic signatures.

`PatchCalls.lean` checks a finite `RecipeEnv`: direct effects must occur in recipe signatures; calls must resolve to lower-rank recipes; argument intervals must fit declarations; and callee signatures must be contained in caller signatures. `callSignatureSoundness` proves modeled finite rank-decreasing call effects remain inside the caller signature.

## Beta.24: semantic Window input events

GUI input does not create a second persistent-write path:

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

`value` is transient event-local data. Editing the control does not assign persistent state; only explicit semantic `change` commits it. Patch Studio, the standalone Window Web runtime and generated Windows/macOS/Linux Window players use the same contract.

## Beta.23: guard-aware runtime correspondence

For supported protected direct-Wasm recipes, proof-free concrete effects, `RuntimePath` and concrete recipe-parameter environments are checked by Lean against `SourceExecutes`, normalized source-guard truth and Change Capability containment. This remains a restricted formal fragment rather than an end-to-end verified compiler.

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

Beta.27 does **not** bump Change IR. Its arithmetic concrete-call certificate remains a separate research artifact derived from existing AST + `formalCalls` information.

## Window builds

The shared Window preflight supports button `clicked` and input `changed`, rejects duplicate/missing controls and prevents unsupported event/control combinations from being packaged.

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
src/formal-calls.js                 conservative finite abstract call artifact
src/call-certificate.js             generated abstract-call Lean certificate
src/concrete-call-witness.js        proof-free exact call/binding witness producer
src/concrete-call-certificate.js    generated exact/arithmetic binding/effect Lean certificate
formal/PatchRange.lean              integer evaluator/range soundness
formal/PatchCalls.lean              ranked acyclic call composition
formal/PatchCallSubstitution.lean   exact argument evaluation + positional binding
formal/PatchCallRefinement.lean     exact value → abstract/declaration interval composition
formal/PatchCallEffect.lean         exact bound quantitative effect → caller-signature refinement
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, procedure-call semantics, parameter substitution, call graphs, interprocedural effect composition, expression evaluation, effect refinement, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI event plumbing.

The primary candidate contribution remains: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.27 makes a larger already-proved arithmetic fragment travel through the production certificate boundary; it is supporting assurance, not a separate firstness claim.

Patch is still **not a fully verified compiler**. Production parser/extractor correctness, JavaScript→Wasm lowering, the Wasm engine, proof-free witness extraction, arbitrary structured concrete call execution and production runtime equivalence remain explicit boundaries.

## Next priorities

Research: move from single direct leaf effects to **structured callee-body execution under exact bindings**, then connect call-aware formal traces to observed direct-Wasm call execution; build semantic-security/plugin case studies, measure certificate/checker overhead and harden reproducibility.

Product: richer Designer interaction, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a less token-dependent build service.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

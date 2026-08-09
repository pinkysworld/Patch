# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.30`** · **Change IR: `0.10`**

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
| Guard-aware runtime | Conservative safe-integer recipe-parameter guards checked against runtime effects/capabilities |
| Abstract recipe calls | Lean-checked finite acyclic recipe environment with rank decrease, argument-interval fit and callee-signature containment |
| Exact recipe calls | Exact safe-integer argument/binding evidence, guard-selected structured traces and **finite transitive exact call-tree traces** |
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
npm run transitive-callee-trace-certify:example
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

## Beta.30: finite transitive exact call-tree traces

Beta.30 closes the nested-call gap left by beta.29 without changing Change IR. The new `PatchCallTree.lean` layer keeps beta.29 `BoundStmt` as the call-free leaf semantics and composes it recursively across finite nested calls.

The call-tree fragment contains:

```text
base beta.29 BoundStmt
sequence
literal/static repeat
GuardExpr branch
ranked nested call
```

The beta.30 example contains:

```text
caller -> outer -> middle -> leaf
```

with a strongest certified outer edge containing two nested call levels. For the concrete example the complete selected transitive trace is:

```text
score increase [4,4]
coins increase [3,3]
```

The proof-free JavaScript producer preserves the **recursive call tree**. It does not flatten nested effects and ask Lean to trust the flattening.

Lean independently checks:

- exact outer `RangeExpr` argument evaluation and positional binding;
- beta.25 abstract interval fit for the concrete outer values;
- strict beta.25 rank decrease for the outer certified edge;
- every nested `RangeExpr` argument and newly constructed `BindingList`;
- strict rank decrease at every nested call-tree edge;
- exact `GuardExpr` branch selection;
- literal/static repeats;
- every supported direct quantitative effect;
- nested body coverage by the nested callee signature;
- edge-by-edge `SignatureCovers` import through the complete selected call tree;
- exact equality of the proof-free claimed trace with Lean's recursively evaluated trace.

The certificate-facing theorem is `checkedConcreteTransitiveCallTreeRefinesCallerSignature`. `GeneratedTransitiveCallBodyCertificate.lean` is regenerated and verified with pinned Lean in both focused beta.30 CI and standard Formal CI.

### Exact beta.30 boundary

Covered:

- finite acyclic/rank-decreasing beta.25 call environments;
- safe-integer `RangeExpr` arguments (`lit`, `var`, `add`, `sub`, `neg`, non-negative literal `scale`);
- exact outer and nested positional bindings;
- direct quantitative `add`/`remove` effects;
- sequence;
- literal non-negative static repeat;
- `GuardExpr` Boolean/comparison composition over exact recipe parameters;
- exact selected branch paths;
- complete finite selected transitive semantic-effect traces;
- strict outer and nested rank-decrease checks;
- nested semantic-signature coverage and edge-by-edge caller-signature import.

Still deliberately excluded:

- root-program call certification;
- recursive/cyclic call trees;
- dynamic repeat;
- persistent-state variables inside exact guard certificates;
- returns;
- expressions outside the supported safe-integer/Boolean formal fragments;
- floating-point call semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

Unsupported assurance cases fail closed rather than being flattened into a stronger claim.

## Beta.29: guard-aware exact structured callee traces

Beta.29 extended beta.28 `BoundStmt` with `branch GuardExpr thenBranch elseBranch`. Lean evaluates guards under the exact callee binding and certifies only the selected concrete trace, while static `BoundBodyCovered` still requires **both branch arms** to be represented in the callee semantic signature.

`GeneratedGuardedCallBodyCertificate.lean` remains required regression evidence in beta.30.

## Beta.28: exact structured callee traces

Beta.28 established complete exact traces for a branch-free direct quantitative callee fragment containing `skip`, `emit`, `sequence` and literal/static `repeat`. `GeneratedConcreteCallBodyCertificate.lean` remains regression evidence.

## Beta.25–27: call composition, exact binding and arithmetic

`PatchCalls.lean` checks finite acyclic recipe environments with rank decrease, argument-interval fit and callee-signature containment. Beta.26 added exact positional safe-integer binding and direct leaf-effect refinement. Beta.27 carried the already-mechanized integer `RangeExpr` grammar through generated concrete-call certificates.

These milestones are compositional assurance layers, not separate novelty claims.

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

Beta.30 does **not** bump Change IR. Transitive exact call-tree witnesses and certificates are derived research artifacts over the existing AST + `formalCalls` boundary.

## Window and native builds

The shared Window preflight supports button `clicked` and input `changed`, rejects duplicate/missing controls and prevents unsupported event/control combinations from being packaged.

| Target | Current result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

Console ready-app builds use project-specific sealed executables. Window ready-app builds use a hardened Electron player with `sandbox: true`, context isolation, no renderer Node integration and a minimal validated IPC payload bridge.

`--target wasm-direct` remains a Console backend for the conservative numeric/control-flow/recipe subset. Raw `.direct.wasm` uses Patch's small host ABI and is **not yet a standalone WASI command module**.

## Formal and implementation modules

```text
src/formal-calls.js                         conservative finite abstract call artifact
src/concrete-call-witness.js                proof-free exact call/binding witness producer
src/concrete-call-certificate.js            exact/arithmetic binding/effect certificate
src/concrete-call-body.js                   beta.28/29 structured body witness producer
src/concrete-call-body-certificate.js       beta.28/29 structured/guarded certificate generator
src/transitive-call-body.js                 beta.30 recursive call-tree witness producer
src/transitive-call-body-certificate.js     beta.30 recursive call-tree certificate generator
formal/PatchCalls.lean                      ranked acyclic abstract call composition
formal/PatchCallSubstitution.lean           exact argument evaluation + positional binding
formal/PatchCallRefinement.lean             exact value → abstract/declaration intervals
formal/PatchCallEffect.lean                 exact quantitative effect refinement
formal/PatchCallBody.lean                   executable beta.28/29 guarded exact body traces
formal/PatchCallBodyImport.lean             beta.28/29 whole-trace signature import
formal/PatchCallTree.lean                   beta.30 finite transitive exact call-tree traces
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, procedure-call semantics, parameter substitution, call graphs, interprocedural effect composition, arithmetic evaluation, structured operational semantics, guard evaluation, effect refinement, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI event plumbing.

The primary candidate contribution remains: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.30 strengthens the assurance story by mechanically checking finite selected transitive call traces. It is supporting assurance, not a separate firstness claim.

Patch is still **not a fully verified compiler**. Production parser/extractor correctness, JavaScript→Wasm lowering, the Wasm engine, proof-free witness extraction and production runtime call equivalence remain explicit boundaries.

## Next priorities

Research: connect beta.30 finite transitive call certificates to **observed direct-Wasm call execution**, then add semantic-security/engineering case studies, overhead measurements, systematic related work and a reproducibility bundle.

Product: drag positioning/resizing in the source-backed Designer, richer controls/event editing, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and direct-native compiler work.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

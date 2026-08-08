# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.22`** · **Change IR: `0.8`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0

change score:
  add 1

show score
```

The same structured mutation substrate supports history, undo/redo, preview, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and formal certificates without making ordinary source code verbose.

## Status

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend; Change IR 0.8 |
| Semantic contracts | Change Signatures + optional magnitude-aware Change Capabilities |
| Formal core | State-Change Factorization, signature soundness, policy containment, source/evidence correspondence and integer range soundness in Lean 4 |
| Source validation | **Independent raw-source parser** translation-validates supported `SourceStmt` and range claims against the production AST path |
| Runtime → Lean correspondence | Direct Wasm execution + independently reconstructed effects + untrusted `RuntimePath` → checked `SourceExecutes` trace |
| Concrete runtime authority | **Lean proves checked concrete runtime effects remain inside the declared Change Capability** via `checkedConcreteRuntimeCannotEscape` |
| Web apps | Console Web Apps embed direct Wasm; **Standalone Window Web App** uses a generated single-file Window runtime |
| Window quality | Generated Window Web runtime is differentially tested against `PatchInterpreter`; unsupported GUI event combinations fail before packaging |
| Desktop | Windows/macOS/Linux Console + Window/GUI packages; FreeBSD Console through portable C99 |

## Try Patch

Node.js 22+ is required for the current CLI toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install
npm test

patch run examples/score.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
```

## State-Change Factorization and semantic authority

Patch does not treat a mutation as an ordinary write plus optional logging. Existing persistent state changes through the semantic `change` route. The compiler can therefore distinguish authority such as bounded increase from arbitrary replacement:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

The formal containment story for the structured core is:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Runtime → Lean correspondence

Patch executes the supported direct-Wasm program, observes target/before/after transitions, independently reconstructs concrete semantic occurrences, and emits proof-free runtime evidence plus an untrusted control-flow witness:

```text
RuntimePath.leaf
RuntimePath.seq
RuntimePath.branchThen
RuntimePath.branchElse
RuntimePath.repeatZero
RuntimePath.repeatSucc
```

Lean does not trust those values as proofs. `PatchRuntime.lean` checks that the witness matches the formal effect/control-flow core and that the concrete effect trace refines an actual `SourceExecutes` trace. A concrete singleton amount such as `increase [8,8]` may refine an abstract formal effect `increase [0,10]`.

Beta.22 adds a further composition layer in `PatchRuntimeCapability.lean`:

```text
observed concrete runtime effects
        ↓ EffectRefines
formal SourceExecutes effects
        ↓ verified semantic policy
Change Capability
```

`allowsRefinedEffect` proves semantic authority is downward closed under `EffectRefines`. `traceRefinesPreservesPolicy` lifts that result to traces. `checkedConcreteRuntimeCannotEscape` then combines the runtime-evidence checker with the existing source policy checker: for an accepted protected invocation, every decoded concrete runtime effect is admitted by a declared policy rule.

This is still **not end-to-end compiler verification**. The JavaScript frontend, direct-Wasm lowering, Wasm engine, transition observation and implementation-side semantic reconstruction remain explicit trust/validation boundaries.

One important current formal limitation is also explicit: the existing `CoreStmt.branch` abstracts away the original Boolean guard. `RuntimePath.branchThen` / `branchElse` prove structural execution of a formal branch, not yet that the original source guard evaluated to that Boolean. The next formal/compiler feature is therefore a smaller typed, guard-aware execution core.

See [docs/RUNTIME_CORRESPONDENCE.md](docs/RUNTIME_CORRESPONDENCE.md).

## Window builds

The standard example is:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

Build targets:

| Target | Result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

The shared Window build preflight consumes normalized `code: 'WINDOW'` IR. It also rejects duplicate control ids, event handlers pointing at nonexistent controls, and event forms that are parsed but not yet wired consistently. The currently portable GUI event surface is deliberately **button `clicked`**. Input `changed` and window `closed` are not silently packaged as working features.

The Standalone Window Web runtime has regression/differential tests that actually execute generated HTML and compare important behavior with the reference interpreter, including sequential operations within one semantic `change`, declared create types, Thing-field validity and Counter button execution.

Patch Studio performs the same Window preflight before remote Windows/macOS/Linux dispatch. The target-side desktop packager repeats validation before creating an artifact.

## WebAssembly and C99 boundaries

`--target wasm-direct` is a Console backend. It directly lowers the supported numeric state/control-flow/recipe subset and imports the small Patch host ABI. A raw `.direct.wasm` is executable WebAssembly but **not yet a standalone WASI command module**.

```bash
patch build program.patch --target c99 --out Program.c
cc -std=c99 -O2 -o Program Program.c -lm
```

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and **FreeBSD 15.1**. FreeBSD GUI, OpenBSD and NetBSD remain unclaimed until they have separate executable gates.

## Formal and implementation assurance modules

```text
src/source-validation.js       Independent raw-source parser / translation validation
src/runtime-path-witness.js    Untrusted path/invocation witness producer
src/runtime-certificate.js     Direct execution + proof-free runtime certificate
src/window-build.js            Shared Window build/runtime support validation
src/window-webapp.js           Single-file Window browser backend
formal/PatchFormal.lean        Factorization, intervals, effects, policies
formal/PatchSignature.lean     Structured execution + Change Signature Soundness
formal/PatchChecker.lean       Verified semantic policy checker
formal/PatchEvidence.lean      Proof-free evidence decoding
formal/PatchSource.lean        Source normalization + SourceExecutes
formal/PatchRange.lean         Integer range-analysis soundness
formal/PatchRuntime.lean       EffectRefines + RuntimePath correspondence
formal/PatchRuntimeCapability.lean  Concrete runtime capability containment
```

## Research boundary

Patch does **not** claim that patches, first-class state change, effects, capabilities, interval/range analysis, provenance, translation validation, refinement relations, verified checkers, Proof-Carrying Code, WebAssembly compilation, C generation or native packaging are individually new.

The candidate contribution remains narrower: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware state-transition authority is derived from that same substrate**. The formal/validation architecture is supporting evidence for that design claim.

## Next priorities

The next research feature is a **typed, guard-aware execution core** that retains a small integer/Boolean condition language so a branch witness can be checked against actual guard evaluation instead of only nondeterministic branch structure. After that: formal recipe-call/substitution semantics, semantic-security case studies, checker/certificate overhead measurements and reproducibility hardening.

Product work continues with explicit input/change semantics, richer Designer interaction, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a less token-dependent remote build path.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

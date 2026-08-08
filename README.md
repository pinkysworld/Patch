# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.21`** · **Change IR: `0.8`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is an experimental general-purpose language built around one deliberately simple rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0

change score:
  add 1

show score
```

The source stays small while the compiler/runtime can derive history, undo/redo, preview, provenance, semantic **Change Signatures**, magnitude-aware **Change Capabilities**, range evidence and formal certificates from the same structured change model.

## Status at a glance

| Area | Beta.21 status |
|---|---|
| Language | Working interpreter and compiler front end; Change IR 0.8 |
| Semantic contracts | Change Signatures, optional Change Capabilities, numeric magnitude bounds |
| Formal work | Lean 4 factorization, signature soundness, policy containment, source/evidence checks and integer range soundness for explicit fragments |
| Source validation | **Independent raw-source parser** reconstructs formal `SourceStmt` + range claims and checks them against the production AST path before certification |
| Runtime correspondence | Direct Wasm execution → independently reconstructed effects + untrusted `RuntimePath` witness → **Lean-checked `SourceExecutes` trace**, now including branch/repeat paths and repeated protected invocations |
| Web apps | Console Web Apps embed direct Wasm; **Standalone Window Web App** uses a generated single-file Patch Window browser runtime |
| Direct backend | Numeric Console state, arithmetic, conditions, literal loops and non-recursive numeric recipes lowered directly to WebAssembly |
| Unix fallback | Same conservative numeric Console subset emitted as portable C99 and compile/run tested on FreeBSD 15.1 |
| Patch Studio | Browser-first PWA, editor, Run, first Window Designer, Changes/IR views and corrected Window build routing |
| Desktop builds | Windows/macOS/Linux Console + Window/GUI packages; FreeBSD Console package |

## Try Patch

Node.js 22+ is required for the current command-line toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install
npm test

patch run examples/score.patch
patch check examples/score.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
```

`patch formal` reports the semantic bridge, AST-derived formal source/range core and **Independent raw-source parser** validation separately. `patch runtime-certify` executes supported direct Wasm and produces a separate runtime correspondence certificate.

## Runtime → Lean correspondence

Beta.21 extends the first beta.20 runtime bridge with explicit, proof-free control-flow witnesses. The witness producer may propose:

```text
RuntimePath.leaf
RuntimePath.seq
RuntimePath.branchThen
RuntimePath.branchElse
RuntimePath.repeatZero
RuntimePath.repeatSucc
```

These values are **not trusted proofs**. `PatchRuntime.lean` checks that the supplied `RuntimePath` actually matches the decoded formal `CoreStmt`, that a branch choice is legal, that a repeat witness has the correct iteration shape/count, and that the reconstructed formal trace is a genuine execution.

For example:

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

The first invocation gets a `branchThen` witness with two repeat iterations; the second gets `branchElse`. Direct Wasm observes concrete transitions, the independent validator reconstructs concrete semantic effect occurrences, and Lean checks each invocation separately:

```text
source + abstract SourceStmt
          ↓
RuntimePath witness ─────┐
                        v
observed transitions → concrete EvidenceEffect list
                        ↓
              checkSourceRuntimeEvidence
                        ↓
∃ formalTrace actualTrace,
  SourceExecutes source formalTrace
  ∧ TraceRefines actualTrace formalTrace
```

A concrete effect such as `increase [4,4]` may refine an abstract effect such as `increase [0,5]`. The central runtime theorem remains `checkSourceRuntimeEvidence_sound`.

This is **not end-to-end compiler verification**. Direct-Wasm lowering, the Wasm engine, runtime observation and JavaScript-side semantic/path reconstruction remain implementation boundaries. The important change is that both the proof-free occurrence list and control-flow witness are accepted only when Lean reconstructs a valid formal execution.

See [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md).

## Window app builds: beta.21 routing fix

Patch Studio distinguishes Console and Window build paths instead of sending every target through Direct Wasm.

The normalized compiler IR represents a window as `code: 'WINDOW'`. Beta.21 uses that representation consistently for desktop preflight, fixing the earlier Studio bug that looked for a nonexistent `instruction.op === 'window'` and therefore rejected valid Window programs.

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

For **Windows, macOS and Linux App**, this source now passes the Window preflight and is submitted to the dedicated Window packaging workflow. For **Standalone Web App**, Window projects no longer enter the Console-only Direct Wasm compiler; they build as a self-contained HTML Window application instead.

Direct WebAssembly remains deliberately Console-only. Studio now reports that boundary directly and recommends a compatible Window target instead of exposing the lower-level `WINDOW ... not in the direct Wasm execution subset` error.

## Build from Patch Studio

| Target | Where it builds | Current result |
|---|---|---|
| Standalone Web App — Console | Locally in Studio | One `.html` file with direct Patch Wasm + tiny browser host |
| **Standalone Window Web App** | Locally in Studio | One `.html` file with generated Patch Window runtime, controls and events |
| Direct WebAssembly | Locally in Studio | Console subset only; directly lowered `.wasm` |
| Portable Patch app | Locally in Studio | `.patchapp` bundle |
| Windows Console | GitHub Actions Windows runner | `.exe` package |
| Windows Window/GUI | GitHub Actions Windows runner | Standalone packaged GUI app |
| macOS Console | GitHub Actions macOS runner | `.app` package |
| macOS Window/GUI | GitHub Actions macOS runner | Standalone packaged GUI app |
| Linux Console | GitHub Actions Linux runner | Native executable package |
| Linux Window/GUI | GitHub Actions Linux runner | Standalone packaged GUI app |
| FreeBSD Console | FreeBSD 15.1 VM | Native executable from portable C99 + FreeBSD `cc` |

For desktop cloud builds, select the operating system in Studio and press **Build**. Windows, macOS and Linux accept Console or Window projects. FreeBSD currently accepts Console projects only. A fine-grained GitHub token with Actions read/write permission is currently required for remote desktop builds; Studio does not save it to the Patch project or `localStorage`.

Beta.21 also changes the PWA to fetch same-origin JavaScript/HTML **network-first**, while retaining cached offline fallbacks. This reduces stale-Studio cases after a deployment while preserving installability/offline use.

See [Patch Studio](docs/PATCH_STUDIO.md) and [Application builds](docs/NATIVE_APPS.md).

## Portable C99 and FreeBSD

```bash
patch build program.patch --target c99 --out Program.c
cc -std=c99 -O2 -o Program Program.c -lm
./Program
```

The C99 generator applies the conservative compiled-Console support boundary and independently lowers normalized Change IR. It preserves numeric state, `set/add/remove/clear`, supported conditions, literal `repeat`/`count`, acyclic numeric recipes and ranged guards. Generated C is compile/run tested on Linux, macOS and **FreeBSD 15.1**.

FreeBSD Window/GUI, OpenBSD and NetBSD remain unclaimed until separate executable gates exist.

## WebAssembly boundaries

```text
--target wasm
  bootstrap carrier: source + Change IR for a Patch host

--target wasm-direct
  Console subset lowered directly to Wasm
  imports patch.show_number and patch.change_number
```

A raw `.direct.wasm` is executable WebAssembly but **not yet a standalone WASI command module**. Window source intentionally does not silently fall back to another execution mode when Direct Wasm is requested.

## Formal assurance

Patch is **not a fully verified compiler**. Its assurance architecture deliberately separates claims:

```text
exact Patch source
   ├─ production parser / AST → formalSource
   └─ Independent raw-source parser ─┘ comparison
                          ↓
          Lean source/evidence/signature/policy checks

separately:

direct Wasm execution
   ↓
observed before/after transitions
   ↓
independent semantic occurrence reconstruction
   + untrusted RuntimePath reconstruction
   ↓
Lean decode + path checking + TraceRefines
   ↓
SourceExecutes witness
```

For the structured formal core, Lean proves:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

Key modules:

```text
src/source-validation.js    independent raw-source extraction validator
src/runtime-path-witness.js untrusted branch/repeat/invocation path producer
src/runtime-certificate.js  direct execution + runtime certificate producer
src/window-build.js         normalized WINDOW build validation
src/window-webapp.js        standalone Window browser backend
PatchFormal.lean             factorization, intervals, effects, policies
PatchSignature.lean          structured execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer range-analysis soundness
PatchRuntime.lean            EffectRefines, RuntimePath checking and runtime correspondence
```

## CI notification behavior

Core CI and Lean workflows run on pull requests and pushes to `main`, not on every feature-branch push. This avoids duplicate full matrices while a branch is still being assembled.

## Documentation

| Document | Purpose |
|---|---|
| [SPEC](docs/SPEC.md) | Language syntax and semantics |
| [COMPILER](docs/COMPILER.md) | Parser → AST → Change IR, validation and backends |
| [FORMAL_MODEL](docs/FORMAL_MODEL.md) | Formal definitions, theorems and trust boundaries |
| [RUNTIME_CORRESPONDENCE](docs/RUNTIME_CORRESPONDENCE.md) | Direct runtime → Lean source-execution correspondence |
| [PATCH_STUDIO](docs/PATCH_STUDIO.md) | Browser IDE, Designer and cross-platform builds |
| [NATIVE_APPS](docs/NATIVE_APPS.md) | Desktop packaging plus FreeBSD/C99 Console path |
| [NOVELTY](docs/NOVELTY.md) | Contribution boundary and prior-art discipline |
| [ROADMAP](docs/ROADMAP.md) | Completed milestones and next priorities |
| [paper/](paper/) | Research manuscript source |

## What comes next

The highest-value next research steps are a smaller typed/independently checked lowering boundary, formal recipe-call/substitution semantics, semantic-security case studies and measured certificate/validation overhead. Product work should continue toward native AppKit/Win32/portable Unix GUI lowering, richer Designer interaction, signing/notarization and a less token-dependent build service.

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, WebAssembly compilation, C code generation or native packaging are individually new.

The candidate contribution is the combination of mandatory semantic mutation, operation/magnitude-aware semantic contracts, formal containment for a structured core, quantitative range assurance, independently checked source/runtime evidence boundaries, and increasing correspondence between concrete compiled execution and the same semantic change model.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

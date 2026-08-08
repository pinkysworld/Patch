# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.20`** · **Change IR: `0.8`**

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

| Area | Beta.20 status |
|---|---|
| Language | Working interpreter and compiler front end; Change IR 0.8 |
| Semantic contracts | Change Signatures, optional Change Capabilities, numeric magnitude bounds |
| Formal work | Lean 4 factorization, signature soundness, policy containment, source/evidence checks and integer range soundness for explicit fragments |
| Source validation | **Independent raw-source parser** reconstructs formal `SourceStmt` + range claims and checks them against the production AST path before certification |
| Runtime correspondence | Direct Wasm execution → independently reconstructed concrete semantic effects → **Lean-checked refinement of a formal `SourceExecutes` trace** for the current linear certified subset |
| Direct backend | Numeric state, arithmetic, conditions, literal loops and non-recursive numeric recipes lowered directly to WebAssembly |
| Unix fallback backend | Same conservative numeric Console subset emitted as portable C99 and compiled/smoke-run on FreeBSD 15.1 |
| Patch Studio | Browser-first PWA, editor, Run, first Window Designer, Changes and IR views |
| Desktop builds | Windows/macOS/Linux Console + Window/GUI packages; FreeBSD Console package |

## Try Patch

Node.js 22+ is required for the current command-line toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install

node src/cli.js run examples/score.patch
npm test
```

Useful commands:

```bash
patch run examples/score.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
patch run-wasm examples/direct-wasm-recipes.patch
```

`patch formal` reports the semantic bridge, AST-derived formal source/range core, and **Independent raw-source parser** validation separately. `patch runtime-certify` then executes a supported direct-Wasm program and produces a separate runtime correspondence certificate.

## Runtime → Lean correspondence

Beta.20 adds a checked bridge for concrete runtime effect occurrences. Consider:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

The formal source/range model permits the recipe effect:

```text
score increase [0,10]
```

The direct Wasm execution observes only target/before/after transitions. Patch's independent runtime validator reconstructs the concrete semantic occurrence:

```text
score increase [8,8]
```

The generated proof-free runtime certificate is then checked by `PatchRuntime.lean`. Lean establishes that the concrete trace pointwise refines an actual formal `SourceExecutes` trace:

```text
observed direct runtime transition
          ↓
independent semantic reconstruction
          ↓
EvidenceEffect occurrence [8,8]
          ↓
Lean decodeRuntimeTrace
          ↓
checkSourceRuntimeEvidence
          ↓
actual [8,8] refines formal [0,10]
          ↓
∃ formalTrace, SourceExecutes source formalTrace
```

The core theorem is `checkSourceRuntimeEvidence_sound`.

This is deliberately **not** described as end-to-end compiler verification. The runtime certificate is bound to hashes of the exact source bytes and observed direct transition trace, but JavaScript still reconstructs semantic occurrences from those runtime observations. Lean checks the resulting proof-free occurrence evidence against its formal source semantics.

Beta.20 initially supports **linear protected recipes** (`skip`, direct changes, and sequences). Formal branches and repeats remain outside runtime correspondence until explicit path witnesses are modeled; the tool rejects them rather than silently weakening the claim. The runtime certificate also requires one observed invocation per protected linear recipe and the current formal integer amount fragment.

See [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md).

## Build from Patch Studio

Patch Studio runs in a modern browser and can be installed as a PWA on desktop, iPhone and iPad.

| Target | Where it builds | Current result |
|---|---|---|
| Standalone Web App | Locally in Studio | One `.html` file with direct Patch Wasm + tiny browser host |
| Direct WebAssembly | Locally in Studio | Real directly lowered `.wasm`; uses the small Patch host ABI |
| Portable Patch app | Locally in Studio | `.patchapp` bundle |
| Windows Console | GitHub Actions Windows runner | `.exe` package |
| Windows Window/GUI | GitHub Actions Windows runner | Standalone packaged GUI app |
| macOS Console | GitHub Actions macOS runner | `.app` package |
| macOS Window/GUI | GitHub Actions macOS runner | Standalone packaged GUI app |
| Linux Console | GitHub Actions Linux runner | Native executable package |
| Linux Window/GUI | GitHub Actions Linux runner | Standalone packaged GUI app |
| FreeBSD Console | FreeBSD 15.1 VM | Native executable compiled from portable C99 with FreeBSD `cc` |

For desktop cloud builds, select the operating system in Studio and press **Build**. Windows, macOS and Linux accept **Console** or **Window** projects. FreeBSD currently accepts **Console** projects only. The current editor source is submitted to the relevant GitHub Actions workflow and does not have to be committed first.

A fine-grained GitHub token with Actions read/write permission is currently required. Studio keeps the token only in the current page and does not save it to the Patch project or `localStorage`.

See [Patch Studio](docs/PATCH_STUDIO.md) and [Application builds](docs/NATIVE_APPS.md).

## Portable C99 and FreeBSD

```bash
patch build program.patch --target c99 --out Program.c
cc -std=c99 -O2 -o Program Program.c -lm
./Program
```

The C99 generator first applies the same conservative support boundary used by direct Wasm, then independently lowers normalized Change IR to ordinary C99. It preserves numeric state, `set/add/remove/clear`, `show`, supported conditions, literal `repeat`/`count`, acyclic numeric recipes and ranged-parameter runtime guards.

The repository compiles and executes generated C99 on Linux, macOS and **FreeBSD 15.1**. OpenBSD, NetBSD and FreeBSD GUI remain unclaimed until they have their own executable gates.

## WebAssembly: two different targets

```text
--target wasm
  bootstrap carrier
  Patch source + Change IR embedded for a Patch host

--target wasm-direct
  supported Patch instructions lowered directly to Wasm
  imports the tiny Patch host ABI
```

Direct Wasm currently imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

A raw `.direct.wasm` is executable WebAssembly, but **not yet a standalone WASI command module**. Use `patch run-wasm`, a Standalone Web App, or a desktop package for a ready-to-run host.

## Compiled Console boundary

Direct Wasm and portable C99 share a conservative compiled Console subset:

```text
top-level numeric create
numeric set/add/remove/clear
numeric show
+ - * /
comparisons and boolean conditions
if / else
literal repeat + 1-based count
non-recursive / acyclic numeric recipes
ranged numeric parameter guards
block-level numeric transition hook
```

Outside that boundary, unsupported constructs fail explicitly instead of silently falling back. **Window/GUI desktop packages use a separate generated desktop player for the current Patch Window model. They are standalone applications on Windows, macOS and Linux, but not yet native AppKit/Win32/GTK widget code generation. FreeBSD GUI packaging is not yet implemented.**

## Formal assurance

Patch is **not a fully verified compiler**. Its assurance chain is intentionally layered:

```text
exact Patch source bytes
   ↓
production parser / AST ──────→ formalSource
   ↓                              ↑
Independent raw-source parser ────┘
   ↓
Lean RangeExpr / SourceStmt / EvidenceStmt / CoreStmt checks
   ↓
formal Change Signature + policy containment

separately:

direct Wasm execution
   ↓
observed before/after transitions
   ↓
independent semantic effect reconstruction
   ↓
proof-free concrete runtime evidence
   ↓
Lean runtime refinement → SourceExecutes
```

For the structured formal core, Lean proves:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

Key modules:

```text
src/source-validation.js   independent raw-source extraction validator
src/runtime-certificate.js direct execution + proof-free runtime certificate producer
PatchFormal.lean            factorization, intervals, effects, policies
PatchSignature.lean         structured execution + signature soundness
PatchChecker.lean           executable verified semantic policy checker
PatchEvidence.lean          proof-free evidence decoder + correspondence
PatchSource.lean            source verbs, normalization + source containment
PatchRange.lean             integer evaluation + range-analysis soundness
PatchRuntime.lean           concrete runtime-effect refinement + SourceExecutes correspondence
```

The main remaining runtime-formal gap is no longer the first linear occurrence bridge. The next formal expansion is **branch/repeat path witnesses, multiple recipe invocations, and ultimately a smaller independently checked lowering/runtime boundary**.

## CI notification behavior

The core CI and Lean workflows run on **pull requests and pushes to `main`**, not on every feature-branch push. This avoids duplicate full matrices while a branch is still being assembled. Native/FreeBSD workflows already use path-scoped pull-request checks plus `main` pushes.

## Documentation

| Document | Purpose |
|---|---|
| [SPEC](docs/SPEC.md) | Language syntax and semantics |
| [COMPILER](docs/COMPILER.md) | Parser → AST → Change IR, validation and backend architecture |
| [FORMAL_MODEL](docs/FORMAL_MODEL.md) | Formal definitions, theorems and trust boundaries |
| [RUNTIME_CORRESPONDENCE](docs/RUNTIME_CORRESPONDENCE.md) | Direct runtime → Lean source-execution correspondence |
| [PATCH_STUDIO](docs/PATCH_STUDIO.md) | Browser IDE, Designer and cross-platform Build workflow |
| [NATIVE_APPS](docs/NATIVE_APPS.md) | Windows/macOS/Linux packaging plus FreeBSD/C99 Console path |
| [NOVELTY](docs/NOVELTY.md) | Contribution boundary and prior-art discipline |
| [DIRECT_TRACE_VALIDATION](docs/DIRECT_TRACE_VALIDATION.md) | Independent Change-IR transition validation |
| [DIRECT_EFFECT_VALIDATION](docs/DIRECT_EFFECT_VALIDATION.md) | Runtime semantic-effect / contract validation |
| [ROADMAP](docs/ROADMAP.md) | Completed milestones and next priorities |
| [paper/](paper/) | Research manuscript source |

## What comes next

The highest-value next steps are:

1. extend runtime correspondence from linear recipes to explicit branch/repeat path witnesses and multiple invocations;
2. introduce a typed expression/core IR or another smaller independently checked lowering input;
3. build semantic-security case studies and measure certificate/validation overhead;
4. move Window packaging toward native AppKit/Win32 and a portable Unix GUI layer;
5. strengthen Designer interaction and desktop signing/notarization.

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, WebAssembly compilation, C code generation or native packaging are individually new.

The candidate contribution is the combination of mandatory semantic mutation, operation/magnitude-aware semantic contracts, formal containment for a structured core, separated source/evidence/signature claims, quantitative range assurance, source translation validation, and increasingly checked correspondence between concrete compiled execution and the same semantic change model.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

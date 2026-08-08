# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.19`** · **Change IR: `0.8`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

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

| Area | Beta.19 status |
|---|---|
| Language | Working interpreter and compiler front end; Change IR 0.8 |
| Semantic contracts | Change Signatures, optional Change Capabilities, numeric magnitude bounds |
| Formal work | Lean 4 factorization, signature soundness, policy containment, source/evidence checks and integer range soundness for explicit fragments |
| Source validation | **Independent raw-source parser** reconstructs formal `SourceStmt` + range claims and checks them against the production AST path before certification |
| Direct backend | Numeric state, arithmetic, conditions, literal loops and non-recursive numeric recipes lowered directly to WebAssembly |
| Unix fallback backend | Same conservative numeric Console subset emitted as portable C99 and compiled/smoke-run on FreeBSD 15.1 |
| Runtime validation | Interpreter differential tests plus independent transition and semantic-effect validation |
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
patch run-wasm examples/direct-wasm-recipes.patch
```

`patch formal` now reports three separate implementation/formal views: the semantic bridge, the AST-derived formal source/range core, and the **independent raw-source extraction validation**.

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

The repository compiles and executes generated C99 on Linux, macOS and **FreeBSD 15.1**. This is the start of Patch's generic Unix fallback strategy; OpenBSD, NetBSD and FreeBSD GUI remain unclaimed until they have their own executable gates.

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

Outside that boundary:

```text
dynamic repeat counts
create inside control-flow bodies
recursive recipe cycles
return-valued recipes
things and fields
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

Unsupported constructs fail explicitly instead of silently falling back.

**Window/GUI desktop packages use a separate generated desktop player for the current Patch Window model. They are standalone applications on Windows, macOS and Linux, but not yet native AppKit/Win32/GTK widget code generation. FreeBSD GUI packaging is not yet implemented.**

## Semantic Change Contracts

```patch
allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

For the supported range fragment, the production analyzer infers `bonus * 2` as `0..10`. A `set score = 999` is not treated as an `increase`, even though both operations write the same persistent location.

A protected numeric recipe can execute through direct Wasm with its declared parameter range enforced again at the Wasm function boundary. Portable C99 emits a corresponding runtime range guard.

## Formal assurance and source validation

Patch is **not a fully verified compiler**. Beta.19 narrows one important trust boundary without describing translation validation as a proof.

The production path derives:

```text
Patch source
   -> production parser / AST
   -> formalSource: SourceStmt + range claims
```

A new independent path deliberately does **not** import `parser.js` or consume the production AST:

```text
exact Patch source bytes
   -> small independent indentation-aware parser
   -> raw SourceStmt + raw formal range claims
   -> exact structural comparison with formalSource
```

For a protected recipe, `patch certify` now requires this raw-source comparison to pass before emitting the Lean certificate. Tampering with either the AST-derived `SourceStmt` or its range claim is covered by negative tests.

This reduces the trusted JavaScript extraction path, but it remains **translation validation**, not a machine-checked theorem that the production parser is correct.

After that implementation-side validation, Lean checks the formal chain:

```text
RangeExpr
   -> analyzeRange + rangeAnalysisSound
   -> SourceStmt
   -> source-operation normalization
   -> EvidenceStmt
   -> CoreStmt
   -> inferSignature
   -> compare production Change Signature
   -> verified semantic policy check
```

For the structured formal core, Lean proves:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and therefore:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

Key modules:

```text
src/source-validation.js independent raw-source extraction validator
PatchFormal.lean          factorization, intervals, effects, policies
PatchSignature.lean       structured execution + signature soundness
PatchChecker.lean         executable verified semantic policy checker
PatchEvidence.lean        proof-free evidence decoder + correspondence
PatchSource.lean          source verbs, normalization + source containment
PatchRange.lean           integer evaluation + range-analysis soundness
```

The largest remaining formal trust boundary is now **production/direct runtime effects → Lean `SourceExecutes` / `Executes`**, together with ultimately replacing validation of source extraction by a smaller verified or independently checkable frontend if that proves worthwhile.

## Direct runtime validation

The direct Wasm runtime reports a deliberately small observation:

```text
patch.change_number(i32 targetId, f64 before, f64 after)
```

An independent validator executes the supported Change IR semantics separately, reconstructs expected transitions and concrete semantic effects, then compares them with the observed direct execution, static Change Signature and, where present, Change Capability.

This is **translation/runtime validation evidence**, not a theorem that the entire compiler is correct. See [direct trace validation](docs/DIRECT_TRACE_VALIDATION.md) and [semantic-effect validation](docs/DIRECT_EFFECT_VALIDATION.md).

## Documentation

| Document | Purpose |
|---|---|
| [SPEC](docs/SPEC.md) | Language syntax and semantics |
| [COMPILER](docs/COMPILER.md) | Parser → AST → Change IR, validation and backend architecture |
| [PATCH_STUDIO](docs/PATCH_STUDIO.md) | Browser IDE, Designer and cross-platform Build workflow |
| [NATIVE_APPS](docs/NATIVE_APPS.md) | Windows/macOS/Linux packaging plus FreeBSD/C99 Console path |
| [FORMAL_MODEL](docs/FORMAL_MODEL.md) | Formal definitions, theorems and trust boundaries |
| [NOVELTY](docs/NOVELTY.md) | Contribution boundary and prior-art discipline |
| [DIRECT_TRACE_VALIDATION](docs/DIRECT_TRACE_VALIDATION.md) | Independent Change-IR transition validation |
| [DIRECT_EFFECT_VALIDATION](docs/DIRECT_EFFECT_VALIDATION.md) | Runtime semantic-effect / contract validation |
| [ROADMAP](docs/ROADMAP.md) | Completed milestones and next priorities |
| [paper/](paper/) | Research manuscript source |

## What comes next

The highest-value next steps are:

1. connect independently reconstructed runtime effect occurrences to Lean `SourceExecutes` / `Executes`;
2. introduce a typed expression/core IR or another smaller independently checked lowering input;
3. extend tested Unix portability only when actual platform gates exist;
4. move Window packaging toward native AppKit/Win32 and a portable Unix GUI layer;
5. strengthen Designer interaction and desktop signing/notarization.

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, WebAssembly compilation, C code generation or native packaging are individually new.

The candidate contribution is the combination of mandatory semantic mutation, operation/magnitude-aware semantic contracts, formal containment for a structured core, separated source/evidence/signature claims, quantitative range assurance, source translation validation and executable backends whose runtime behavior can increasingly be checked against the same semantic model.

## Repository map

```text
src/                    language, compiler, source/runtime validators, certificates, Wasm/C99 and app builders
formal/                 Lean factorization, signatures, checker, evidence, source, ranges
web/                    Patch Studio PWA and public project site
scripts/                smoke checks, native packaging and deterministic site build
tests/                  language, compiler, formal, source-validation, Wasm/C99 and app-build tests
examples/               runnable .patch programs
docs/                   specification, research, compiler and platform docs
paper/                   manuscript draft and references
.github/workflows/       CI, formal verification, native/FreeBSD builds and Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

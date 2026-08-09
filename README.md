# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Current development beta: `0.2.0-beta.31`** · **Change IR: `0.10`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

This mandatory mutation substrate supports history, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and generated Lean certificates.

## Current status

| Area | Status |
|---|---|
| Language | Working interpreter/compiler frontend; Change IR 0.10 |
| Formal core | State-Change Factorization, signature soundness, policy containment, integer range soundness |
| Calls | Exact safe-integer binding, guarded structured traces, finite transitive exact call trees |
| **Beta.31 runtime bridge** | **Call-aware direct-Wasm correspondence for unambiguous validated scoped traces** |
| Studio | Browser IDE + source-backed Designer property editing |
| Desktop | Ready Windows/macOS/Linux Console and Window downloads; FreeBSD Console via C99 |

## Beta.31: call-aware direct-Wasm correspondence

Beta.30 proves finite transitive exact call-tree traces for the supported rank-decreasing safe-integer fragment. Beta.31 connects those call trees to **an actually executed direct-Wasm program** without adding trusted call-enter/call-exit events to the backend.

The pipeline is:

```text
Patch source
  -> existing direct-Wasm compiler
  -> execute real Wasm module
  -> raw target/before/after transitions
  -> independent Change-IR trace/effect validation
  -> validated semantic effects with recipe scope
  -> unique scoped slice corresponding to beta.30 call-tree witness
  -> Lean re-evaluates the runtime-derived observed effects against CallTreeStmt
  -> observed trace refines caller semantic signature
```

For `examples/formal-transitive-calls.patch` the call chain is:

```text
caller -> outer -> middle -> leaf
```

The depth-2 observed/certified semantic trace is:

```text
leaf:   score increase [4,4]
middle: coins increase [3,3]
```

The direct-Wasm backend itself is unchanged. It emits only its existing transition trace. Recipe scope and semantic operation identity are reconstructed by the independent validator.

A runtime/call-tree correspondence is accepted only when the exact **scope + semantic-effect sequence** occurs once in the validated runtime-effect stream. If two indistinguishable occurrences exist, beta.31 refuses certification rather than guessing which invocation produced the slice.

### Lean bridge

`formal/PatchCallRuntime.lean` adds:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

The generated runtime-derived observed effect list is not assumed to be the beta.30 result. Lean checks:

```text
evalCallTreeStmtEqBool exactBindings exactCallTree observedEffects = true
```

and then reuses beta.30 exact binding, body coverage and signature import to derive:

```text
TraceRefinesSignature observedEffects callerSignature
```

The self-contained `GeneratedTransitiveRuntimeCertificate.lean` embeds the beta.30 generated certificate and beta.31 runtime-derived observations.

Regenerate it with:

```bash
npm run transitive-runtime-certify:example
```

Standard Formal CI verifies it with pinned Lean, and standard Windows/macOS/Linux CI executes the direct-Wasm program and regenerates the evidence.

### Exact beta.31 boundary

Covered:

- actual execution of the existing direct-Wasm backend;
- complete raw transition validation against the independent Change-IR executor;
- reconstructed semantic operation identity and recipe scope;
- exact safe-integer quantitative runtime effects;
- finite beta.30 transitive call-tree witnesses;
- unique contiguous scoped-effect attribution;
- exact runtime-derived observed effects re-evaluated against the beta.30 call tree in Lean;
- caller-signature refinement for that observed list.

Still explicit proof-free/trust boundaries:

- runtime trace capture;
- correctness/completeness of the independent JavaScript trace/effect validator;
- unique scoped-slice attribution from the validated stream to one concrete invocation;
- production parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.31 therefore **does not claim full compiler/runtime equivalence or full compiler verification**. Ambiguous repeated scoped traces fail closed.

## Beta.30: finite transitive exact call trees

`formal/PatchCallTree.lean` recursively re-evaluates nested `RangeExpr` arguments and constructs new exact positional `BindingList`s through `concreteCallBinding`. Lean checks strict outer/nested rank decrease, exact `GuardExpr` selection, literal/static repeats, direct quantitative effects and edge-by-edge `SignatureCovers` import.

The JavaScript witness preserves the recursive call tree rather than flattening nested effects. In beta.31 its witness schema is **0.2** because each exact effect occurrence additionally carries its expected recipe scope; the underlying beta.30 effect trace semantics remain unchanged.

## Earlier assurance milestones

- **Beta.29:** exact `GuardExpr` branch selection under exact recipe-parameter bindings, with both branch arms statically covered.
- **Beta.28:** exact direct quantitative sequence/static-repeat callee traces.
- **Beta.25-27:** finite abstract call composition, exact safe-integer positional binding and integer `RangeExpr` certificate coverage.
- **Beta.23:** conservative guard-aware direct-runtime/capability correspondence for an explicit fragment.

## Try Patch

Node.js 22+ is required for the current CLI toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm test
patch run examples/score.patch
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
```

## Studio and builds

Patch Studio provides source editing, Console/Window Run, Change Contract/IR views, source-backed Designer selection/property editing and ready desktop builds.

Windows, macOS and Linux default to **Ready app download (no token)**. Console apps use project-specific sealed executables. Window apps use a hardened sandboxed desktop player. FreeBSD Console uses the portable C99 backend.

GUI input remains semantic: an input edit exposes transient event-local `value`; persistent state changes only through explicit Patch `change`.

## Change IR 0.10

Beta.31 does not change the production IR schema. The call/runtime artifacts remain separate assurance evidence over the existing AST, `formalCalls`, direct-Wasm trace and validation layers.

## Research boundary

Patch does not claim novelty for effects, capabilities, procedure semantics, call graphs, transitive traces, runtime validation, proof-carrying evidence, WebAssembly or GUI packaging.

The primary candidate contribution remains:

> **ordinary persistent mutation is factored through a mandatory semantic Change representation, and operation-/magnitude-aware semantic authority is derived from that same mutation substrate.**

Beta.31 is supporting assurance. The next research hardening target is to replace unique scoped-slice attribution with an independently reconstructed concrete invocation-frame correspondence, allowing repeated identical calls to be disambiguated without compiler-emitted trusted call events.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.

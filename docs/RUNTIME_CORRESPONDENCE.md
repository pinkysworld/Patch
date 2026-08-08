# Direct runtime → Lean correspondence

Status: **0.2.0-beta.21**

Beta.21 connects observed direct-WebAssembly executions to the existing Lean source semantics with explicit, proof-free control-flow witnesses. It supports the formal branch/repeat fragment and multiple observed protected recipe invocations while keeping the producer outside the trusted theorem base.

This is an assurance layer, not a claim of end-to-end compiler verification.

## Goal

The repository has three relevant pieces:

1. Lean semantics for `SourceStmt` / `CoreStmt` and `Executes`.
2. A direct-Wasm backend that emits a small transition observation: target/before/after.
3. An independent JavaScript validator that reconstructs concrete semantic effects from those observations and checks them against Change Signatures/Capabilities.

Beta.20 connected a linear concrete occurrence list to `SourceExecutes`. Beta.21 adds enough explicit execution-path evidence to preserve **ordered execution correspondence through `branch` and literal `repeat`**, and it certifies repeated protected recipe invocations separately.

## Pipeline

```text
Patch source bytes
      |
      +------------------------------+
      |                              |
      v                              v
formalSource + sourceValidation   direct Wasm compiler
      |                              |
      v                              v
formal SourceStmt                actual Wasm execution
                                     |
                                     v
                         patch.change_number(before,after)
                                     |
                                     v
                         independent effect validator
                                     |
                                     v
                           concrete EvidenceEffect list

same execution context
      |
      v
runtime-path-witness.js
      |
      v
untrusted RuntimePath per protected invocation

SourceStmt + EvidenceEffect + RuntimePath
      |
      v
GeneratedRuntimeCertificate.lean
      |
      v
PatchRuntime.checkSourceRuntimeEvidence
      |
      v
exists formalTrace actualTrace:
  SourceExecutes source formalTrace
  and TraceRefines actualTrace formalTrace
```

## Effect refinement

A static amount can be an interval. For example:

```patch
make reward(bonus number 0..5):
  change score:
    add bonus
```

has formal effect:

```text
increase [0,5]
```

A concrete call `reward(4)` produces:

```text
increase [4,4]
```

`EffectRefines actual expected` requires target, field and semantic operation equality and, for quantitative effects, concrete interval containment inside the formal interval.

`effectRefinesBool_sound` proves the executable check sound. `TraceRefines` is Patch's own pointwise list relation and `traceRefinesBool_sound` connects the Boolean checker to it.

## RuntimePath

Beta.21 defines:

```text
RuntimePath.leaf
RuntimePath.seq(first, second)
RuntimePath.branchThen(path)
RuntimePath.branchElse(path)
RuntimePath.repeatZero
RuntimePath.repeatSucc(body, rest)
```

This witness is intentionally proof-free and untrusted. A JavaScript producer may propose a path, but Lean accepts it only if it matches the formal statement.

### Branch witnesses

For a formal:

```text
branch thenBranch elseBranch
```

only these shapes are accepted:

```text
branchThen path -> path must decode against thenBranch
branchElse path -> path must decode against elseBranch
```

A branch witness cannot be applied to a non-branch statement.

### Repeat witnesses

A literal formal repeat is checked inductively:

```text
repeatZero
  accepted only for repeat 0

repeatSucc bodyPath restPath
  accepted for repeat (n + 1)
  bodyPath must execute one body
  restPath must execute repeat n body
```

Each `repeatSucc` has its own body path, so different branches can be taken in different iterations.

## Lean path checker

`formal/PatchRuntime.lean` defines:

```text
decodeCorePath
```

and proves:

```text
decodeCorePath path stmt = some trace
-------------------------------------
Executes stmt trace
```

as `decodeCorePath_sound`.

That theorem is important for the trust boundary: correctness of `runtime-path-witness.js` is **not an assumption** needed to conclude `Executes`. A wrong path simply fails to decode.

## Main runtime theorem

The executable checker is now:

```text
checkSourceRuntimeEvidence source observed path
```

Lean proves `checkSourceRuntimeEvidence_sound`:

```text
checkSourceRuntimeEvidence source observed path = true
------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

The checker performs source lowering, evidence decoding, path validation and concrete/formal trace refinement inside Lean.

## Multiple recipe invocations

The runtime certificate producer records each observed protected recipe invocation separately. Example:

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

The certificate contains logically separate entries such as:

```text
reward#1
  RuntimePath.branchThen(...repeatSucc...repeatSucc...repeatZero)
  observed effects: increase 4, increase 4

reward#2
  RuntimePath.branchElse(...)
  observed effects: none
```

Both are checked against the same formal recipe `SourceStmt`, but with their own path and concrete occurrence list.

## Runtime certificate producer

`src/runtime-certificate.js`:

1. compiles source through the direct-Wasm backend;
2. executes the produced module;
3. validates the observed transition trace independently;
4. reconstructs concrete semantic effect occurrences;
5. requires protected recipes to pass the existing formal-source/raw-source validation boundary;
6. obtains untrusted invocation/path information from `src/runtime-path-witness.js`;
7. segments concrete effects by protected invocation;
8. emits `SourceStmt`, proof-free `EvidenceEffect` list and `RuntimePath` into Lean;
9. binds the artifact to SHA-256 hashes of exact source bytes and observed direct transition trace.

Example:

```bash
patch runtime-certify examples/runtime-correspondence.patch \
  --out formal/GeneratedRuntimeCertificate.lean
```

Formal CI runs this command after a real direct-Wasm execution and then compiles the generated certificate with the pinned Lean toolchain.

## Current beta.21 boundary

Runtime certification currently covers supported protected recipe bodies whose formal source uses:

```text
skip
change
sequence
branch
literal repeat
```

and concrete increase/decrease magnitudes must currently be representable in the explicit formal integer fragment.

The same protected recipe may be invoked multiple times; each invocation is certified separately.

Still outside this correspondence layer:

- recipe calls nested **inside** the protected recipe body, because `SourceStmt` does not yet model call/substitution semantics;
- dynamic repeat counts outside the formal literal-repeat fragment;
- GUI/event execution correspondence;
- undo/redo/preview and other source constructs outside the formal core;
- return-valued recipe semantics in this formal layer;
- floating-point/non-integer magnitude correspondence.

`set` and `clear` retain semantic operation identity but do not carry a quantitative amount in the current formal effect model.

## What this establishes

For each successful generated beta.21 invocation certificate, Lean checks that:

- the proof-free concrete effects decode to valid formal `Effect` values;
- the supplied `RuntimePath` matches the formal CoreStmt structure;
- the path yields an actual `Executes` trace (`decodeCorePath_sound`);
- the surrounding source therefore has a real `SourceExecutes source formalTrace` witness;
- every concrete occurrence pointwise refines the corresponding formal occurrence via `TraceRefines`.

## What it does not establish

Beta.21 still does not prove:

- correctness of the JavaScript parser;
- correctness of the direct-Wasm compiler;
- correctness of the Wasm engine;
- completeness of the runtime observer outside the supported backend ABI;
- correctness of JavaScript semantic reconstruction from before/after transitions;
- correctness of the JavaScript `RuntimePath` producer itself;
- formal call/substitution correspondence;
- floating-point semantics correspondence;
- end-to-end correctness for the full Patch language.

The crucial distinction is that **the path producer need not be trusted for the formal conclusion**: its output must pass Lean's structural path checker before `SourceExecutes` follows.

## Next strengthening step

The next high-value formal extension is recipe-call/substitution semantics for the existing non-recursive direct subset, followed by a smaller typed/independently checked lowering boundary and a concrete-runtime capability corollary derived from `EffectRefines` plus formal policy admission.

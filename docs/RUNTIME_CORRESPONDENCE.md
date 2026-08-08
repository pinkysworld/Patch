# Direct runtime → Lean correspondence

Status: **0.2.0-beta.20**

Beta.20 connects one concrete compiled execution path to the existing Lean source semantics for a deliberately small, auditable subset. It is an assurance layer, not a claim of full compiler verification.

## Goal

Before beta.20 the repository had two strong but separate facts:

1. Lean proves properties of `SourceStmt` / `CoreStmt` executions.
2. An independent JavaScript validator reconstructs semantic effects from direct-Wasm `target/before/after` transitions and checks them against production Change Signatures and Change Capabilities.

The missing bridge was whether concrete observed runtime effect occurrences could be admitted by the formal execution semantics.

Beta.20 adds that bridge for linear protected recipes.

## Pipeline

```text
Patch source bytes
      |
      v
source-validation + formalSource
      |
      v
formal SourceStmt

same source
      |
      v
direct Wasm compiler
      |
      v
actual Wasm execution
      |
      v
patch.change_number(target,before,after)
      |
      v
independent direct trace/effect validator
      |
      v
concrete proof-free EvidenceEffect list
      |
      v
GeneratedRuntimeCertificate.lean
      |
      v
PatchRuntime.checkSourceRuntimeEvidence
      |
      v
exists formalTrace:
  SourceExecutes source formalTrace
  and observedTrace pointwise refines formalTrace
```

## Why refinement is required

A formal effect may be an abstract interval. For example:

```patch
make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

has a formal amount interval:

```text
increase [0,10]
```

If the direct program calls `reward(4)`, the concrete runtime occurrence is:

```text
increase [8,8]
```

The concrete occurrence should not have to equal the abstract formal interval. Instead beta.20 defines `EffectRefines actual expected`: target, field and semantic operation must agree, and a concrete amount interval must lie within the formal amount interval.

The executable checker `effectRefinesBool` is proved sound with respect to that relation.

## Lean module

`formal/PatchRuntime.lean` defines:

```text
EffectRefines
 effectRefinesBool
 effectRefinesBool_sound

decodeRuntimeTrace
traceRefinesBool
traceRefinesBool_sound

decodeLinearEvidenceTrace
decodeLinearEvidenceTrace_sound

checkSourceRuntimeEvidence
checkSourceRuntimeEvidence_sound
```

The main theorem has the shape:

```text
checkSourceRuntimeEvidence source observed = true
-------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and List.Forall2 EffectRefines actualTrace formalTrace
```

This is the important new connection: accepted concrete runtime occurrences are tied to an execution in the existing mechanized source semantics rather than only to a production-side signature.

## Runtime certificate producer

`src/runtime-certificate.js`:

1. compiles the source through the direct-Wasm backend;
2. executes the produced module;
3. passes the observed transition trace through the independent semantic-effect validator;
4. requires protected recipes to have already passed raw-source extraction validation;
5. converts concrete integer effects to proof-free `EvidenceEffect` occurrences;
6. emits a Lean artifact importing `PatchRuntime`;
7. binds the artifact to SHA-256 hashes of both the exact Patch source bytes and the observed direct transition trace.

Example:

```bash
patch runtime-certify examples/runtime-correspondence.patch \
  --out formal/GeneratedRuntimeCertificate.lean
```

Formal CI generates this artifact from a real direct-Wasm execution and compiles it with the pinned Lean toolchain.

## Current beta.20 boundary

The first runtime-correspondence checker is intentionally linear. It accepts formal source evidence consisting of:

```text
skip
change
sequence
```

It rejects formal `branch` and `repeat` at this layer. Direct Wasm itself supports those constructs, but beta.20 does not yet claim formal runtime-path correspondence for them.

The certificate producer also currently requires:

- protected recipes;
- raw-source extraction validation to have passed;
- one observed invocation per protected linear recipe;
- runtime increase/decrease amounts representable as non-negative safe integers;
- direct-Wasm support for the whole executed application.

`set` and `clear` retain semantic operation identity but do not carry a numeric magnitude in the formal effect model.

## What this establishes

For a successful generated beta.20 runtime certificate, Lean checks that:

- the supplied proof-free runtime occurrences decode to valid formal effects;
- every observed occurrence semantically refines the corresponding formal effect;
- the formal effect sequence is an actual `SourceExecutes` trace of the supplied formal source statement;
- interval containment used for occurrence refinement is checked by Lean's executable interval checker and its soundness theorem.

## What it does not establish

Beta.20 still does not prove:

- correctness of the JavaScript direct-Wasm compiler;
- correctness of the Wasm engine;
- that `patch.change_number` observes every possible machine-level mutation outside the supported backend contract;
- correctness of the JavaScript reconstruction from `before/after` transitions to semantic effect occurrences;
- branch/repeat path correspondence;
- multiple invocation segmentation;
- floating-point-to-integer formal correspondence;
- end-to-end correctness for the full Patch language.

The independent validator and trace hashes make disagreements observable and reproducible, but they remain translation/runtime validation infrastructure.

## Next strengthening step

The next formal extension should introduce explicit execution-path witnesses for:

```text
branchThen / branchElse
repeat iteration witnesses
recipe invocation identifiers
```

That would allow the same runtime-certificate architecture to cover the already implemented direct-Wasm control-flow subset without weakening the theorem to unordered membership or signature-only checking.

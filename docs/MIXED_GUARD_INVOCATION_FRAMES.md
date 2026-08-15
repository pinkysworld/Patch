# Mixed-guard invocation-frame evidence

Status: Patch **0.2.0-beta.34**, Change IR **0.10**, beta.32 runtime-correspondence evidence.

This regression strengthens the existing beta.32 invocation-frame evidence without changing the language, Change IR, direct-Wasm backend contract, or Lean theorem boundary.

## Scenario

`examples/formal-transitive-calls-mixed-guards.patch` executes three root invocations:

```text
caller(1)
caller(4)
caller(1)
```

Each invocation follows the finite ranked call chain:

```text
caller -> outer -> middle -> leaf
```

`leaf` contains a guard:

```text
if amount >= 3:
  score increases by amount
else:
  coins increases by amount * 2
```

The concrete leaf arguments are `2`, `5`, and `2`. Therefore the independently validated runtime effects are:

```text
coins +4
score +5
coins +4
```

The first and third root invocations are intentionally identical. The middle invocation follows the opposite guard branch.

## What the beta.32 correspondence must preserve

The regression requires:

- complete direct-Wasm transition validation succeeds;
- three semantic runtime transitions and three semantic effects are observed;
- twelve concrete invocation frames are independently reconstructed across the three four-frame call chains;
- six transitive runtime correspondences are supported, with no unsupported candidate;
- maximum certified nested call depth is two;
- the three `caller -> outer` correspondences have distinct dynamic frame identities;
- their exact reconstructed `seed` bindings are `1`, `4`, and `1`;
- their selected occurrence ranges remain distinct;
- the first and third selected effect traces are equal;
- the middle selected effect trace is different because its guard selects the other branch;
- every selected runtime effect trace equals the corresponding beta.30 exact call-tree trace.

The important property is not merely that the final state is correct. Repeated identical calls must remain separately attributable even when another invocation of the same call site takes a different branch between them.

## Lean evidence

Generate the certificate with:

```bash
npm run transitive-runtime-certify:mixed-guards
```

This writes:

```text
formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean
```

The generated certificate uses the same beta.32 structure as the single-call and repeated-identical-call evidence:

1. the real direct-Wasm program executes;
2. the independent validator reconstructs semantic effects and dynamic invocation frames without trusted backend call markers;
3. the selected frame binding is required to equal the beta.30 exact callee `BindingList`;
4. Lean re-evaluates the frame-selected observed effects with `evalCallTreeStmtEqBool`;
5. `checkedObservedTransitiveRuntimeRefinesCallerSignature` concludes refinement for the accepted observed list.

The `Patch Beta32 Invocation Frames` workflow generates and checks the mixed-guard certificate with pinned Lean and rejects `sorry`/`admit` in the beta.32 evidence files.

## Reproducibility

The commit-bound `Patch Reproducibility Bundle` regenerates and packages `GeneratedMixedGuardTransitiveRuntimeCertificate.lean` together with the existing single-call and repeated-call runtime certificates.

## Claim boundary

This evidence does **not** establish end-to-end compiler correctness. It does not prove correctness or completeness of runtime transition capture, the JavaScript independent validator, invocation-frame reconstruction, parser/extractor behavior, JavaScript-to-WebAssembly lowering, or the WebAssembly engine.

It strengthens a narrower beta.32 statement: for this supported finite safe-integer guarded call-tree fragment, independently reconstructed dynamic invocation frames can distinguish repeated identical calls while preserving different concrete guard-selected effect traces, and Lean can re-check the accepted frame-selected traces against the exact formal call-tree witnesses.

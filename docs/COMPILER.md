# Patch Compiler Architecture

Status: **0.2.0-beta.35** · Change IR **0.10** · formal milestone **beta.32**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard/runtime validation, direct Wasm/C99 backends, Window runtimes, desktop packaging and generated Lean certificates.

## Architecture

```text
Patch source
  -> production AST + Change IR 0.10
       ├─ Change Signatures / Capabilities
       ├─ formal source/guard artifacts
       └─ finite ranked formalCalls
  -> targets
       ├─ direct Wasm
       ├─ C99
       ├─ Web/Window runtimes
       └─ native packages
  -> assurance
       ├─ independent source/guard validation
       ├─ independent direct-Wasm transition/effect validation
       ├─ beta.30 exact transitive CallTreeStmt
       ├─ beta.31 observed-runtime bridge
       └─ beta.32 invocation-frame correspondence
```

Beta.32 does **not** change Change IR.

## Beta.30 call-tree layer

`src/transitive-call-body.js` preserves finite nested-call structure. `formal/PatchCallTree.lean` independently checks exact nested `RangeExpr` binding, strict call-graph rank decrease, exact selected guards/static repeats/direct effects, nested semantic-signature coverage and edge-by-edge signature import.

The certificate theorem remains:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

## Beta.32 invocation-frame runtime correspondence

Production-side modules:

```text
src/direct-trace-validator.js
src/direct-effect-validator.js
src/transitive-runtime-correspondence.js
src/transitive-runtime-certificate.js
scripts/generate-transitive-runtime-certificate.js
```

Formal bridge:

```text
formal/PatchCallRuntime.lean
```

The direct-Wasm backend is deliberately unchanged. It still emits only raw target/before/after transitions. The independent Change-IR validator executes the expected IR path, validates the complete observed transition stream, reconstructs semantic operation identity and recipe scope, and now reconstructs every concrete `DO` **invocation-frame**.

Each frame records:

```text
frameId
parentFrameId
callerScope
callee
dynamic invocation ordinal
depth
exact arguments
exact parameter BindingList
transitionStart / transitionEndExclusive
```

Every validated transition/effect also carries the active frame stack. `src/transitive-runtime-correspondence.js` therefore resolves a beta.30 witness by caller/callee/invocation identity and selects effects dominated by that concrete frame. Repeated identical calls no longer require globally unique scoped effect sequences.

The generated beta.32 certificate adds:

```text
runtimeFrameBindings = beta30ExactBindings
```

as a Lean-decided theorem and then checks:

```text
evalCallTreeStmtEqBool beta30ExactBindings exactTree frameSelectedObservedEffects = true
```

before reusing:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

This keeps the formal call-tree theorem unchanged while strengthening the evidence attribution layer.

## Generated certificates

Standard Formal CI verifies:

```text
GeneratedCertificate.lean
GeneratedRuntimeCertificate.lean
GeneratedCallCertificate.lean
GeneratedConcreteCallCertificate.lean
GeneratedArithmeticCallCertificate.lean
GeneratedConcreteCallBodyCertificate.lean
GeneratedGuardedCallBodyCertificate.lean
GeneratedTransitiveCallBodyCertificate.lean
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

Regenerate beta.32 runtime evidence with:

```bash
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

The repeated example contains two identical `do caller(1)` calls and must produce separate independently reconstructed frames/certificates.

## Exact Beta.32 boundary

Covered:

- real execution of the existing direct-Wasm backend;
- complete independent transition/effect validation;
- independently reconstructed semantic operation identity and recipe scope;
- concrete invocation-frame identity and exact parameter bindings;
- repeated identical calls distinguished by dynamic invocation frame;
- beta.30 exact safe-integer call-tree semantics;
- frame-selected observed lists re-evaluated in Lean;
- caller-signature refinement for accepted observed lists.

Explicit proof-free/trust boundaries:

```text
runtime capture
independent JavaScript validator and invocation-frame reconstruction correctness/completeness
production parser/extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
```

Beta.32 is not a complete compiler/runtime simulation proof or full compiler verification.

## Direct Wasm and other targets

Direct Wasm supports the conservative numeric Console subset including acyclic recipes. It imports Patch's small host ABI and is not yet a standalone WASI command. Portable C99 is tested on Linux, macOS and FreeBSD 15.1.

Things (`CREATE_THING`), text/boolean/list state and GUI execution are outside that numeric subset and fail closed rather than silently falling back to the interpreter. They remain outside the beta.32 Lean runtime-correspondence claim. Runtime Thing storage in the interpreter and Window Web path is prototype-free. Change Signatures are cloned with the same prototype-preserving semantic clone as runtime values, not JSON round-trips. `patch doctor` self-checks a tiny numeric program through the interpreter, direct Wasm and C99, executes host-compiled C99 when a Unix C compiler is present, then checks that a Thing program still fails closed on those backends. Fail-closed numeric-subset errors normalize to diagnostic code `PATCH2003` instead of a generic build failure.

Window preflight supports button `clicked` and input `changed`; input edits remain transient until Patch source performs semantic `change`.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and single/repeated beta.32 runtime certificate generation;
- pinned-Lean verification including `PatchCallRuntime` and both beta.32 generated runtime certificates;
- one focused beta.32 release gate, while historical beta.28/29 gates are manual-only and beta.30/31 focused PR workflows are retired;
- no `sorry`/`admit`;
- direct-Wasm execution and independent trace validation;
- native Windows/macOS/Linux Console/Window smoke builds when runtime-relevant paths change;
- public Studio/PWA/version consistency checks.

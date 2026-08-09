# Patch Compiler Architecture

Status: **0.2.0-beta.31** · Change IR **0.10**

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
       └─ beta.31 call-aware observed-runtime certificate
```

Beta.31 does **not** change Change IR.

## Beta.30 call-tree layer

`src/transitive-call-body.js` preserves finite nested-call structure. `formal/PatchCallTree.lean` independently checks exact nested `RangeExpr` binding, strict call-graph rank decrease, exact selected guards/static repeats/direct effects, nested semantic-signature coverage and edge-by-edge signature import.

The certificate theorem remains:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

## Beta.31 call-aware direct-Wasm correspondence

New production-side modules:

```text
src/transitive-runtime-correspondence.js
src/transitive-runtime-certificate.js
scripts/generate-transitive-runtime-certificate.js
```

New formal module:

```text
formal/PatchCallRuntime.lean
```

The direct-Wasm backend is deliberately unchanged. Beta.31 executes it and obtains the existing raw transition stream. `validateDirectSemanticEffects` first validates the complete trace against the independent Change-IR execution model. Only after whole-trace validation are semantic operation identity and recipe scope used for call-tree correspondence.

`src/transitive-call-body.js` witness schema is **0.2** in beta.31 because exact selected effects additionally preserve expected recipe scope. The beta.30 effect-only trace remains unchanged.

A runtime correspondence is accepted only when the exact scoped effect sequence occurs **exactly once** in the validated runtime semantic-effect stream:

```text
scope + target + field + operation + exact amount
```

Zero matches fail. Multiple matches are ambiguous and fail closed. Site ids, source lines and before/after values are preserved as audit evidence, but unique scoped-sequence attribution remains a proof-free boundary.

`PatchCallRuntime.lean` provides:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

Its generated premise is:

```text
evalCallTreeStmtEqBool exactBindings exactTree runtimeObservedEffects = true
```

Therefore Lean re-evaluates the beta.30 call tree **against the effects reconstructed from the real validated Wasm execution**, rather than trusting a JavaScript equality assertion.

`GeneratedTransitiveRuntimeCertificate.lean` embeds the complete beta.30 generated definitions and then adds runtime-derived observed effects and the beta.31 theorem.

Regenerate with:

```bash
npm run transitive-runtime-certify:example
```

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
```

Standard Windows/macOS/Linux CI also executes the direct-Wasm transitive example and regenerates beta.31 runtime evidence.

## Exact beta.31 boundary

Covered:

- real execution of the existing direct-Wasm backend;
- complete independent transition/effect validation;
- independently reconstructed semantic operation identity and recipe scope;
- unambiguous scoped-effect slice correspondence;
- beta.30 exact safe-integer call-tree semantics;
- runtime-derived observed list re-evaluated in Lean;
- caller-signature refinement for that observed list.

Explicit proof-free/trust boundaries:

```text
runtime capture
independent JavaScript validator correctness/completeness
scoped-slice attribution
production parser/extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
```

Beta.31 is not a complete compiler/runtime simulation proof. Repeated indistinguishable scoped traces are rejected rather than guessed.

## Direct Wasm and other targets

Direct Wasm supports the conservative numeric Console subset including acyclic recipes. It imports Patch's small host ABI and is not yet a standalone WASI command. Portable C99 is tested on Linux, macOS and FreeBSD 15.1.

Window preflight supports button `clicked` and input `changed`; input edits remain transient until Patch source performs semantic `change`.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests and beta.31 runtime certificate generation;
- pinned-Lean verification including `PatchCallRuntime` and `GeneratedTransitiveRuntimeCertificate.lean`;
- focused beta.28, beta.29, beta.30 and beta.31 workflows;
- no `sorry`/`admit`;
- direct-Wasm execution and independent trace validation;
- native Windows/macOS/Linux Console/Window smoke builds;
- public Studio/PWA/version consistency checks.

# Direct runtime → Lean correspondence

Status: **Beta.32** · Change IR **0.10**

Patch connects observed direct-WebAssembly execution to mechanized semantic-change evidence without claiming end-to-end compiler verification. The current assurance line combines independently validated target transitions, semantic effect reconstruction, finite exact call-tree witnesses and independently reconstructed concrete invocation frames.

The product may advance beyond beta.32, but **Beta.32 remains the current formal runtime-correspondence milestone**. Product work such as Native GUI IR 1.3 / sealed payload v13 / runtime v1.4, the frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line, and prototype-free Things does not widen this assurance claim.

## Current pipeline

```text
exact Patch source
  -> production AST + Change IR 0.10
       ├─ Change Signatures / Capabilities
       ├─ formal SourceStmt / GuardTree / range claims
       └─ finite ranked formalCalls

raw Patch source
  -> independent source/range validation
  -> independent guard validation
  -> independent static call-site validation

actual direct Wasm execution
  -> raw target / before / after transitions
  -> independent Change-IR execution + complete transition validation
  -> semantic operation / recipe-scope reconstruction
  -> concrete invocation frame reconstruction
  -> frame-selected observed semantic effects

Beta.30 exact CallTreeStmt witness
  + reconstructed invocation-frame BindingList
  + frame-selected observed effects
  -> Lean PatchCallRuntime
  -> exact binding equality
  -> exact call-tree trace re-evaluation
  -> observed-list refinement into caller Change Signature
```

## Historical layers retained by Beta.32

The current certificate stack is cumulative rather than a replacement of the earlier assurance layers:

- **Beta.23** added guard-aware direct-runtime/capability correspondence for the supported parameter-guard fragment.
- **Beta.25** added finite ranked abstract recipe-call composition.
- **Beta.26–27** added exact safe-integer positional binding and formal `RangeExpr` evaluation.
- **Beta.28** added exact direct quantitative sequence/static-repeat callee traces.
- **Beta.29** added exact formal-guard branch selection with both-arm static coverage.
- **Beta.30** added finite transitive exact call-tree semantics and edge-by-edge signature import.
- **Beta.31** first connected an observed direct-Wasm effect list to the beta.30 call-tree theorem, but conservatively rejected ambiguous repeated scoped traces.
- **Beta.32** removes that attribution ambiguity for the supported finite-call-tree subset by independently reconstructing concrete invocation frames.

## Beta.30 exact call-tree semantics

`formal/PatchCallTree.lean` checks finite recursive `CallTreeStmt` evidence. Call-free leaves retain the beta.29 structured semantics; ranked nested calls add exact argument evaluation and positional binding.

For each supported call edge Lean checks:

- exact safe-integer argument evaluation;
- exact parameter `BindingList` construction;
- strict rank decrease;
- selected formal-guard branch and literal/static-repeat execution;
- exact direct semantic effects;
- nested body coverage;
- semantic Change Signature containment and edge-by-edge import.

The main theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

## Beta.31 observed-runtime bridge

`formal/PatchCallRuntime.lean` connects a runtime-derived observed effect list to the beta.30 call-tree semantics through:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

A critical checked premise is:

```text
evalCallTreeStmtEqBool calleeBindings body observed = true
```

The observed effect list is therefore not trusted merely because JavaScript produced it. Lean re-evaluates the exact supported call-tree body under the expected concrete bindings and requires equality before deriving caller-signature refinement.

Beta.31 still needed a uniquely attributable scoped effect slice, so repeated indistinguishable calls could fail closed even when the underlying execution was valid.

## Beta.32 independent invocation-frame correspondence

The direct-Wasm backend remains deliberately unchanged. It emits raw semantic transition callbacks rather than trusted call-enter/call-exit metadata.

The independent Change-IR execution model in the validation path reconstructs every concrete `DO` invocation frame while validating the complete observed execution path. Each reconstructed frame contains:

```text
frameId
parentFrameId
callerScope
callee
dynamic invocation ordinal
depth
exact argument values
exact parameter BindingList
transitionStart
transitionEndExclusive
```

Every validated transition/effect also carries the active frame stack. `src/transitive-runtime-correspondence.js` resolves a beta.30 call witness against one concrete reconstructed frame by caller, callee and dynamic invocation identity, then selects the observed effects dominated by that frame.

The generated Beta.32 Lean certificate adds a checked equality between:

```text
runtimeFrameBindings
```

and:

```text
beta30ExactBindings
```

Only after that equality is established does Lean re-evaluate the frame-selected observed list:

```text
evalCallTreeStmtEqBool
  beta30ExactBindings
  exactCallTreeBody
  frameSelectedObservedEffects
  = true
```

and reuse:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

This makes repeated identical calls distinguishable by independently reconstructed dynamic invocation identity without widening the beta.30 formal call-tree language.

## Repeated-call evidence

`examples/formal-transitive-calls-repeated.patch` contains repeated identical root calls. Beta.32 reconstructs distinct invocation frames and generates:

```text
formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

`examples/formal-transitive-calls-mixed-guards.patch` exercises repeated caller identities with different concrete parameter values and guard-selected paths through a deeper finite call chain. Its generated certificate is:

```text
formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean
```

These regressions specifically test that dynamic frame identity, exact parameter binding and guard-selected observed effects stay separated across repeated invocations.

## Independent evidence validation

Patch does not treat the production AST or backend trace as self-authenticating evidence.

### Source and range

`src/source-validation.js` independently reconstructs the supported source shape from raw Patch text. Numeric range expressions use the separate `src/independent-range-expression.js` parser/evaluator rather than the production formal-range implementation.

### Guards

`src/guard-validation.js` independently reconstructs control structure from raw source, while `src/independent-guard-expression.js` independently parses the supported formal guard-expression fragment. The resulting declarative claims are compared with production extraction before protected certification proceeds.

### Static call sites

`src/call-site-validation.js` independently scans raw source for static `do recipe(args)` sites and compares caller, callee, source line, argument text, count and ordering with the production-AST view. Concrete-call witnesses inherit this source-binding precondition.

### Runtime transitions and invocation frames

The direct-effect validation path independently executes the supported Change IR model against the observed direct-Wasm transition sequence. It validates target/before/after transitions, reconstructs semantic operations and recipe scope, and constructs invocation frames without consuming trusted frame metadata from the Wasm backend.

These independent paths reduce shared-extraction trust, but they are JavaScript validators rather than mechanized proofs of their own correctness.

## Exact Beta.32 boundary

Mechanically checked in Lean after evidence generation:

- beta.30 exact nested argument evaluation and binding;
- strict finite call-rank decrease;
- exact guard/static-repeat/direct-effect call-tree semantics;
- nested semantic-signature coverage and edge-by-edge import;
- equality between each reconstructed runtime-frame `BindingList` and the corresponding beta.30 exact `BindingList`;
- equality between each frame-selected observed semantic-effect list and Lean's re-evaluated exact call-tree trace;
- refinement of accepted observed effects into the caller Change Signature.

Established by JavaScript/runtime evidence before Lean:

- actual execution of the direct-Wasm module;
- complete observed transition validation against the independent Change-IR execution model;
- semantic operation and recipe-scope reconstruction;
- concrete invocation-frame reconstruction and active frame stacks;
- frame-based observed-effect selection;
- independent supported-fragment source/range, guard and static-call-site validation.

Explicit proof-free/trust boundaries remain:

- **runtime capture**;
- correctness and completeness of the independent JavaScript validator and invocation-frame reconstruction;
- correctness of the independent source/range, guard and call-site validators;
- production parser/extractor correctness outside the independently cross-checked fragments;
- JavaScript-to-Wasm lowering correctness;
- WebAssembly engine correctness.

Beta.32 is therefore **not** a full forward/backward compiler simulation theorem and Patch is **not** a fully verified compiler.

Things, lists, text/boolean state and GUI execution remain outside the beta.32 Lean runtime-correspondence claim. Direct Wasm and portable C99 fail closed on those constructs instead of treating them as certified.

## Reproducing the current evidence

Generate the ordinary and repeated Beta.32 runtime certificates with:

```bash
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

The standard formal CI also regenerates and checks the wider certificate set, including the static source/range, guarded runtime, call-composition, exact binding/effect, structured callee and finite transitive call-tree layers.

## Research claim boundary

Invocation frames, call-tree semantics, runtime validation, effect refinement, translation validation and proof-carrying evidence all have extensive prior art. Beta.32 is supporting assurance for the Patch artifact, not the primary novelty claim.

The candidate core contribution remains mandatory semantic mutation factorization plus operation- and magnitude-aware semantic authority derived from that same mutation substrate.
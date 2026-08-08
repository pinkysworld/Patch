# Patch Core Formal Model

Status: **beta.21: mechanized change semantics, independently validated source extraction, and path-witnessed Lean-checked direct-runtime occurrence correspondence for branch/repeat executions and repeated protected invocations**.

The executable Patch language remains larger than the Lean model. The `formal/` directory defines compact semantics whose stated theorems are machine checked. JavaScript/Wasm implementation layers remain explicit validation/trust boundaries rather than being called a verified compiler.

## 1. State-Change Factorization

Patch models mutation of existing persistent state through a semantic delta rather than an ordinary write followed by optional logging.

> **State-Change Factorization.** Every modeled transition that mutates an existing persistent binding factors through a semantic change; no alternative persistent-write rule exists in the formal machine.

A change witness contains target, versions, before state, operations and after state. Well-formedness requires the semantic operations to map `before` to `after`; commit is the modeled persistent-write path.

## 2. Lean modules

- `PatchFormal.lean` — values, operations, well-formed changes, machine state, intervals, effects and policies.
- `PatchSignature.lean` — `skip/emit/seq/branch/repeat`, `inferSignature`, `Executes`, Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic-policy checker.
- `PatchEvidence.lean` — proof-free EvidenceStmt decoding and signature correspondence.
- `PatchSource.lean` — source-facing `add/remove/set/clear`, semantic normalization and `SourceExecutes`.
- `PatchRange.lean` — integer RangeExpr analysis and `rangeAnalysisSound`.
- `PatchRuntime.lean` — concrete effect refinement, `RuntimePath`, path decoding and `checkSourceRuntimeEvidence_sound`.

Formal CI builds these modules and then compiles generated static and runtime certificates produced from real Patch source/direct-Wasm execution.

## 3. Main machine-checked results

### State-Change Factorization and Mutation Transparency

Every formal mutation step has a well-formed semantic change witness, and the modeled history contains that witness.

### Change Signature Soundness

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

### Capability containment

For accepted formal executions:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

### Verified executable checker

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

### Integer range-analysis soundness

For the explicit integer RangeExpr fragment, a successful formal range analysis over a respected environment contains every successful concrete formal evaluation. It does not silently cover JavaScript/Wasm floating point, division or arbitrary multiplication.

## 4. Source semantics

```text
SourceChangeKind = add | remove | set | clear
SourceStmt = skip | change | seq | branch | repeat
```

Lean performs source-to-semantic classification, for example:

```text
source add [0,5]      -> increase [0,5]
source remove [0,5]   -> decrease [0,5]
source add [-5,-5]    -> decrease [5,5]
source remove [-5,-5] -> increase [5,5]
```

`SourceExecutes` is defined through successful source lowering, evidence decoding and the existing semantic `Executes` relation:

```text
SourceExecutes(source, runtime)
iff
exists evidence stmt,
  lowerSourceStmt source = some evidence
  and decodeEvidenceStmt evidence = some stmt
  and Executes stmt runtime
```

## 5. Independent raw-source extraction validation

Two implementation paths construct the supported source-level formal claim:

```text
exact source -> production parser/AST -> formalSource
exact source -> independent raw-source parser -> raw SourceStmt/ranges
```

For supported entries, structural source and range claims must agree before protected static certification. This is **translation validation**, not a machine-checked proof that either JavaScript parser is correct.

## 6. Effect refinement

A concrete direct execution may instantiate an abstract formal amount interval. `PatchRuntime.lean` defines:

```text
EffectRefines(actual, expected)
```

Target, optional field and semantic operation kind must agree. When both effects carry amounts, the concrete interval must be contained in the formal interval.

Thus:

```text
actual increase [4,4]
formal increase [0,5]
```

is a valid refinement. `effectRefinesBool_sound` connects the executable check to the relational judgment.

Patch defines its own pointwise relation:

```text
TraceRefines actualTrace formalTrace
```

and proves `traceRefinesBool_sound`.

## 7. Beta.21 RuntimePath

Beta.20 reconstructed only linear execution. Beta.21 replaces that restricted decoder with an explicit proof-free path vocabulary:

```text
RuntimePath.leaf
RuntimePath.seq
RuntimePath.branchThen
RuntimePath.branchElse
RuntimePath.repeatZero
RuntimePath.repeatSucc(body, rest)
```

A `RuntimePath` is **untrusted input**, not a proof. It merely proposes which constructor sequence an execution took.

Lean checks the proposal using:

```text
decodeCorePath : RuntimePath -> CoreStmt -> Option (List Effect)
```

Important checks are structural:

- `leaf` can match only `skip` or `emit`;
- `seq` must match formal sequence structure;
- `branchThen` can execute only the formal then-branch;
- `branchElse` can execute only the formal else-branch;
- `repeatZero` is accepted only for a formal repeat count of zero;
- `repeatSucc` consumes exactly one formal iteration and checks the remaining witness against the decremented repeat count.

This supports different branch witnesses inside different loop iterations because each `repeatSucc` carries its own body path.

### Path soundness

Lean proves:

```text
decodeCorePath path stmt = some trace
-------------------------------------
Executes stmt trace
```

as `decodeCorePath_sound`.

Therefore a malformed or producer-invented branch/repeat path cannot establish runtime correspondence merely because JavaScript emitted it.

## 8. Main runtime correspondence checker

The beta.21 checker is:

```text
checkSourceRuntimeEvidence source observed path
```

It performs, inside Lean:

```text
SourceStmt
  -> lowerSourceStmt
  -> EvidenceStmt
  -> decodeEvidenceStmt
  -> CoreStmt
  -> decodeCorePath(path)
  -> formalTrace

observed proof-free EvidenceEffect list
  -> decodeRuntimeTrace
  -> actualTrace

traceRefinesBool actualTrace formalTrace
```

The theorem `checkSourceRuntimeEvidence_sound` has the shape:

```text
checkSourceRuntimeEvidence source observed path = true
------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

This connects an ordered concrete occurrence stream to an actual formal execution, not merely to membership in a static signature.

## 9. Multiple protected recipe invocations

`src/runtime-certificate.js` now emits a separate checked block for each observed invocation, for example:

```text
reward#1
reward#2
```

The producer independently executes/validates the direct trace, proposes a `RuntimePath` per protected invocation, and segments concrete effect occurrences by that invocation's expected witnessed execution count.

For the repository CI example:

```patch
make reward(bonus number 0..5):
  if bonus > 0:
    repeat 2:
      change score:
        add bonus

do reward(4)
do reward(0)
```

one invocation proposes `branchThen` with two `repeatSucc` steps; the second proposes `branchElse`. Lean checks both separately. A zero-effect branch remains checkable because the formal path can yield an empty trace.

## 10. Runtime certificate production boundary

The implementation path is:

```text
exact source
   -> direct Wasm compilation
   -> actual Wasm execution
   -> observed target/before/after transitions
   -> independent semantic-effect reconstruction
   -> proof-free concrete EvidenceEffect occurrences

same execution context
   -> runtime-path-witness.js
   -> proof-free RuntimePath per protected invocation

occurrences + path
   -> GeneratedRuntimeCertificate.lean
   -> PatchRuntime checks
```

The generated certificate records SHA-256 hashes of exact source bytes and the observed direct transition trace. These hashes bind the artifact to the tested inputs/observations; they do not prove compiler correctness.

The JavaScript path witness producer is deliberately outside the trusted theorem base: its claim is useful only if Lean accepts it.

## 11. Supported beta.21 runtime-correspondence subset

Currently covered when the surrounding static/source requirements also pass:

- formal `add/remove/set/clear` changes;
- sequence;
- formal branch choices through explicit `branchThen`/`branchElse` witnesses;
- literal formal repeats through exact `repeatSucc`/`repeatZero` witnesses;
- multiple direct calls to the same protected recipe, certified separately;
- current integer-valued amount fragment.

Still outside this runtime theorem:

- recipe-call nodes **inside** the protected formal recipe body (formal call/substitution semantics are not yet modeled in `SourceStmt`);
- dynamic repeat counts outside the formal literal-repeat model;
- GUI/event execution correspondence;
- undo/redo/preview/returns outside the formal source subset;
- non-integer/floating-point concrete magnitude correspondence;
- the full Patch language.

Unsupported means not covered by this theorem, not necessarily unsafe or unsupported by the implementation.

## 12. What beta.21 does not prove

Do not state “Patch is formally verified end-to-end.” Remaining boundaries include:

- production parser correctness;
- independent raw-source parser correctness;
- JavaScript → Wasm compiler correctness;
- WebAssembly engine correctness;
- completeness/correctness of the direct transition observer outside its supported ABI contract;
- JavaScript before/after → semantic-effect reconstruction correctness;
- JavaScript `RuntimePath` producer correctness;
- floating-point correspondence;
- full recipe-call/substitution correspondence;
- full language semantics.

The meaningful improvement is that **producer correctness for the control-flow witness is not assumed by the theorem**: the witness must be validated against formal structure to yield `SourceExecutes`.

## 13. Next formal order

1. add formal recipe-call/substitution semantics for the non-recursive direct subset;
2. introduce a typed expression/core IR or another smaller independently checkable lowering input;
3. derive a concrete-runtime capability corollary from `EffectRefines` plus formal policy admission;
4. stabilize a machine-readable certificate container;
5. measure checker/certificate/validation overhead;
6. extend carefully to richer values and eventually UI/inverse/replay semantics.

## 14. Research boundary

Source calculi, refinement relations, translation validation, Proof-Carrying Code, certifying compilers, effect/capability systems, abstract interpretation and verified checkers all have substantial prior art. `RuntimePath` is an assurance device, not a firstness or novelty headline.

The candidate contribution remains Patch's combination of mandatory semantic mutation, operation/magnitude-aware semantic authority derived from that same representation, and progressively tighter formal/validation reuse of the semantic change model while keeping source syntax small.

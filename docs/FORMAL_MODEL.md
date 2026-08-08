# Patch Core Formal Model

Status: **beta.20: mechanized change semantics, independently validated source extraction, and Lean-checked direct-runtime occurrence correspondence for a linear certified subset**.

The executable Patch language remains larger than the Lean model. The `formal/` directory defines compact semantics whose stated theorems are machine checked. The JavaScript implementation surrounds that formal core with explicit translation/runtime-validation boundaries rather than claiming full compiler verification.

## 1. State-Change Factorization

Patch models existing persistent state as changing through a semantic delta rather than an ordinary write followed by optional logging.

> **State-Change Factorization.** Every modeled transition that mutates an existing persistent binding factors through a semantic change; no alternative persistent-write rule exists in the formal machine.

For a modeled change:

```text
delta = <target, baseVersion, newVersion, before, ops, after>
```

well-formedness requires the semantic operations to map `before` to `after`, and commit is the modeled persistent-write step.

## 2. Lean modules

- `PatchFormal.lean` — values, semantic operations, well-formed changes, machine state, intervals, effects and policies.
- `PatchSignature.lean` — structured `skip/emit/seq/branch/repeat` core, `inferSignature`, `Executes`, Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic-policy checker and `checkedExecutionCannotEscape`.
- `PatchEvidence.lean` — proof-free EvidenceStmt decoding and evidence/signature correspondence.
- `PatchSource.lean` — source-facing `add/remove/set/clear`, semantic normalization, `SourceExecutes` and source policy containment.
- `PatchRange.lean` — integer RangeExpr evaluation/analysis and machine-checked `rangeAnalysisSound`.
- `PatchRuntime.lean` — concrete runtime-effect refinement, proof-free occurrence decoding, linear execution-trace reconstruction and `checkSourceRuntimeEvidence_sound`.

Formal CI builds all seven modules and compiles both a static certificate generated from Patch source and a beta.20 runtime certificate generated after actual direct-Wasm execution.

## 3. Main machine-checked results

### State-Change Factorization and Mutation Transparency

Every formal mutation step has a well-formed semantic change witness, and the modeled history contains that witness.

### Change Signature Soundness

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

Static branch alternatives may be conservative, but a modeled runtime semantic effect cannot be omitted from the inferred signature.

### Capability containment

If the inferred signature is admitted by the policy, every modeled runtime semantic effect is admitted by the policy:

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

### Range-analysis soundness

For the explicitly modeled integer expression fragment, if the range environment is respected and `analyzeRange` returns interval `I`, every successful concrete formal evaluation lies in `I`.

This theorem does **not** cover floating-point execution, division or arbitrary multiplication.

## 4. Source → evidence → signature path

The formal source vocabulary preserves source mutation intent:

```text
SourceChangeKind = add | remove | set | clear
SourceStmt = skip | change | seq | branch | repeat
```

Lean performs semantic classification. Examples:

```text
source add [0,5]      -> semantic increase [0,5]
source remove [0,5]   -> semantic decrease [0,5]
source add [-5,-5]    -> semantic decrease [5,5]
source remove [-5,-5] -> semantic increase [5,5]
```

`checkSourceEvidence_sound` establishes successful SourceStmt → EvidenceStmt equality. `checkSourceSignature_sound` composes source normalization, evidence decoding and formal signature inference and proves equality with the supplied production signature claim. `checkedSourceExecutionCannotEscape` gives capability containment for the formal source execution relation.

`SourceExecutes` is defined through Lean-normalized source evidence and the existing `Executes` relation:

```text
SourceExecutes(source, runtime)
iff
exists evidence stmt,
  lowerSourceStmt source = some evidence
  and decodeEvidenceStmt evidence = some stmt
  and Executes stmt runtime
```

## 5. Independent raw-source extraction validation

The production frontend path is:

```text
Patch source bytes
   -> production parser / AST
   -> formalSource SourceStmt + range claims
```

A second implementation path deliberately does not import `parser.js` or consume that AST:

```text
exact Patch source bytes
   -> src/source-validation.js
   -> independent indentation-aware parser
   -> raw SourceStmt + raw formal range claims
```

For supported entries, the two SourceStmt views and range claims must agree exactly before protected static certification. Negative tests alter the production formal source or range claim and require disagreement to be detected.

This is **translation validation**, not a machine-checked theorem that either JavaScript frontend is correct.

## 6. Beta.20 direct runtime → formal execution correspondence

Before beta.20, concrete direct-Wasm execution and Lean execution semantics were checked separately. The direct runtime exposed:

```text
patch.change_number(targetId, before, after)
```

and an independent JavaScript validator reconstructed concrete semantic effects from the observed transitions. Beta.20 connects that occurrence stream to the formal source semantics for a deliberately linear certified subset.

### Concrete effects refine abstract formal effects

A formal ranged source change may normalize to `score increase [0,10]` while one concrete call produces `score increase [8,8]`.

`PatchRuntime.lean` defines `EffectRefines(actual, expected)`, requiring target, field and semantic operation equality and, where amounts exist, interval containment:

```text
actual.amount ⊆ expected.amount
```

`effectRefinesBool_sound` proves that a successful executable refinement check implies the relational refinement judgment.

### Runtime trace decoding

Concrete occurrences are supplied as proof-free `EvidenceEffect` values. `decodeRuntimeTrace` validates their intervals before admitting them as formal `Effect` values.

Patch defines its own inductive pointwise relation `TraceRefines`. `traceRefinesBool` checks complete traces pointwise, and `traceRefinesBool_sound` derives:

```text
TraceRefines actualTrace formalTrace
```

### Linear formal execution reconstruction

`decodeLinearEvidenceTrace` accepts only:

```text
skip
emit/change
sequence
```

It deliberately rejects `branch` and `repeat` in beta.20. `decodeLinearEvidenceTrace_sound` proves that successful decoding yields a `CoreStmt` which actually `Executes` the reconstructed formal trace.

### Main runtime correspondence theorem

The executable checker is:

```text
checkSourceRuntimeEvidence source observed
```

and Lean proves:

```text
checkSourceRuntimeEvidence source observed = true
-------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

The theorem is `checkSourceRuntimeEvidence_sound`.

This is stronger than merely checking that an observed effect appears somewhere in a static signature: a successful certificate supplies a concrete ordered occurrence list and ties it pointwise to an actual execution trace admitted by the formal source semantics for the linear subset.

## 7. Runtime certificate production boundary

`src/runtime-certificate.js` is not itself verified. It performs the implementation-side steps:

```text
exact source
   -> direct Wasm compilation
   -> actual Wasm execution
   -> observed target/before/after transitions
   -> independent semantic-effect reconstruction
   -> proof-free EvidenceEffect occurrences
   -> generated Lean runtime certificate
```

The generated artifact records SHA-256 hashes of the exact Patch source bytes and the observed direct transition trace. The hash binds the artifact to the tested execution; it is not a cryptographic proof of compiler correctness.

For each protected recipe currently certified at runtime, the producer additionally requires:

- formal SourceStmt support;
- beta.19 raw-source extraction validation;
- a linear formal SourceStmt (`skip`, `change`, `seq`);
- exactly one observed invocation of that protected linear recipe;
- concrete increase/decrease magnitudes representable as non-negative safe integers.

Unsupported cases are rejected instead of being silently mapped to a weaker theorem.

## 8. Static and runtime assurance chains

Static chain:

```text
exact source
   -> production formalSource --------+
   -> independent raw-source witness --+-> structural equality validation
                                        |
                                        v
formal RangeExpr -> Lean range soundness
SourceStmt -> Lean normalization -> EvidenceStmt -> CoreStmt
          -> formal Signature -> verified policy checker
```

Runtime chain:

```text
exact source
   -> direct Wasm
   -> actual execution
   -> observed transitions
   -> independent semantic reconstruction
   -> concrete proof-free runtime evidence
   -> Lean decoding/refinement
   -> TraceRefines
   -> formal SourceExecutes witness
```

These layers intentionally separate producer evidence from Lean-checked conclusions.

## 9. Supported beta.20 runtime subset

The direct-Wasm backend is broader than the runtime theorem. Runtime certification currently accepts protected recipes whose formal source consists of:

- direct `add`, `remove`, `set`, `clear` changes supported by the formal source model;
- sequential composition;
- integer-valued supported magnitudes;
- one observed invocation per protected recipe.

Currently rejected at the beta.20 runtime-correspondence boundary:

- formal branches;
- formal repeats;
- multiple invocations of the same protected recipe in one runtime certificate;
- recipe-call composition inside the formal recipe body;
- floating-point/non-integer concrete magnitudes;
- GUI/event execution;
- return-valued recipes and other constructs outside the formal source subset.

Unsupported means **not covered by this theorem**, not necessarily unsafe or unsupported by the Patch runtime.

## 10. What beta.20 establishes and does not establish

A successful beta.20 generated runtime certificate establishes inside Lean that the supplied proof-free concrete effect occurrences decode successfully and `TraceRefines` an actual formal `SourceExecutes` trace for the supplied formal source statement.

It still does **not** prove:

- production JavaScript parser correctness;
- independent raw-source parser correctness;
- direct-Wasm compiler correctness;
- WebAssembly engine correctness;
- that `patch.change_number` observes arbitrary mutations outside the supported direct backend contract;
- correctness of JavaScript semantic reconstruction from before/after observations;
- branch/repeat path selection correspondence;
- multiple invocation segmentation;
- full floating-point correspondence;
- end-to-end correctness for the full Patch language.

Therefore the correct description remains **Lean-checked runtime correspondence for a restricted observed execution**, not “Patch is a verified compiler.”

## 11. Next mechanization / validation order

1. add explicit `branchThen` / `branchElse` runtime path witnesses;
2. add repeat-iteration witnesses and invocation identifiers so multiple recipe calls can be segmented;
3. prove a useful downward-closure result connecting `EffectRefines actual formal` with formal capability admission, yielding a concrete-runtime capability corollary;
4. introduce a typed expression/core IR or another smaller independently checkable lowering input;
5. extend formal recipe-call/substitution semantics;
6. preserve runtime/static certificates across packaged backends;
7. then extend to richer values, UI events, inverse/replay and collaboration semantics.

## 12. Research boundary

Source calculi, refinement relations, translation validation, Proof-Carrying Code, certifying compilers, effect/capability systems, range analysis, patches, provenance and verified checkers all have substantial prior art. `PatchRuntime` is an **assurance mechanism**, not a new primary novelty headline.

The candidate contribution remains Patch's combination of mandatory semantic mutation, operation- and magnitude-aware contracts derived from that representation, and a formal/validation architecture that reuses the same semantic change model while keeping the beginner-facing language small.

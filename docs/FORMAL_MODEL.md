# Patch Core Formal Model

Status: **beta.19: mechanized change semantics plus independently validated source extraction for the supported formal subset**.

The executable Patch language remains larger than the Lean model. The `formal/` directory defines a compact semantics whose stated theorems are machine checked. The JavaScript implementation surrounds that formal core with explicit translation-validation boundaries rather than claiming full compiler verification.

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

Formal CI builds these modules explicitly and then compiles a certificate generated from real Patch source.

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

`SourceExecutes` is a formal relation. It is not automatically a theorem about the JavaScript interpreter or direct Wasm runtime.

## 5. Beta.19 independent raw-source extraction validation

Before beta.19, the main frontend trust path was:

```text
Patch source bytes
   -> production parser / AST
   -> formalSource SourceStmt + range claims
```

Beta.19 adds a second implementation path:

```text
exact Patch source bytes
   -> src/source-validation.js
   -> independent indentation-aware raw-source parser
   -> raw SourceStmt + raw formal range claims
```

Important separation properties:

- `source-validation.js` does **not** import `parser.js`;
- it does not consume the production AST;
- it reconstructs source mutation verbs and formal structure directly from source lines;
- range-expression source text is independently collected from the raw source path;
- the resulting SourceStmt and range claims are compared structurally with `formalSource`.

The resulting Change IR 0.8 `sourceValidation` artifact records per entry:

```text
validated
productionSupported
rawSourceSupported
sourceMatches
rangeClaimsMatch
reasons
```

A protected recipe is eligible for `patch certify` only when its source/range entry is supported **and** the independent raw-source comparison succeeds.

Negative tests modify the production SourceStmt or production range claim and require validation failure.

### What this establishes

For supported entries, the implementation now has two separate routes from the exact source text to the formal-source claim and requires exact agreement before certification.

### What this does not establish

This is **translation validation**, not a Lean proof that the JavaScript production parser is correct. Both extraction paths are still executable JavaScript. Agreement makes a single shared parser/AST extraction error substantially harder to hide, but it is not equivalent to a verified frontend.

## 6. Certificate boundary in beta.19

A generated protected certificate is bound to the exact source via SHA-256 and carries schema versions for source, source validation, evidence and range data.

Conceptually:

```text
exact Patch source
    |                       |
    v                       v
production AST path     raw-source validator
    |                       |
    +------ SourceStmt/range equality ------+
                            |
                            v
                      certificate emission
                            |
                            v
                        Lean checks
                            |
        +-------------------+------------------+
        |                   |                  |
   range soundness    source/evidence    policy containment
                      /signature checks
```

The generated Lean file records that raw-source translation validation passed, but does not pretend that this boolean fact was proved inside Lean.

## 7. Production views remain separate

The production implementation intentionally produces multiple artifacts:

```text
src/change-analysis.js   -> production Change Signature
src/formal-range.js      -> formal RangeExpr + range reconstruction
src/formal-source.js     -> AST-derived SourceStmt + range claims
src/formal-bridge.js     -> independent semantic evidence view
src/source-validation.js -> raw-source SourceStmt/range witness + comparison
```

This separation is important. A comparison is useful only if the two claims are not merely copies of the same intermediate object.

## 8. Supported formal/source-validation subset

Current coverage includes:

- direct `add`, `remove`, `set`, `clear`;
- proven integer amount ranges for `add/remove`;
- sequence;
- both `if` alternatives at the formal effect level;
- literal non-negative `repeat` counts;
- ranged recipe parameters for the supported integer expression fragment;
- preview as no committed effect in the formal abstraction.

Currently outside the certificate/source-validation subset include recipe-call substitution, dynamic repeat counts, undo/redo, GUI event execution, returns, mixed-sign amount ranges and full language value semantics.

Unsupported means **not formally covered**, not necessarily unsafe.

## 9. Direct runtime validation is a separate layer

The direct Wasm runtime exposes:

```text
patch.change_number(targetId, before, after)
```

Independent JavaScript validators reconstruct expected Change-IR transitions and concrete semantic effects, then compare the observed execution with Change Signatures and protected Change Capabilities.

This strengthens implementation evidence at the backend boundary. It is still distinct from the Lean `SourceExecutes` / `Executes` relation.

## 10. Current trust boundary

Beta.19 has narrowed the old frontend gap from a single extraction path to a checked dual path. The largest remaining formal correspondence gap is now:

```text
production / direct runtime effect occurrence
          -> Lean SourceExecutes / Executes
```

Other remaining obligations include:

- JavaScript parser correctness is not machine proved;
- raw-source validator correctness is not machine proved;
- recipe-call/substitution correspondence is not yet formalized for the production direct subset;
- direct Wasm and C99 lowering are validated/tested, not machine proved;
- full Patch language coverage is not claimed.

## 11. Next mechanization / validation order

1. connect independently reconstructed runtime effect occurrences to `SourceExecutes` / `Executes` for a useful restricted core;
2. introduce a typed expression/core IR or another smaller independently checkable lowering input;
3. extend formal call/substitution semantics for non-recursive recipes;
4. evaluate whether the independent raw-source frontend should itself be moved into a smaller verified/checkable implementation;
5. preserve certificates/policies through all packaged backends;
6. then extend to richer values, UI events, inverse/replay and collaboration semantics.

## 12. Research boundary

Source calculi, translation validation, Proof-Carrying Code, certifying compilers, effect/capability systems, range analysis, patches, provenance and verified checkers all have substantial prior art. The raw-source dual-path validator is an **assurance mechanism**, not the primary novelty claim.

The candidate contribution remains Patch's combination of mandatory semantic mutation, operation- and magnitude-aware contracts derived from that representation, and a formal/validation architecture that reuses the same semantic change model while keeping the beginner-facing language small.

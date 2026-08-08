# Patch Core Formal Model

Status: **beta 8: mechanized mutation semantics, verified policy checking, proof-free semantic evidence, and a formal source-core normalization layer**.

The executable Patch language is larger than the Lean model. The `formal/` directory defines a compact semantics whose theorems are machine checked. Beta 5 introduced production/formal translation validation, beta 6 added the executable verified policy checker, beta 7 added proof-free evidence decoded by Lean, and beta 8 adds a formal `SourceStmt` layer that preserves source mutation verbs before Lean performs semantic normalization.

## 1. State-Change Factorization

Patch does not merely record that persistent state changed. Existing persistent state is changed by constructing and applying a semantic delta.

> **State-Change Factorization.** Every modeled transition that mutates an existing persistent binding factors through a semantic change `delta`; there is no alternative persistent-write rule in the formal machine.

For a change

```text
delta = <target, baseVersion, newVersion, before, ops, after>
```

well-formedness requires:

```text
applyOps(ops, before) = after
newVersion = baseVersion + 1
```

and commit is the sole modeled persistent-write operation.

## 2. Lean 4 modules

The formal project is pinned to Lean 4.30.0.

`formal/PatchFormal.lean` defines scalar values, semantic operations, well-formed changes, persistent machine state, intervals, semantic effects, capability rules, and signature/policy relations.

`formal/PatchSignature.lean` defines the structured semantic control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

plus static `inferSignature` and runtime `Executes stmt trace` definitions.

`formal/PatchChecker.lean` defines the executable semantic policy checker. Lean proves its interval, rule, rule-search and whole-signature boolean procedures sound with respect to the relational policy semantics.

`formal/PatchEvidence.lean` defines proof-free semantic evidence:

```text
EvidenceAmount { lo, hi }
EvidenceEffect { target, field, kind, amount? }
EvidenceStmt = skip | emit | seq | branch | repeat
```

Unlike semantic `Interval`, `EvidenceAmount` carries no proof that `lo <= hi`. Lean validates that condition before admitting an amount into a semantic `Effect` or `CoreStmt`.

`formal/PatchSource.lean` adds the beta-8 source-core vocabulary:

```text
SourceChangeKind = add | remove | set | clear
SourceChange { target, field, source kind, raw amount? }
SourceStmt = skip | change | seq | branch | repeat
```

This layer deliberately preserves the source mutation verb instead of requiring the producer to pre-classify every source `add`/`remove` as semantic increase/decrease.

Formal CI explicitly builds all five modules:

```bash
lake build PatchFormal PatchSignature PatchChecker PatchEvidence PatchSource
```

and then compiles a certificate generated from real Patch source.

## 3. Mechanized semantic theorems

### State-Change Factorization

For every formal machine step `m -> m'`, Lean proves there exists a well-formed semantic change `delta` such that the resulting machine is the defined commit of that delta and history appends the same witness.

### Mutation Transparency

Every formal machine step has a well-formed semantic change witness in resulting history.

### Change Signature Soundness

For the structured formal core, Lean proves:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

The inferred signature may over-approximate untaken branch alternatives, but it cannot omit a runtime semantic effect.

### End-to-end Change Capability Soundness

If a formal statement's inferred signature is admitted by its policy, Lean proves every runtime semantic effect is admitted by that policy:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

### Verified checker soundness

`PatchChecker.lean` proves:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

The main executable theorem is `checkedExecutionCannotEscape`.

## 4. Beta 7 evidence correspondence

`PatchEvidence.lean` checks proof-free semantic evidence before policy checking.

For a successful evidence/signature check:

```text
checkEvidenceSignature(evidence, claim) = true
```

Lean proves there exists a decoded `CoreStmt` whose canonical inferred semantic signature exactly equals the supplied production signature claim.

For a known decoded statement:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceSignature(evidence, claim) = true
------------------------------------------------
encodeSignature(inferSignature(stmt)) = claim
```

The theorem is `checkedEvidenceSignatureCorresponds`.

`checkedEvidenceExecutionCannotEscape` then proves runtime policy containment for modeled executions of accepted decoded evidence.

## 5. Beta 8 formal source-core normalization

Beta 8 places another checked layer before `EvidenceStmt`.

A generated certificate now contains a formal `SourceStmt` whose mutation verbs are still source-facing:

```text
add
remove
set
clear
```

Lean's `normalizeSourceChange` performs semantic classification.

Examples:

```text
source add [0,5]     -> semantic increase [0,5]
source remove [0,5]  -> semantic decrease [0,5]
source add [-5,-5]   -> semantic decrease [5,5]
source remove [-5,-5]-> semantic increase [5,5]
```

Raw intervals are first decoded through `decodeEvidenceAmount`. In a non-positive source range, the mirrored magnitude bounds are sent through the same decoder again rather than carrying a producer-created proof. Mixed-sign ranges are outside the certifiable source core because they do not have one static semantic direction.

### Source → evidence equality

The executable check:

```text
checkSourceEvidence(source, evidence) = true
```

means exactly:

```text
lowerSourceStmt(source) = some evidence
```

`checkSourceEvidence_sound` turns the boolean result into the equality witness.

This matters because source and semantic evidence are emitted separately by the production toolchain. Lean, rather than JavaScript, decides whether the source mutation vocabulary lowers to the claimed semantic evidence.

### Source → formal signature correspondence

`checkSourceSignature source claim` composes:

```text
SourceStmt
  -> Lean source normalization
  -> EvidenceStmt
  -> evidence decoding
  -> CoreStmt
  -> inferSignature
  -> canonical signature
  -> compare with separate production claim
```

`checkSourceSignature_sound` proves that a successful check yields an evidence artifact and decoded formal statement whose Lean-inferred signature exactly equals the supplied claim.

### Source-level formal execution and policy containment

The beta-8 `SourceExecutes source runtime` relation is intentionally defined through successful Lean lowering and evidence decoding into the existing `CoreStmt` execution relation:

```text
SourceExecutes(source, runtime)
iff
exists evidence, stmt:
  lowerSourceStmt(source) = some evidence
  decodeEvidenceStmt(evidence) = some stmt
  Executes(stmt, runtime)
```

This is a **formal source-core execution relation**, not yet a theorem about the JavaScript production runtime.

Lean proves:

```text
SourceExecutes(source, runtime)
checkSourceProtected(source, policy) = true
------------------------------------------------
every runtime semantic effect is allowed by policy
```

The theorem is `checkedSourceExecutionCannotEscape`.

`checkedSourceSignatureAndPolicy` additionally packages successful source/signature and source/policy checks into one existence result over the decoded formal core.

## 6. Production extraction paths

The production implementation deliberately emits separate views.

`src/formal-source.js` traverses the production AST and emits a proof-free source core preserving `add`, `remove`, `set`, and `clear` plus amount ranges.

`src/formal-bridge.js` independently reconstructs the semantic bridge representation used by beta 7.

`src/change-analysis.js` independently emits the production Change Signature claim.

Conceptually:

```text
                         -> production Change Signature
Patch production AST ---+-> semantic bridge / Evidence-style structure
                         `-> formal SourceStmt preserving source verbs
```

A beta-8 certificate packages the latter two artifacts plus the separate production signature and policy. Lean checks that the Source core actually normalizes to the semantic evidence and that the decoded formal signature equals the separate production claim.

`patch formal program.patch` reports both formal-source and semantic-bridge coverage.

## 7. Supported source-core subset

The current source extractor/model covers:

- direct `add`, `remove`, `set`, and `clear` changes;
- non-mixed-sign proven numeric amount ranges for `add`/`remove`;
- sequential statements;
- both alternatives of `if`;
- literal non-negative `repeat` counts;
- preview as a no-committed-effect abstraction.

Currently outside the formal source-core certificate subset:

- recipe calls and parameter substitution across calls;
- dynamic repeat counts;
- `undo` / `redo`;
- GUI/window/event execution;
- `return` control flow;
- changes without a provable numeric amount range when one is required;
- mixed-sign amount ranges;
- full source expressions and value semantics beyond the current contract abstraction.

Unsupported means **not formally covered**, not necessarily unsafe.

## 8. What beta 8 establishes and does not establish

Beta 8 reduces the trusted semantic-classification boundary:

- source mutation verbs are represented explicitly in `SourceStmt`;
- raw amount interval ordering is validated by Lean;
- Lean normalizes source `add/remove` into semantic increase/decrease;
- Lean checks that this normalization equals separately emitted semantic evidence;
- evidence is decoded to the formal core;
- the formal Change Signature is reconstructed independently;
- the production signature claim is checked against it;
- the semantic policy is checked by the verified checker;
- formal Source-core executions cannot escape an accepted policy.

It still does **not** prove:

- that the JavaScript parser constructs the correct AST from Patch source bytes;
- that `src/formal-source.js` extracts the correct `SourceStmt` from that production AST;
- that production expression interval analysis always over-approximates concrete expression values;
- that the production runtime exactly implements `SourceExecutes` / `Executes`;
- recipe-call/substitution correspondence;
- coverage for the full Patch language;
- full compiler correctness.

The main remaining trusted frontend path is now:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> SourceStmt extraction
```

and the quantitative claim:

```text
production expression
   -> inferred amount interval
```

Everything after the formal `SourceStmt` plus its raw amount ranges is checked by Lean for the current subset.

## 9. Numeric range reasoning

Patch supports ranged recipe parameters such as:

```patch
make reward(player, bonus number 0..10):
```

The production compiler performs interval analysis over a small arithmetic fragment. Beta 8 validates and normalizes the resulting raw interval inside Lean, but still does not prove that the production expression analyzer always computed a sound interval.

The next major range theorem is:

> If the production range analyzer returns interval `I` for expression `e` under environment `Gamma`, every supported concrete evaluation of `e` satisfying `Gamma` lies inside `I`.

## 10. Causal provenance

The production runtime records source, recipe-call and GUI-event context with committed changes. The `why` command consumes this history. Provenance remains outside the Lean model for now.

## 11. Next mechanization / validation order

1. define a stable formal representation of the supported production AST fragment and verify/validate AST → `SourceStmt` extraction;
2. formalize the ranged expression fragment and prove production interval-analysis soundness;
3. connect production runtime traces to `SourceExecutes` / `Executes` for a restricted core;
4. extend source/evidence coverage to non-recursive recipe calls and parameter substitution;
5. derive a stronger source-bytes/production-runtime capability theorem for the restricted fragment;
6. preserve source/evidence certificates across future direct Wasm lowering;
7. then move to inverse, preview, replay and commutation proofs;
8. extend to records, nested paths, GUI events and external effects.

## 12. Research boundary

State transitions, effects, capabilities, range analysis, source calculi, translation validation, Proof-Carrying Code, certifying compilation, verified checkers, provenance, undo, edit algebras and patches all have substantial prior art. The source/evidence/certificate architecture is therefore **not itself a novelty claim**.

The candidate contribution remains the factorization discipline and reuse: ordinary persistent mutation executes through a structured semantic delta, operation- and magnitude-aware semantic contracts are derived from that same mandatory representation, and the formal assurance pipeline can start from a small source mutation vocabulary while keeping the beginner-facing Patch language deliberately simple.

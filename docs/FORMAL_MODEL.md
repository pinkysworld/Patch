# Patch Core Formal Model

Status: **beta 7: mechanized core, verified semantic policy checking, and Lean-validated proof-free production evidence with machine-checked signature correspondence**.

The executable Patch language is larger than the Lean model. The `formal/` directory defines a compact semantics whose theorems are machine checked. Beta 5 introduced `src/formal-bridge.js`; beta 6 added the executable verified policy checker; beta 7 adds `formal/PatchEvidence.lean`, which no longer trusts a production-generated `CoreStmt` directly.

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

`formal/PatchSignature.lean` defines the structured control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

plus static `inferSignature` and runtime `Executes stmt trace` definitions.

`formal/PatchChecker.lean` defines the executable semantic policy checker. Lean proves its interval, rule, rule-search and whole-signature boolean procedures sound with respect to the relational policy semantics.

`formal/PatchEvidence.lean` defines a **proof-free evidence schema** emitted by the production toolchain:

```text
EvidenceAmount { lo, hi }
EvidenceEffect { target, field, kind, amount? }
EvidenceStmt = skip | emit | seq | branch | repeat
```

Unlike the semantic `Interval`, `EvidenceAmount` carries no proof that `lo <= hi`. Lean validates that condition before decoding evidence to a semantic `Effect` and `CoreStmt`.

Formal CI explicitly builds all four modules:

```bash
lake build PatchFormal PatchSignature PatchChecker PatchEvidence
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

The relevant theorem is `endToEndCapabilitySoundness`.

### Verified checker soundness

`PatchChecker.lean` adds an executable decision path:

```text
checkProtected(stmt, policy) = true
```

and proves that a successful result implies the relational `Protected stmt policy` judgment. Combined with Change Signature Soundness, `checkedExecutionCannotEscape` proves:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

## 4. Production-to-formal bridge

`src/formal-bridge.js` remains a conservative translation-validation layer over the real production AST and production Change Signature analyzer.

For each top-level program entry or recipe, it computes two JavaScript paths:

```text
production AST ----------------------> production Change Signature
      |
      v
independent bridge lowering
      |
      v
CoreStmt-like evidence
      |
      v
independent formal-style signature
      |
      +------------------------------> compare
```

A supported mismatch fails compilation. The bridge is useful regression and coverage evidence, but beta 7 deliberately does not treat this JavaScript comparison as the final formal authority.

### Current supported bridge subset

The bridge currently handles:

- direct semantic changes that classify as `increase`, `decrease`, `set`, or `clear`;
- sequential statements;
- both alternatives of `if` control flow;
- literal non-negative `repeat` counts;
- numeric range-derived amounts inside the current formal effect vocabulary;
- preview as an explicit no-committed-effect abstraction.

### Explicitly unsupported today

The bridge marks these outside the correspondence subset rather than treating them as verified:

- recipe calls and parameter substitution across calls;
- dynamic repeat counts;
- `undo` / `redo` state transitions;
- GUI/window/event execution;
- `return` control flow;
- semantic operations outside the current Lean effect vocabulary;
- unproven or transitive production effects.

**Unsupported is not the same as unsafe.**

## 5. Beta 7 proof-free evidence boundary

For a protected bridge-supported recipe:

```bash
patch certify program.patch --out Program.patchcert.lean
```

now emits three separate semantic artifacts:

1. a proof-free `EvidenceStmt`;
2. a separately generated production Change Signature claim as `List EvidenceEffect`;
3. the semantic capability policy as Lean `Rule` values.

The certificate no longer asks Lean to trust a JavaScript-generated `CoreStmt` declaration. Instead Lean performs:

```text
proof-free EvidenceStmt
        |
        v
validate raw interval bounds
        |
        v
decodeEvidenceStmt
        |
        v
formal CoreStmt
        |
        v
inferSignature
        |
        v
canonical proof-free signature
        |
        +---- compare with separately emitted production signature claim
        |
        +---- check semantic capability policy
```

Invalid raw intervals fail decoding.

### Evidence/signature correspondence theorem

`checkEvidenceSignature evidence claim` is executable. Lean proves that if it returns `true`, there exists a decoded `CoreStmt` whose canonical formal Change Signature is exactly the supplied production claim.

For a known decoded statement:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceSignature(evidence, claim) = true
------------------------------------------------
encodeSignature(inferSignature(stmt)) = claim
```

The theorem is `checkedEvidenceSignatureCorresponds`.

This is a real machine-checked correspondence result between the **produced proof-free evidence**, the Lean-decoded formal core, and the separately supplied production Change Signature claim.

### Evidence-level runtime policy theorem

Lean also proves:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceProtected(evidence, policy) = true
Executes(stmt, runtime)
------------------------------------------------
every runtime semantic effect is allowed by policy
```

The theorem is `checkedEvidenceExecutionCannotEscape`.

## 6. What beta 7 establishes and does not establish

Beta 7 establishes a stronger verified boundary than beta 6:

- raw quantitative evidence is validated by Lean rather than carrying a production-created interval proof;
- the production artifact is decoded by Lean into `CoreStmt`;
- Lean independently reconstructs the formal Change Signature;
- a separately emitted production signature claim is machine-checked against that reconstructed signature;
- the semantic policy is checked by the verified checker;
- formal executions of the decoded core cannot escape that policy.

It still does **not** prove:

- that the JavaScript parser constructs the correct AST from Patch source;
- that the JavaScript AST/formal bridge emits the correct proof-free evidence for the source program;
- that the production runtime exactly implements Lean `Executes`;
- soundness of the production expression interval analyzer;
- recipe-call/substitution correspondence;
- coverage for the full Patch language;
- full compiler correctness.

The main remaining frontend trust boundary is now narrower:

```text
Patch source / production AST
        -> proof-free EvidenceStmt + production signature claim + policy
```

Everything from evidence validation and formal decoding onward is machine checked for the current subset.

## 7. Semantic Change Signatures and capabilities

Production signatures conceptually contain:

```text
<target, path, operation, amount-or-range?>
```

The production analyzer supports operation-sensitive effects such as `increase`, `decrease`, `set`, `clear`, and bounded amounts. Policies admit selected semantic transitions, for example:

```text
player.score may increase up to 10
```

The verified evidence checker compares operation kind and magnitude, not merely write location.

## 8. Numeric range reasoning

Patch supports ranged recipe parameters such as:

```patch
make reward(player, bonus number 0..10):
```

The production compiler performs interval analysis over a small arithmetic fragment. Lean currently validates the **resulting raw evidence interval** and proves executable interval containment sound, but does not yet prove that the JavaScript expression analyzer always computes a sound interval.

The next range theorem remains:

> If the production range analyzer returns interval `I` for expression `e` under environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies inside `I`.

## 9. Causal provenance

The production runtime records source, recipe-call and GUI-event context with committed changes. The `why` command consumes this history. Provenance remains outside the Lean model for now.

## 10. Next mechanization / validation order

1. define a formal supported-source/evidence extraction relation and prove the first source/AST-to-`EvidenceStmt` correspondence theorem;
2. formalize the ranged expression fragment and prove interval-analysis soundness;
3. extend bridge/evidence coverage to non-recursive recipe calls and parameter substitution;
4. connect production execution traces to formal `Executes` traces for a restricted core;
5. derive a stronger source-level end-to-end capability theorem;
6. preserve evidence across future direct Wasm lowering;
7. then move to inverse, preview, replay and commutation proofs;
8. extend to records, nested paths, GUI events and external effects.

## 11. Research boundary

State transitions, effects, capabilities, range analysis, translation validation, Proof-Carrying Code, certifying compilation, verified checkers, provenance, undo, edit algebras and patches all have substantial prior art. The evidence/certificate architecture is therefore **not itself a novelty claim**.

The candidate contribution remains the factorization discipline and reuse: ordinary persistent mutation executes through a structured semantic delta, operation- and magnitude-aware semantic contracts are derived from that same mandatory representation, and a small verified boundary can independently validate proof-free semantic evidence while the source language stays deliberately small.

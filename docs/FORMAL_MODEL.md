# Patch Core Formal Model

Status: **beta 6: mechanized core, production-to-formal translation validation, and a Lean-verified semantic policy checker with generated certificates**.

The executable Patch language is larger than the Lean model. The `formal/` directory defines a compact semantics whose theorems are machine checked. Beta 5 introduced `src/formal-bridge.js`; beta 6 adds a much smaller trusted policy-checking boundary in `formal/PatchChecker.lean` and production-generated Lean certificates.

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

`formal/PatchFormal.lean` defines scalar values, semantic operations, `applyOp`/`applyOps`, well-formed changes, persistent store/version/history state, one semantic `Step.change` rule, intervals, semantic effects, capability rules, and signature/policy relations.

`formal/PatchSignature.lean` defines a structured formal control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

plus static `inferSignature` and runtime `Executes stmt trace` definitions.

`formal/PatchChecker.lean` defines a small executable checker for semantic policies. Its boolean procedures check target, field, operation kind and optional interval containment. Lean proves that successful boolean checks imply the relational policy judgments used by the formal semantics.

Formal CI now explicitly builds **all three targets**:

```bash
lake build PatchFormal PatchSignature PatchChecker
```

and compiles a certificate generated from a real Patch source file. This explicit-target gate replaced the earlier weaker `lake build` invocation, which could complete without compiling the libraries. Beta 6 therefore also fixes latent Lean 4.30 compatibility issues that the previous CI did not expose.

## 3. Mechanized theorems

### State-Change Factorization

For every formal machine step `m -> m'`, Lean proves there exists a well-formed semantic change `delta` such that the resulting machine is the defined commit of that delta and history appends the same witness.

### Mutation Transparency

Every formal machine step has a well-formed semantic change witness in resulting history.

### Interval containment transitivity

```text
A within B
B within C
-------------
A within C
```

### Change Signature Soundness

For the structured formal core, Lean proves:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

The inferred signature intentionally over-approximates branch alternatives. Bounded repetition can emit an effect multiple times, but every emitted effect remains represented by the static body signature.

### End-to-end Change Capability Soundness

If the inferred signature of a formal statement is admitted by its policy, Lean proves that every runtime semantic effect of an execution is admitted by that policy:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

The relevant theorem is `endToEndCapabilitySoundness` with `protectedExecutionCannotEscape` as a direct corollary.

### Verified checker soundness

Beta 6 adds an executable decision path:

```text
checkProtected(stmt, policy) = true
```

Lean proves that a successful result implies the relational `Protected stmt policy` judgment. The proof proceeds through soundness lemmas for interval containment, one rule/effect pair, rule search, and full signature-policy checking.

Combining that executable checker result with Change Signature Soundness yields:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
-----------------------------------------
every runtime effect is allowed by policy
```

The main theorem is `checkedExecutionCannotEscape`, with `checkedProtectedExecutionCannotEscape` as a one-effect corollary.

## 4. Production-to-formal bridge

`src/formal-bridge.js` is a conservative translation-validation layer over the real production AST and production Change Signature analyzer.

For each top-level program entry or recipe, it performs two paths:

```text
production AST ----------------------> production Change Signature
      |
      v
independent bridge lowering
      |
      v
Lean-like CoreStmt representation
      |
      v
independent formal-style signature
      |
      +------------------------------> compare
```

If an entry is inside the currently supported bridge subset and the two signatures differ, compilation fails. Bridge evidence is embedded in Change IR and exposed with:

```bash
patch formal program.patch
```

### Current supported bridge subset

The bridge currently handles:

- direct semantic changes that classify as `increase`, `decrease`, `set`, or `clear`;
- sequential statements;
- both alternatives of `if` control flow;
- literal non-negative `repeat` counts;
- numeric range-derived amounts within the current formal effect representation;
- preview as an explicit no-committed-effect abstraction.

### Explicitly unsupported today

The bridge marks these as outside the correspondence subset rather than treating them as verified:

- recipe calls and parameter substitution across calls;
- dynamic repeat counts;
- `undo` / `redo` state transitions;
- GUI/window/event execution;
- `return` control flow;
- semantic operations outside the current Lean effect vocabulary;
- unproven or transitive production effects.

**Unsupported is not the same as unsafe, and bridge-supported is not the same as source-to-semantics verified.**

## 5. Beta 6 generated certificates

For protected recipes that are inside the bridge subset, the production toolchain can emit a Lean-checkable certificate:

```bash
patch certify program.patch --out Program.patchcert.lean
```

The generated file contains:

- a SHA-256 hash of the exact Patch source bytes;
- the Patch IR version;
- the bridge-produced formal `CoreStmt`;
- the semantic capability policy as Lean `Rule` values;
- a theorem that `checkProtected stmt policy = true`, discharged by Lean computation;
- a theorem that any formal execution of that checked statement cannot emit a semantic effect outside the policy.

The production compiler is therefore no longer trusted to merely say “policy safe.” It emits evidence, and the Lean checker independently validates the formal policy judgment.

The source hash binds the certificate file to source bytes for artifact integrity. It does **not** prove that the JavaScript translation from those source bytes to `CoreStmt` is correct.

## 6. What beta 6 establishes and does not establish

Beta 6 establishes a genuine **verified checker boundary over translated semantic evidence**. For the formal `CoreStmt` and policy contained in a generated certificate, Lean checks the policy and derives runtime policy containment from the mechanized execution theorem.

It still does **not** prove:

- that the JavaScript parser or `buildFormalBridge` translates Patch source to the correct formal `CoreStmt`;
- that production execution follows the Lean `Executes` relation;
- that all Patch language constructs are covered;
- soundness of production interval analysis against expression evaluation;
- recipe-call/substitution correspondence;
- full production compiler correctness.

Thus the trust boundary is smaller than beta 5, but not zero. The remaining high-value theorem is the source/IR-to-formal correspondence relation for the supported fragment.

## 7. Semantic Change Signatures and capabilities

Production signatures conceptually contain:

```text
<target, path, operation, amount-or-range?>
```

The production analyzer supports operation-sensitive effects such as `increase`, `decrease`, `set`, `clear`, and bounded amounts. Policies admit selected semantic transitions, for example:

```text
player.score may increase up to 10
```

which can permit a bounded increase while rejecting an arbitrary replacement to the same path.

The verified checker operates directly over the normalized formal effect and rule vocabulary rather than trusting the JavaScript policy checker result.

## 8. Numeric range reasoning

Patch supports ranged recipe parameters such as:

```patch
make reward(player, bonus number 0..10):
```

The production compiler performs interval analysis over a small arithmetic fragment. The formal model proves interval-containment composition and the beta-6 checker proves its executable interval-containment test is sound. It does not yet prove the **production expression range analyzer** itself.

The next range theorem should be:

> If the range analyzer returns interval `I` for expression `e` under environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies inside `I`.

## 9. Causal provenance

The production runtime records source, recipe-call, and GUI-event context with committed changes. The `why` command consumes this history. Provenance remains outside the Lean model for now.

## 10. Next mechanization / validation order

1. define and prove a stable correspondence relation from supported production Change IR / bridge structures to Lean `CoreStmt` and `Effect` values;
2. formalize the ranged expression language and prove production interval-analysis soundness for that fragment;
3. extend formal/bridge coverage to non-recursive recipe calls and parameter substitution;
4. connect actual production execution traces to formal `Executes` traces for a restricted core;
5. derive a stronger end-to-end source-level capability theorem for that restricted core;
6. package checker evidence with `.patchapp` / future direct Wasm artifacts;
7. then move to inverse, preview, replay and commutation proofs;
8. extend to records, nested paths, GUI events and external effects.

## 11. Research boundary

State transitions, effects, capabilities, range analysis, translation validation, proof-carrying code, certifying compilation, provenance, undo, edit algebras and patches all have substantial prior art. The verified checker/certificate architecture is therefore **not itself a novelty claim**. Its role is to make Patch's primary claim harder to dismiss by reducing trust in the production analyzer.

The candidate contribution remains the factorization discipline and reuse: ordinary persistent mutation executes through a structured semantic delta, operation- and magnitude-aware semantic contracts are derived from that same mandatory representation, and a small verified checker can validate the resulting semantic authority evidence while the source language stays deliberately small.

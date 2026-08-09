# Patch semantic-authority security case studies

Status: **mechanized case-study artifact for Patch 0.2.0-beta.32 / Change IR 0.10**.

These cases illustrate why Patch's Semantic Change Capabilities track **target, semantic operation and optional magnitude**, rather than only whether some code may write a state location.

They are not a security proof, not a sandbox claim, and not a claim that prior effect/capability systems are target-only. The comparison baseline in this artifact is deliberately narrow and is used only as an internal ablation.

## Baseline boundary

The **coarse target-write baseline** asks:

> For every recipe protected by an `allow` block, are all transitively reachable changed state paths among the paths named by that block?

It intentionally ignores:

- increase vs. decrease vs. set/clear;
- maximum amount;
- whether a dynamic amount can be proved bounded;
- any richer authority or refinement property.

This baseline is **not a model of any named external language, effect system or capability system**. Its purpose is to isolate what Patch gains from semantic operation/magnitude information over target-only write authority.

## Reproduction

```bash
npm run evaluate:security -- \
  --out evaluation/security/report.json \
  --csv evaluation/security/report.csv \
  --markdown evaluation/security/table.md
```

The evaluator loads `case-studies/security/cases.json`, evaluates each source file through the real Patch compiler/Change Capability analysis, independently computes the coarse target-write decision, and fails if either result differs from the manifest expectation.

`npm test` also checks the entire case matrix and the JSON/CSV/Markdown CLI output.

## Case matrix

| Case | Property isolated | Patch | Coarse target-write | Interpretation |
|---|---|---:|---:|---|
| `loyalty-safe` | bounded increase | accept | accept | increase within 10 is permitted |
| `loyalty-over-limit` | magnitude | reject | accept | same target/direction, but proven range reaches 50 |
| `wallet-safe-debit` | bounded decrease | accept | accept | decrease within 25 is permitted |
| `wallet-direction-escalation` | semantic operation | reject | accept | same target, but increase is not authorized by a decrease capability |
| `campaign-transitive-safe` | transitive helper | accept | accept | helper contributes an increase of 8 within outer capability |
| `campaign-transitive-escalation` | transitive magnitude | reject | accept | helper contributes an increase of 50 beyond outer capability |
| `dynamic-unbounded` | fail-closed proof obligation | reject | accept | target is permitted but Patch cannot prove the dynamic amount stays within 10 |
| `target-escape` | target authority control | reject | reject | both models reject a write to an undeclared state path |

The expected differential is therefore:

```text
3 cases: Patch accept / coarse accept
4 cases: Patch reject / coarse accept
1 case : Patch reject / coarse reject
```

The four differential rejections isolate operation-/magnitude-/proof-aware semantic authority. The final `target-escape` case is a control showing that the coarse baseline is not constructed to accept every unsafe program.

## Case 1: bounded loyalty reward

```patch
allow loyalty_reward:
  points may increase up to 10
```

A recipe parameter proven in `0..10` is accepted. Widening the same parameter to `0..50` does not change the target path or semantic direction, so the coarse target-write baseline still accepts it. Patch rejects the widened program because the inferred maximum change can exceed 10.

This is the cleanest magnitude-aware ablation.

## Case 2: wallet direction

```patch
allow debit:
  balance may decrease up to 25
```

A bounded `remove amount` is accepted. Replacing it with `add amount` writes the same `balance` target, so target-only authority is unchanged, but the semantic operation changes from decrease to increase. Patch rejects the mutation because no capability rule permits that direction.

## Case 3: transitive campaign helper

The `campaign` entry recipe delegates to a helper. Patch's inferred semantic signature carries the helper effect back through the call edge.

A helper increase of 8 is accepted by an outer `points may increase up to 10` capability. Replacing the helper with an increase of 50 causes the outer capability check to fail.

This demonstrates that the evaluation is not limited to direct syntactic mutations inside the protected recipe.

## Case 4: fail closed on unknown magnitude

An unbounded recipe parameter still targets an allowed path and uses an allowed increase operation. A target-only baseline accepts it. Patch rejects it because a bounded capability of 10 requires proof that the concrete/inferred magnitude cannot escape 10.

This case is important for claim discipline: Patch does not silently reinterpret missing range evidence as authorization.

## What these cases support

The artifact supports a narrow engineering statement:

> For these controlled extension-style recipes, Patch's current compiler distinguishes semantic operation, magnitude, transitive helper effects and missing bound evidence that a target-only write-authority ablation intentionally ignores.

This is useful supporting evidence for the primary Patch research direction because the authority policy is derived from the same structured semantic mutation substrate used for Change Signatures and other assurance layers.

## What these cases do not support

Do **not** use this artifact to claim:

- that Patch invented quantitative effects or capabilities;
- that existing effect/capability systems cannot express equivalent restrictions;
- that Patch provides a complete security sandbox;
- that arbitrary malicious code is contained;
- that parser/compiler/runtime correctness is fully verified;
- that these eight cases constitute a broad empirical security evaluation.

A paper should describe this as a **semantic-authority ablation/case-study suite**, then separately compare Patch's design against relevant quantitative/refinement effect and capability literature.

## Next extensions

High-value follow-ups are:

1. richer multi-target authority cases;
2. nested guarded calls using the beta.29/30/32 assurance path;
3. a larger extension-style application where capabilities prevent a realistic accidental privilege escalation;
4. comparison dimensions extracted from systematic related work rather than invented baselines;
5. measurement of analysis/certificate overhead using `docs/EVALUATION.md`.

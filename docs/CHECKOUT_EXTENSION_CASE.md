# Checkout loyalty extension case study

Status: **application-level semantic-authority case for Patch 0.2.0-beta.35 / Change IR 0.10**, with formal milestone **beta.32**.

This case complements the eight micro-ablation programs in `docs/SECURITY_CASE_STUDIES.md` with one coherent extension-style application. It is still a controlled artifact, not a production security sandbox or a comparison against a named external system.

## Scenario

A checkout extension receives two bounded inputs:

- a discount to apply to `balance`;
- a loyalty reward to add to `points`.

The extension delegates both changes to helper recipes. A third persistent state, `cashback`, exists in the host application but is intentionally outside the extension's authority.

The declared authority is:

```patch
allow checkout_extension:
  balance may decrease up to 25
  points may increase up to 10
```

The safe entry recipe is:

```patch
make checkout_extension(discount number 0..25, reward number 0..10):
  do apply_discount(discount)
  do grant_loyalty(reward)
```

For the concrete invocation `checkout_extension(20, 8)`, the real direct-Wasm backend must reach:

```text
balance = 80
points = 8
cashback = 0
```

The protected semantic signature must carry both helper effects back into `checkout_extension`:

```text
balance decrease up to 25 via apply_discount
points increase up to 10 via grant_loyalty
```

## Manipulated variants

Three variants change helper behavior while keeping the overall application shape recognizable.

### Reward escalation

`grant_loyalty` changes from:

```patch
add amount
```

to:

```patch
add amount * 5
```

The target remains `points` and the semantic direction remains increase, so the internal coarse target-write ablation still accepts the extension. Patch rejects it because the inferred transitive reward can reach 50 while the entry authority permits only 10.

### Direction escalation

`apply_discount` changes from `remove amount` to `add amount`.

The helper still writes `balance`, so target-only authority is unchanged. Patch rejects the entry recipe because its declared authority permits a decrease, not an increase.

### Target escalation

A new helper `issue_cashback` writes the host's `cashback` state and is added to the extension call chain.

Neither Patch nor the coarse target-write baseline accepts this variant because the extension's declared target set contains only `balance` and `points`.

## Reproduction

```bash
npm run evaluate:checkout-extension -- \
  --out evaluation/security/checkout-extension.json \
  --markdown evaluation/security/checkout-extension.md
```

The evaluator does not merely print decisions. It fails unless:

1. the safe program is accepted by the real Patch compiler;
2. the coarse target-write baseline accepts the safe program;
3. the safe program executes through direct Wasm to the exact expected state;
4. the protected `checkout_extension` signature contains the expected transitive helper effects and magnitude bounds;
5. every manipulated variant has the decision and diagnostic recorded in `scenario.json`.

`tests/checkout-extension-case.test.js` independently checks the same application-level properties and report output.

## Result structure

The expected variant matrix is:

| Variant | Patch | Coarse target-write | Distinction |
|---|---:|---:|---|
| reward escalation | reject | accept | magnitude-aware semantic authority |
| direction escalation | reject | accept | operation-aware semantic authority |
| target escalation | reject | reject | target authority control |

This moves the security evaluation beyond isolated one-effect examples: one protected entry recipe composes multiple helpers, multiple persistent targets, exact parameter ranges and real direct-Wasm execution.

## Claim boundary

This case supports the engineering statement:

> In a controlled checkout-extension scenario, Patch carries helper effects into an entry recipe's semantic authority and rejects helper changes that exceed the declared operation/magnitude policy even when a target-only write-authority ablation would still permit the same target set.

It does not establish:

- complete malicious extension containment;
- process or memory isolation;
- full compiler correctness;
- superiority over named quantitative/refinement effect or capability systems;
- empirical evidence about real-world developer error frequency.

The coarse target-write comparison remains an **internal ablation, not a model of a named prior system**.

## Paper role

This case is suitable as the main motivating security/engineering example, with the eight micro cases serving as controlled ablations behind it. A venue submission should still add literature-grounded comparisons and, ideally, a larger externally motivated application or corpus before making broad security claims.

# Realistic extension corpus

Status: **two-domain application corpus for Patch 0.2.0-beta.35 / Change IR 0.10**.

The corpus broadens the semantic-authority evaluation beyond isolated micro cases. It currently contains two coherent application scenarios that share one evaluator and one deliberately coarse target-only write-authority ablation:

1. checkout / loyalty;
2. usage / quota management.

This is a broader artifact corpus, not an empirical study of an external plugin ecosystem. No claim is made that these two scenarios represent the prevalence of extension bugs or that they constitute complete malicious-extension containment.

## Shared evaluation contract

`src/realistic-extension-case.js` evaluates every scenario manifest with the same protocol:

1. read the safe Patch source;
2. run the real Patch semantic-authority analysis and the internal coarse target-only ablation;
3. require the expected accept/reject decisions;
4. compile the accepted safe program with the production direct-Wasm backend;
5. execute the compiled module and verify the expected final state;
6. require the protected entry recipe to include the expected transitive semantic effects and magnitude bounds;
7. evaluate each controlled escalation variant;
8. emit a reproducible JSON/Markdown application report.

The coarse baseline intentionally asks only whether transitively reachable changed targets are present in declared target authority. It does not model a named prior effect/capability system.

## Scenario 1: checkout / loyalty

Directory:

```text
case-studies/checkout-extension/
```

Protected authority:

```text
balance may decrease up to 25
points may increase up to 10
```

Safe execution:

```text
balance: 100 -> 80
points:   0   -> 8
cashback: 0   -> 0
```

Controlled variants:

- reward magnitude escalation, Patch rejects while target-only authority accepts;
- balance direction escalation, Patch rejects while target-only authority accepts;
- cashback target escalation, both reject.

## Scenario 2: usage / quota management

Directory:

```text
case-studies/quota-extension/
```

The application models a metering extension that records usage, consumes remaining quota, and grants a separately bounded bonus. Administrative credit is deliberately outside the extension authority.

Protected authority:

```text
used may increase up to 30
remaining may decrease up to 30
bonus may increase up to 10
```

Safe execution:

```text
used:         20  -> 35
remaining:   100  -> 85
bonus:         0  -> 5
admin_credit:  0  -> 0
```

The safe protected recipe composes two helpers. The resulting entry signature must carry three transitive effects:

- `used` increase up to 30 via `record_usage`;
- `remaining` decrease up to 30 via `record_usage`;
- `bonus` increase up to 10 via `grant_bonus`.

Controlled variants:

### Magnitude escalation

The metering helper doubles the requested consumption:

```text
used += amount * 2
remaining -= amount * 2
```

The target-only ablation still sees only authorized target paths, while Patch rejects the possible magnitude of 60 against the bound of 30.

### Direction escalation

The helper increases `remaining` instead of decreasing it. The target is authorized, but the semantic operation is not. Patch rejects while the target-only ablation accepts.

### Target escalation

The extension adds an administrative-credit helper outside declared authority. Both Patch and the target-only ablation reject this target escape.

## Reproduce

Checkout compatibility command:

```bash
npm run evaluate:checkout-extension -- \
  --out evaluation/checkout/report.json \
  --markdown evaluation/checkout/report.md
```

Quota case:

```bash
npm run evaluate:quota-extension -- \
  --out evaluation/quota/report.json \
  --markdown evaluation/quota/report.md
```

Generic evaluator:

```bash
node scripts/evaluate-extension-case.js \
  --case quota-extension \
  --out evaluation/quota/report.json \
  --markdown evaluation/quota/report.md
```

Set `SOURCE_DATE_EPOCH` to make the report timestamp deterministic for reproducibility packaging.

## What this adds over the micro cases

The eight security micro cases isolate individual semantic-authority distinctions. The realistic corpus tests composition in application-shaped sources:

- multiple persistent state paths;
- multiple helper recipes;
- transitive effect import into one protected entry recipe;
- real direct-Wasm execution of the accepted source;
- controlled variants that change magnitude, semantic direction, or target authority.

The quota case also shows one helper contributing multiple differently directed semantic effects (`used` increase and `remaining` decrease) to the same protected entry signature.

## Claim boundary

A defensible artifact statement is:

> Across two coherent application domains, accepted safe extensions execute through the production direct-Wasm path and their protected entry signatures contain the expected transitive operation/magnitude effects. Controlled magnitude and direction escalations can be rejected by Patch while remaining invisible to the deliberately coarse target-only ablation; target escapes are rejected by both.

This does not establish:

- complete extension sandboxing;
- absence of implementation bugs in the validator/compiler/runtime;
- representativeness of real third-party extension ecosystems;
- superiority over named prior effect/capability systems;
- a security theorem for arbitrary foreign or native plugin code.

A future external-validity step should adapt the corpus to real extension/plugin requirements or integrate Patch authority into an actual extensibility boundary rather than merely adding more synthetic scenarios.

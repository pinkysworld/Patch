# Raw-source call-site validation

Status: Patch **0.2.0-beta.35**, Change IR **0.10**, call-site validation evidence **0.1**.

The machine-readable evidence schema is `patch-call-site-validation` version **0.1**.

Patch's exact call certificates already re-evaluate supported call arguments in Lean and check positional binding, declared parameter ranges, and strict call-rank decrease. Before this hardening, however, the concrete call witness still accepted the production AST as the source of truth for which `do recipe(args)` call existed at a source location.

## Independent source binding

`src/call-site-validation.js` independently scans raw Patch source and reconstructs each static `do` call without importing `parser.js` or consuming lowered IR.

For each call site it records:

- containing caller recipe, or `$program` for a top-level call;
- callee recipe name;
- source line;
- exact trimmed argument texts in source order.

The argument splitter independently handles nested parentheses, list brackets, commas inside nested expressions, and quoted strings. The resulting ordered raw-source call-site list is compared with a separately collected list from the production AST.

A mismatch in caller, callee, line, argument text, call count, or order makes the call-site validation artifact fail closed.

## Certificate integration

`compile()` records the validation as `ir.callSiteValidation` and also places the same artifact beside `formalCalls`. Existing concrete-call witness consumers therefore inherit the validation before producing exact call-binding evidence.

`buildConcreteCallWitnesses()` refuses certification when the supplied or compiler-bound call-site validation is not successful. The witness artifact records:

```text
callSiteValidationVersion = 0.1
rawCallSitesValidated = true
```

The existing Concrete Call Witness format remains **0.1** because these provenance fields are additive and do not change the witness semantics.

Higher assurance layers that reuse concrete call witnesses, including structured callee traces, finite transitive call trees, and beta.32 runtime correspondence, inherit the same fail-closed source-binding precondition.

## What Lean checks after source binding

The independent source validation does not replace the existing mechanized checks. For supported calls Lean still re-evaluates the formal argument expressions under the exact caller environment and checks:

- exact argument values;
- positional parameter binding;
- declared parameter-range fit;
- lower-rank call structure;
- the later structured/transitive effect properties appropriate to the certificate layer.

This separates two questions that were previously partially conflated:

1. **Source identity:** did the production AST describe the same static call site that appears in raw source?
2. **Call semantics:** do the certified expressions, values, bindings, ranges, and effects satisfy the formal model?

The first now has an independent JavaScript comparison. The second remains re-checked in Lean for the supported formal fragment.

## Regression coverage

`tests/call-site-validation.test.js` checks:

- parser implementation independence from `parser.js`;
- caller/callee/line/argument-text agreement;
- nested argument delimiter handling;
- fail-closed detection of tampered production callee, argument, and line identity;
- fail-closed concrete witness generation when source binding is invalid;
- provenance inheritance by concrete witness artifacts;
- exact raw-source/AST call-site agreement across all shipped `.patch` examples.

## Claim boundary

This reduces one production-parser trust boundary. It does **not** prove the Patch parser correct and does not make `call-site-validation.js` a verified parser. Both the production parser and independent validator remain JavaScript implementations.

The validation is intentionally syntactic. It checks the identity of supported static call sites, not arbitrary expression semantics. Argument semantics and call refinement remain separate formal/certificate obligations.
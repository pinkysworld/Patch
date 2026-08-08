# Patch Core Formal Model

Status: **beta.25: mechanized semantic-change contracts, source/guard translation validation, guard-aware runtime correspondence, concrete runtime capability containment, and finite acyclic recipe-call signature composition**.

Patch is not a fully verified compiler. Lean covers explicit fragments; the JavaScript frontend, WebAssembly lowering/runtime and implementation-side evidence producers remain named trust/validation boundaries.

## Lean modules

- `PatchFormal.lean` — semantic operations, changes, state, intervals, effects and policies.
- `PatchSignature.lean` — effect-only `CoreStmt`, execution and Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic policy checker.
- `PatchEvidence.lean` — proof-free evidence decoding/correspondence.
- `PatchSource.lean` — source mutation verbs, normalization and `SourceExecutes`.
- `PatchRange.lean` — integer `RangeExpr` evaluation/analysis and `rangeAnalysisSound`.
- `PatchRuntime.lean` — `EffectRefines`, `TraceRefines`, proof-free `RuntimePath` and runtime correspondence.
- `PatchRuntimeCapability.lean` — concrete runtime capability containment.
- `PatchGuarded.lean` — guard evaluation, GuardTree shape and guard-aware RuntimePath validity.
- **`PatchCalls.lean`** — beta.25 finite recipe environments, argument-interval fit, rank-decreasing calls and call-aware signature soundness.

Formal CI builds every module, generates static/runtime/call certificates from production Patch source, compiles those certificates under pinned Lean, and rejects `sorry`/`admit`.

## Core containment

For the effect-only structured core:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) ⊆ inferSignature(stmt)
```

Combined with the verified semantic policy checker:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

The runtime/capability modules additionally transfer authority to decoded concrete runtime effects that refine a formal source execution.

## Source and guard validation

The implementation keeps production extraction and independent raw-source validation separate:

```text
Patch source -> production parser/AST -> formalSource / guardTree
Patch source bytes -> source-validation.js / guard-validation.js
```

Supported certification requires agreement of the relevant artifacts. This is translation validation, not parser verification.

`PatchGuarded.lean` then checks that proof-free branch witnesses agree with normalized safe-integer recipe-parameter guards. `checkedGuardedConcreteRuntimeCannotEscape` composes accepted guard-aware runtime evidence with the verified Change Capability checker.

## Beta.25: call-aware effect core

The older `formalSource`/`PatchGuarded` layers deliberately do not pretend recipe calls are direct SourceStmt nodes. Beta.25 adds a **separate** call-aware effect core:

```text
CallStmt.skip
CallStmt.emit Effect
CallStmt.seq first second
CallStmt.branch then else
CallStmt.repeat count body
CallStmt.call name argumentIntervals
```

A finite `RecipeEnv` maps names to:

```text
RecipeDef {
  params     : List Interval
  rank       : Nat
  signature  : List Effect
  body       : CallStmt
}
```

The production compiler emits a proof-free `formalCalls` artifact. Unsupported recipes are excluded from certification rather than approximated as verified.

## Argument interval fit

`ArgsFit actual expected` is a positional relation requiring every actual interval to be contained in the corresponding declared parameter interval. The executable checker is:

```text
argsFitBool actual expected
```

and Lean proves:

```text
argsFitBool actual expected = true
=> ArgsFit actual expected
```

The producer obtains actual call-argument intervals from the existing formal integer range fragment. This is an **abstract interval argument model**, not concrete value substitution.

## Semantic signature containment

`PatchCalls` defines executable equality/membership for formal `Effect` values and:

```text
signatureCoversBool inner outer
```

with soundness:

```text
signatureCoversBool inner outer = true
=> SignatureCovers inner outer
```

This lets the checker validate two kinds of obligations:

1. direct emitted semantic effects occur in the caller signature;
2. every imported callee signature is contained in the caller signature.

## Ranked call graph

A certified call must resolve to a recipe with strictly lower rank:

```text
callee.rank < caller.rank
```

The production artifact assigns ranks to the finite acyclic recipe graph. Recursive and mutually recursive graphs are rejected before certification, and the Lean checker independently checks the rank inequality encoded in the proof-free environment.

The rank is an assurance device for this conservative fragment; Patch does not claim ranked/well-founded call graphs as a novel technique.

## `BodyComposes` and executable checker

`BodyComposes env rank signature stmt` expresses the local semantic obligations for one body. For a call it requires a looked-up callee satisfying:

```text
lookupRecipe env name = some callee
callee.rank < rank
ArgsFit args callee.params
SignatureCovers callee.signature signature
```

`checkCallStmt` is executable and Lean proves `checkCallStmt_sound`.

The environment-wide executable checker is:

```text
checkRecipeEnv : RecipeEnv -> Bool
```

and:

```text
checkRecipeEnv env = true
=> EnvironmentChecked env
```

is theorem `checkRecipeEnv_sound`.

## Call execution and soundness

`CallExec env rank stmt trace` is a big-step effect execution relation. Its call constructor requires lookup, rank decrease, argument fit and execution of the callee body at the callee rank.

The main beta.25 theorem is:

```text
callSignatureSoundness
```

Schematically:

```text
EnvironmentChecked env
CallExec env rank stmt trace
BodyComposes env rank signature stmt
------------------------------------------------
SignatureCovers trace signature
```

Thus all effects produced by a modeled finite rank-decreasing call execution remain in the caller semantic signature.

The certificate-facing corollary is:

```text
checkedRecipeExecutionCannotEscape
```

Given an environment accepted by `checkRecipeEnv`, a looked-up root recipe and a modeled call execution of its body, the produced effect trace is contained by the root recipe signature.

## Production-generated call certificate

`src/formal-calls.js` builds the conservative production artifact. `src/call-certificate.js` encodes it as proof-free Lean definitions. A generated certificate contains a finite `RecipeEnv` and requires:

```text
checkRecipeEnv callEnv = true
```

proved with `native_decide`.

Formal CI generates `GeneratedCallCertificate.lean` from `examples/formal-calls.patch` and compiles it after building `PatchCalls`. The JavaScript producer is therefore not trusted to assert that the environment is valid; it only supplies data that the Lean checker accepts or rejects.

## Example

```patch
create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)
```

A valid artifact may assign:

```text
add_points     rank 0
reward         rank 1
double_reward  rank 2
```

For `reward -> add_points`, the actual interval `[0,5]` must fit the declared `add_points.amount` interval `[0,5]`, and `add_points`' semantic signature must be contained by `reward`'s semantic signature.

Calling `reward` twice does not add a frequency claim to the signature. The beta.25 signature remains a set-like may-effect summary. Temporal/frequency authority is deliberately outside the current research scope.

## Exact beta.25 boundary

Covered by the call-composition layer:

- finite named recipe environments;
- safe-integer bounded formal parameters;
- arguments analyzable by the existing formal integer range fragment;
- direct semantic `increase/decrease/set/clear` effects represented in semantic signatures;
- sequence, nondeterministic branch structure and literal repeats;
- acyclic/rank-decreasing calls;
- transitive semantic-signature containment.

Not proved by beta.25:

- concrete caller-expression evaluation to a particular value;
- binding that exact value to a callee parameter;
- substitution of concrete values into a callee body;
- equivalence of the call-aware Lean execution to production JavaScript/Wasm call execution;
- recursive recipe semantics;
- dynamic repeat counts, returns, GUI/events or the full Patch language;
- full compiler correctness.

The next formal refinement is a small concrete integer call semantics with argument evaluation and parameter binding, composed with this abstract signature theorem.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- JavaScript -> Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- JavaScript semantic-effect/path reconstruction correctness;
- correctness of the production `formalCalls` extractor itself.

The last item is why the generated call environment is proof-free data checked by Lean.

## Research boundary

Call graphs, ranked/well-founded recursion restrictions, interprocedural effect summaries, interval argument analysis, refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. `PatchCalls` is supporting assurance for Patch's primary design hypothesis, not a standalone firstness claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.

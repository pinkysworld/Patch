# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.25 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The current assurance story has six distinct layers around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean semantic core** — factorization, Mutation Transparency, Change Signature Soundness, verified semantic policy containment and integer range-analysis soundness for explicit fragments.
2. **Source translation validation** — an independent raw-source path reconstructs SourceStmt/range claims and compares them with production extraction.
3. **Guard translation validation** — an independent raw-source control-flow path reconstructs GuardTree/guard claims/parameter vocabulary and compares them with production extraction.
4. **Direct-runtime validation** — an independent Change-IR execution model reconstructs concrete semantic effects from observed direct-Wasm transitions.
5. **Guard-aware runtime → Lean composition** — proof-free concrete effects, RuntimePath and invocation parameter environments are checked against formal execution, source-guard truth and Change Capability containment.
6. **Call-aware semantic-signature composition** — a production-generated finite acyclic recipe environment is checked by `PatchCalls.lean` for rank decrease, argument-interval fit, direct-effect membership and callee-to-caller signature containment.

None of these is described as complete compiler verification.

## Beta.25 call-composition milestone

Consider:

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

The production compiler emits a separate proof-free `formalCalls` artifact. The finite recipe graph is assigned a rank such as:

```text
add_points     0
reward         1
double_reward  2
```

For each call, the artifact contains statically established safe-integer argument intervals. `PatchCalls.lean` defines `CallStmt`, `RecipeDef`, `RecipeEnv`, `ArgsFit`, executable semantic-signature membership/containment checks, `BodyComposes`, `checkRecipeEnv`, a rank-decreasing `CallExec`, and `callSignatureSoundness`.

The main result is schematically:

```text
EnvironmentChecked env
CallExec env rank stmt trace
BodyComposes env rank signature stmt
------------------------------------------------
SignatureCovers trace signature
```

A production-generated `GeneratedCallCertificate.lean` must prove:

```text
checkRecipeEnv callEnv = true
```

with `native_decide`. Formal CI generates that certificate from `examples/formal-calls.patch`, compiles it under pinned Lean, derives `EnvironmentChecked callEnv` via `checkRecipeEnv_sound`, and rejects unfinished `sorry`/`admit` proofs.

The certificate-facing theorem `checkedRecipeExecutionCannotEscape` states that for a checked environment, a looked-up root recipe and a modeled finite call execution, the resulting semantic effect trace remains within the root recipe signature.

### Exact beta.25 boundary

This result is **abstract interprocedural composition**. Arguments are represented by safe-integer intervals established by the existing formal range fragment. Beta.25 does not yet prove:

```text
caller expression -> exact concrete value
exact value -> callee parameter environment
callee body under that exact environment -> concrete formal trace
concrete formal call trace == production JavaScript/Wasm call execution
```

**Concrete argument evaluation**, exact parameter binding/substitution and runtime correspondence are therefore explicit next-step gaps, not silently included in the beta.25 claim.

## Beta.23 guard-aware runtime milestone

For supported protected direct-WebAssembly recipes, proof-free concrete semantic occurrences, path witnesses and concrete recipe-parameter environments are checked by `PatchGuarded.lean`. Branch witnesses must agree with normalized guard evaluation in a safe-integer parameter fragment, and accepted concrete effects are composed with the verified Change Capability checker via `checkedGuardedConcreteRuntimeCannotEscape`.

This layer remains separate from beta.25: the current runtime certificate does not claim full call-aware concrete execution correspondence.

## Beta.24 GUI mutation-path evidence

Editable Window input supplies transient event-local `value`; control editing itself does not assign persistent Patch state. Source must use an ordinary semantic `change` to commit it. Unit and generated-HTML fake-DOM tests distinguish observation-only input from explicit persistence.

This is implementation evidence that GUI input respects State-Change Factorization. It is not a new mechanized theorem or standalone novelty claim.

## Current formal modules

```text
PatchFormal.lean             factorization, state, intervals, effects, policies
PatchSignature.lean          effect-only CoreStmt execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer evaluator/range soundness
PatchRuntime.lean            EffectRefines + RuntimePath correspondence
PatchRuntimeCapability.lean  concrete runtime capability containment
PatchGuarded.lean            guard truth + guarded runtime/capability correspondence
PatchCalls.lean              finite ranked recipe calls + call-aware signature soundness
```

Formal CI generates and compiles static, guard-aware direct-runtime and recipe-call certificates under pinned Lean.

## Artifact engineering

The beta.25 artifact includes direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps, Patch Studio, and the CLI research command:

```bash
patch call-certify examples/formal-calls.patch --out Calls.patchcert.lean
```

These engineering features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.25 formal statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature and policy properties and checks conservative source/guard/runtime evidence. In addition, for a finite acyclic recipe fragment, a production-generated proof-free recipe environment records safe-integer argument intervals and semantic signatures; Lean independently checks call resolution, strict rank decrease, argument-interval fit, direct-effect membership and callee-to-caller signature containment. Under the resulting environment invariant, modeled transitive call effects remain within the caller semantic signature. This does not prove concrete parameter-substitution correctness or full compiler correctness.

Still unverified include JavaScript parser correctness, JavaScript→Wasm lowering, Wasm engine correctness, runtime observation/semantic reconstruction, production `formalCalls` extraction correctness, and concrete call argument binding/substitution correspondence.

## Remaining high-value gaps

- concrete recipe argument evaluation and parameter binding/substitution semantics;
- composition of that concrete call semantics with beta.25 abstract signature containment;
- semantic-security/plugin case studies;
- measured analysis/source/guard-validation/certificate/checker/backend overhead;
- systematic related-work review;
- reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for procedure-call operational semantics, call graphs, ranked/well-founded restrictions, interprocedural effect summaries, interval argument analysis, guard semantics, abstract interpretation, refinement, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, quantitative analysis, WebAssembly/C generation, provenance, undo, GUI event wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**.

## Manuscript source

`main.tex` is the working article source. No empirical performance or user-study results should be stated until actually collected.

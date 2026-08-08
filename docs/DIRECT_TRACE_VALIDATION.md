# Independent direct-trace validation

Patch 0.2.0-beta.14 adds a validator-side execution model for the supported direct WebAssembly subset. Its purpose is to check the direct backend at the semantic transition boundary without using either the production Patch interpreter or the Wasm lowerer as the execution oracle.

## Three execution/analysis paths

The current implementation now has three deliberately distinct paths for the supported numeric direct subset:

```text
                     Patch source
                         |
                         v
                    production IR
                    /            \
                   /              \
                  v                v
       production interpreter   direct Wasm lowerer
             |                      |
             v                      v
      interpreter history       Wasm transition trace

                    production IR
                         |
                         v
              independent trace validator
                         |
                         v
             expected transition trace
```

The new validator consumes Change IR rather than interpreter history or generated Wasm bytes. It independently evaluates the supported expression/control/call subset and derives the expected committed transition sequence.

## Deterministic Change-site contract

`buildDirectTraceContract(ir)` walks the structured Change IR and assigns deterministic lexical site identifiers:

```text
site 0
site 1
site 2
...
```

Each site records:

```text
siteId
scope ($program or recipe name)
source line when available
target
source operation descriptors
```

For example:

```patch
make add_points(amount):
  change score:
    add amount

if score == 0:
  change score:
    add 1
else:
  change score:
    remove 1
```

has three structural Change sites even though only some of them execute on a particular run.

Site IDs are assigned by the validator, not read from direct-backend metadata. This is intentional: beta.14 does not ask the lowerer to self-certify which source/IR site produced an event.

## Independent supported semantics

`deriveExpectedDirectTrace(ir)` implements a separate validator-side model for the current direct subset:

```text
top-level numeric CREATE
numeric CHANGE set/add/remove/clear
numeric SHOW validation
IF / ELSE
literal REPEAT + 1-based count
non-recursive numeric MAKE / DO
acyclic recipe calls
ranged numeric recipe parameters
```

The validator contains its own small numeric/boolean expression evaluator for:

```text
numbers
persistent numeric names
recipe parameters
count
+ - * /
true false
== != < > <= >=
not and or
parentheses
```

It does not call the direct backend expression compiler and does not call the Patch interpreter.

## Validation

`validateDirectTrace(ir, observedTrace)` derives the expected trace and checks the observed direct-Wasm events one by one.

For each transition it checks:

```text
trace length
ordered target identity
before value
after value
```

The successful validation result annotates every expected occurrence with its independently reconstructed `siteId`, scope and source line.

Thus the beta.14 relation is conceptually:

```text
Change IR
   |
   v
validator execution
   |
   v
expected [(site,target,before,after), ...]
   |
   | compare target/before/after
   v
observed direct-Wasm [(target,before,after), ...]
```

## Why this is stronger than interpreter differential testing

Beta.13 already compared direct-Wasm transition events with interpreter history. That is useful, but both implementations could theoretically share a mistaken assumption inherited from source-level behavior.

Beta.14 adds another implementation of the supported IR semantics. The validator is intentionally smaller than the full interpreter and focused only on the direct subset.

The backend therefore now has two dynamic comparison oracles:

```text
interpreter history
independent Change-IR validator
```

A mismatch in either gate fails CI.

## Tamper detection

Tests deliberately modify observed transition traces after direct execution. The validator rejects:

```text
missing transitions
extra transitions
reordered target transitions
incorrect before values
incorrect after values
```

This demonstrates that the gate is checking the observed transition sequence rather than merely confirming that a module was generated.

## Cross-platform quality gate

The repository includes:

```bash
npm run validate:wasm-direct
```

which:

1. compiles `examples/direct-wasm-recipes.patch` to direct Wasm;
2. validates the Wasm binary;
3. executes the direct module;
4. derives the expected trace independently from Change IR;
5. validates the observed Wasm transition trace;
6. prints the validated Change-site occurrences.

This step runs on Windows, macOS and Linux with Node 22 and 24 in addition to the normal test suite.

## Trust boundary

Beta.14 is **translation validation evidence**, not a proof of compiler correctness.

The validator still trusts the supplied Change IR as its semantic input. It therefore does not solve:

```text
Patch source bytes -> parser / AST -> Change IR correctness
```

Nor does it inspect the Wasm binary statically to prove every instruction sequence correct. It validates the execution trace observed from a particular run.

Current remaining boundaries include:

```text
source / AST -> Change IR
formal SourceStmt / RangeExpr extraction
untested input paths
host trace callback integrity
direct values outside the explicit numeric subset
```

## Relationship to Lean

The Lean formalization already proves State-Change Factorization, Mutation Transparency, Change Signature Soundness, capability containment, source/evidence correspondence, and range-analysis soundness for their modeled subsets.

The beta.14 validator is not yet machine-checked in Lean. Its role is to create an executable bridge that can later be related to those formal relations:

```text
formal semantics
      ^
      | future correspondence
      |
validator expected transition relation
      ^
      | dynamic translation validation
      |
direct Wasm transition trace
```

## Next step

The next useful strengthening is **effect-aware validation**. The current observed event reports only target, before and after. The validator contract already knows the Change site's operation descriptors.

A future trace contract can validate not only the resulting numeric transition but also the semantic operation/effect identity expected from the Change IR site, while keeping that identity independently reconstructed rather than blindly trusting a lowerer-emitted label.

After that, the project can connect the validator relation to the formal `SourceExecutes` / `Executes` models and evaluate whether a small machine-checked translation validator is preferable to full compiler verification for the research artifact.

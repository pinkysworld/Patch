# Patch Compiler Architecture

Status: **0.2.0-beta.19** · Change IR **0.8**

Patch has a working compiler front end, semantic Change analysis, an independently validated formal-source extraction path, Lean-checkable evidence, direct Wasm/C99 Console backends and cross-platform application packaging.

## Architecture

```text
exact Patch source bytes
   |
   +-----------------------------+
   |                             |
   v                             v
production parser / AST      raw-source validator
   |                             |
   +-> Change Signatures          +-> raw SourceStmt
   +-> Change Capabilities        +-> raw range claims
   +-> formal RangeExpr           |
   +-> formal SourceStmt          |
   +-> semantic Evidence view     |
   |                             |
   +----------- compare ----------+
               |
               v
         sourceValidation
               |
               v
          Change IR 0.8
               |
      +--------+-----------------------------+
      |        |        |        |           |
   .patchapp bootstrap direct   C99       certificate
              Wasm     Wasm               / Lean
                         |
                   Web/native apps
```

`sourceValidation` is beta.19's new implementation-assurance artifact. The raw-source path does **not** import `parser.js` or consume the production AST. For the supported formal subset it independently reconstructs source mutation structure and formal range claims and requires exact structural agreement with the AST-derived `formalSource` view.

This is translation validation, not a machine-checked parser-correctness theorem.

## Change IR 0.8

The IR keeps semantic and assurance artifacts together without pretending they have the same trust level:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
sourceValidation
```

The `CHANGE` operation remains explicit rather than becoming an ordinary write plus optional log record.

## Source extraction validation

Production path:

```text
source -> parser.js -> AST -> formal-source.js -> SourceStmt + range claims
```

Independent path:

```text
source bytes -> source-validation.js -> raw SourceStmt + raw range claims
```

The validator supports the formal source subset: direct `change` blocks with `add/remove/set/clear`, branch structure, literal repetition and ranged recipe parameters. Unsupported constructs are reported rather than silently normalized.

A protected recipe can be certified only if:

```text
production formalSource supported
AND raw-source witness supported
AND SourceStmt exactly matches
AND range claims exactly match
```

Negative tests mutate the production SourceStmt and range claim and require validation to fail.

## Formal certificate path

After implementation-side source validation, Lean checks the formal artifact chain:

```text
RangeExpr + environment
   -> analyzeRange
   -> rangeAnalysisSound

SourceStmt
   -> semantic normalization
   -> EvidenceStmt
   -> CoreStmt
   -> inferSignature
   -> compare production Change Signature
   -> verified semantic policy check
```

The certificate records source SHA-256, IR version, source/evidence/range schemas and the source-validation schema. It explicitly describes raw-source validation as translation validation.

## Executable Console backends

### Direct WebAssembly

```bash
patch build app.patch --target wasm-direct
```

Supported today: top-level numeric state, numeric `set/add/remove/clear`, numeric `show`, supported arithmetic/comparisons, `if/else`, literal `repeat` + Patch `count`, acyclic numeric recipes and ranged parameter guards.

The module imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

A raw direct module is executable Wasm but not yet a standalone WASI command.

### Portable C99

```bash
patch build app.patch --target c99 --out App.c
```

`src/c99.js` first applies the conservative compiled-Console support boundary, then independently lowers normalized Change IR to C99. The generated source is compile/run tested on Linux, macOS and FreeBSD 15.1.

The C99 path preserves ranged guards and a block-level `patch_change_number(target,before,after)` hook. OpenBSD/NetBSD are not claimed until equivalent gates exist.

## Independent direct-runtime validation

The direct validator separately executes the supported Change IR model and reconstructs ordered transitions and concrete semantic effects. Observed direct-Wasm transitions are compared for target/order/before/after, then concrete `increase/decrease/set/clear` effects and magnitudes are checked against static Change Signatures and protected Change Capabilities.

See [DIRECT_TRACE_VALIDATION.md](DIRECT_TRACE_VALIDATION.md) and [DIRECT_EFFECT_VALIDATION.md](DIRECT_EFFECT_VALIDATION.md).

This remains translation/runtime validation evidence rather than a complete compiler-correctness theorem.

## Application packaging

```text
Windows/macOS/Linux Console -> direct Wasm + native host
Windows/macOS/Linux Window  -> generated desktop Patch UI player
FreeBSD Console              -> portable C99 + FreeBSD cc
```

Window packages are standalone but not native AppKit/Win32/GTK widget lowering. FreeBSD GUI is not implemented.

## Numeric-model caveat

Production interpreter/direct Wasm/C99 use floating-point runtime behavior for the supported numeric execution subset. Lean `rangeAnalysisSound` covers an explicit **integer** formal fragment. Division, decimals and general floating-point semantics must not be described as covered by that theorem.

## Remaining trust boundaries

Beta.19 materially narrows:

```text
source bytes -> production AST -> formal SourceStmt/ranges
```

by checking it against the independent raw-source path.

Still not machine proved:

```text
JavaScript parser correctness itself

production/direct runtime effect occurrences
   -> Lean SourceExecutes / Executes
```

The highest-value next compiler/formal step is to connect independently reconstructed runtime effects to the Lean execution relation, followed by a typed expression/core IR or another smaller independently checkable lowering input.

## Quality gates

- JavaScript tests on Windows/macOS/Linux, Node 22/24;
- raw-source extraction/tamper tests;
- explicit Lean module + generated-certificate builds;
- direct-Wasm build/execution and independent effect validation;
- C99 generation plus Linux/macOS/FreeBSD compile/run;
- native Windows/macOS/Linux Console and Window smoke builds;
- deterministic Patch Studio site and project-surface consistency checks.

## Beginner-facing constraint

All of this remains optional machinery. Ordinary Patch still looks like:

```patch
change score:
  add 1
```

without requiring the programmer to understand Change IR, source-validation schemas, Wasm, C99 or Lean.

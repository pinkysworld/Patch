# Patch Compiler Architecture

Status: **0.2.0-beta.20** · Change IR **0.8**

Patch has a working compiler front end, semantic Change analysis, independently validated formal-source extraction, Lean-checkable static evidence, a new direct-runtime correspondence certificate path, direct Wasm/C99 Console backends and cross-platform application packaging.

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
      +--------+------------------------------+
      |        |        |        |            |
   .patchapp bootstrap direct   C99      static Lean
              Wasm     Wasm              certificate
                         |
                         +-> observed target/before/after
                         |          |
                         |          v
                         |   independent runtime validator
                         |          |
                         |          v
                         |   concrete EvidenceEffect list
                         |          |
                         |          v
                         +---- runtime Lean certificate
```

`sourceValidation` remains the implementation-assurance artifact introduced in beta.19. The raw-source path does **not** import `parser.js` or consume the production AST. For the supported formal subset it independently reconstructs source mutation structure and formal range claims and requires exact structural agreement with the AST-derived `formalSource` view.

Beta.20 adds a separate runtime-certificate path. It does not change Change IR, so the IR remains version 0.8.

## Change IR 0.8

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

A protected recipe can be statically certified only if the production formal source and raw-source witness agree exactly for the supported subset. This is translation validation, not a machine-checked parser-correctness theorem.

## Static formal certificate path

After implementation-side source validation, Lean checks:

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

`patch certify` emits this static certificate.

## Beta.20 direct-runtime certificate path

The new runtime path starts by executing the real direct-Wasm artifact:

```bash
patch runtime-certify examples/runtime-correspondence.patch \
  --out formal/GeneratedRuntimeCertificate.lean
```

The sequence is:

```text
Patch source
  -> direct Wasm compiler
  -> actual WebAssembly execution
  -> patch.change_number(target,before,after)
  -> independent Change-IR trace/effect reconstruction
  -> concrete proof-free runtime EvidenceEffect list
  -> PatchRuntime.checkSourceRuntimeEvidence
  -> formal SourceExecutes witness + pointwise EffectRefines
```

The runtime artifact records SHA-256 hashes of the exact source bytes and observed direct transition trace.

For a formal effect `increase [0,10]` and concrete execution `increase [8,8]`, Lean checks the semantic refinement rather than requiring interval equality.

`formal/PatchRuntime.lean` provides:

```text
EffectRefines
effectRefinesBool / effectRefinesBool_sound
decodeRuntimeTrace
traceRefinesBool / traceRefinesBool_sound
decodeLinearEvidenceTrace / decodeLinearEvidenceTrace_sound
checkSourceRuntimeEvidence / checkSourceRuntimeEvidence_sound
```

The principal beta.20 theorem establishes:

```text
checkSourceRuntimeEvidence source observed = true
-------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and actualTrace pointwise refines formalTrace
```

The first checker is deliberately linear: direct changes and sequences are accepted, while formal branch/repeat runtime paths are rejected until explicit path witnesses exist. The producer also currently requires one observed invocation per protected linear recipe and integer-representable concrete magnitudes.

See [RUNTIME_CORRESPONDENCE.md](RUNTIME_CORRESPONDENCE.md).

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

## Independent direct-runtime validation

The direct validator separately executes the supported Change IR model and reconstructs ordered transitions and concrete semantic effects. Observed direct-Wasm transitions are compared for target/order/before/after, then concrete `increase/decrease/set/clear` effects and magnitudes are checked against static Change Signatures and protected Change Capabilities.

Beta.20 reuses that independently reconstructed effect stream as the **producer input** to a separate Lean runtime certificate. Lean does not trust the producer's interval proof or SourceExecutes claim; it checks proof-free effect evidence against the formal source semantics.

This remains translation/runtime validation evidence rather than a complete compiler-correctness theorem.

## Application packaging

```text
Windows/macOS/Linux Console -> direct Wasm + native host
Windows/macOS/Linux Window  -> generated desktop Patch UI player
FreeBSD Console              -> portable C99 + FreeBSD cc
```

Window packages are standalone but not native AppKit/Win32/GTK widget lowering. FreeBSD GUI is not implemented.

## Numeric-model caveat

Production interpreter/direct Wasm/C99 use floating-point runtime behavior for the supported numeric execution subset. Lean `rangeAnalysisSound` and beta.20 runtime correspondence currently cover an explicit **integer** formal fragment. Concrete increase/decrease amounts that are not non-negative safe integers are rejected by runtime certification rather than described as formally covered.

## Remaining trust boundaries

Beta.19 narrowed source extraction through independent raw-source translation validation. Beta.20 now closes the first restricted runtime-occurrence bridge:

```text
concrete direct runtime occurrence
   -> proof-free EvidenceEffect
   -> Lean-checked refinement
   -> formal SourceExecutes
```

Still not machine proved:

```text
JavaScript parser correctness itself
JavaScript/Wasm compiler correctness
JavaScript semantic reconstruction from before/after observations
branch/repeat and multi-invocation runtime path correspondence
full floating-point correspondence
```

The highest-value next compiler/formal step is explicit control-flow/invocation witnesses, followed by a typed expression/core IR or another smaller independently checkable lowering input.

## Quality gates

- JavaScript tests on Windows/macOS/Linux, Node 22/24;
- raw-source extraction/tamper tests;
- runtime certificate generation and boundary tests;
- explicit Lean module builds including `PatchRuntime`;
- generated static and runtime certificate compilation under pinned Lean;
- direct-Wasm build/execution and independent effect validation;
- C99 generation plus Linux/macOS/FreeBSD compile/run;
- native Windows/macOS/Linux Console and Window smoke builds;
- deterministic Patch Studio site and project-surface consistency checks.

Core Patch CI and Lean run on pull requests and pushes to `main`, avoiding duplicate full matrices for feature-branch pushes.

## Beginner-facing constraint

All of this remains optional machinery. Ordinary Patch still looks like:

```patch
change score:
  add 1
```

without requiring the programmer to understand Change IR, source/runtime certificate schemas, Wasm, C99 or Lean.

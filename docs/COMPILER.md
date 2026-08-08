# Patch Compiler Architecture

Status: **0.2.0-beta.21** · Change IR **0.8**

Patch has a working compiler front end, semantic Change analysis, independently validated formal-source extraction, Lean-checkable static and runtime evidence, direct Wasm/C99 Console backends, a **Standalone Window Web App** backend and cross-platform application packaging.

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
   |                             |
   +----------- compare ----------+
               |
               v
         sourceValidation
               |
               v
          Change IR 0.8
               |
   +-----------+------------------------------+
   |           |          |        |          |
.patchapp   bootstrap   direct     C99     Window Web
             Wasm       Wasm              generated runtime
                         |
                         +-> observed transitions
                         +-> independent concrete effects
                         +-> untrusted RuntimePath witness
                         +-> runtime Lean certificate
```

`sourceValidation` remains a translation-validation artifact: its raw-source parser does not import `parser.js` and does not consume the production AST. Agreement between the two frontend views is required for supported protected static certification, but is not a machine-checked parser-correctness theorem.

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

Beta.21 does not change the IR schema. Window nodes are normalized as `code: "WINDOW"`; semantic state mutation remains represented by explicit `CHANGE` instructions.

## Window build routing

A shared helper in `src/window-build.js` validates Window projects using normalized IR. This fixes the old Studio preflight bug that inspected `instruction.op` instead of `instruction.code`.

```text
Window source
  -> parser / compiler
  -> Change IR instruction code == WINDOW
  -> validateWindowBuild
  -> dedicated Window target
```

Desktop Window targets use the existing generated desktop player on Windows/macOS/Linux. Web Window targets now use `src/window-webapp.js`.

### Standalone Window Web App

`src/webapp.js` routes by project kind:

```text
Console -> compileToDirectWasm -> one HTML file
Window  -> compile + validateWindowBuild
        -> buildStandaloneWindowWebApp
        -> one HTML file
```

The Window Web App embeds the parsed program and a generated browser runtime for the current Window/control/event subset. It is executable without external script files. This is a separate backend, **not direct Wasm lowering of Window instructions**.

Direct Wasm itself remains Console-only. Explicitly selecting it for Window source yields a compatibility error instead of silently changing the target.

## Static formal certificate path

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

`patch certify` emits this static certificate after supported source extraction has passed independent translation validation.

## Beta.21 runtime Lean certificate

```bash
patch runtime-certify examples/runtime-correspondence.patch \
  --out formal/GeneratedRuntimeCertificate.lean
```

The producer path is:

```text
Patch source
  -> direct Wasm compiler
  -> actual Wasm execution
  -> patch.change_number(target,before,after)
  -> independent Change-IR trace/effect reconstruction
  -> concrete proof-free EvidenceEffect occurrences

same program execution
  -> src/runtime-path-witness.js
  -> untrusted RuntimePath per protected recipe invocation

EvidenceEffect + RuntimePath
  -> generated Lean runtime certificate
  -> PatchRuntime.lean
```

`RuntimePath` mirrors executable control-flow constructors:

```text
leaf
seq
branchThen / branchElse
repeatZero / repeatSucc
```

The JavaScript witness producer is explicitly **not trusted**. `PatchRuntime.lean` validates the witness against the decoded `CoreStmt` with `decodeCorePath`. The theorem `decodeCorePath_sound` proves that a successfully decoded path yields a real `Executes` trace.

The principal checker/theorem are:

```text
checkSourceRuntimeEvidence
checkSourceRuntimeEvidence_sound
```

Successful checking yields:

```text
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

This now covers supported branch choices, literal repeats and **multiple protected recipe invocations**, each certified separately. It still does not formalize recipe-call/substitution nodes inside `SourceStmt` itself.

A concrete runtime effect can refine a larger static interval; for example `increase [4,4]` can refine `increase [0,5]` when target, field and semantic operation agree.

See [RUNTIME_CORRESPONDENCE.md](RUNTIME_CORRESPONDENCE.md).

## Executable Console backends

### Direct WebAssembly

Supported: top-level numeric state, numeric `set/add/remove/clear`, numeric output, supported arithmetic/comparisons, `if/else`, literal `repeat` + `count`, acyclic numeric recipes and ranged parameter guards.

Raw direct Wasm imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

It is executable Wasm but not yet a standalone WASI command.

### Portable C99

`src/c99.js` applies the conservative compiled-Console boundary and independently lowers normalized Change IR to C99. Generated source is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Independent direct-runtime validation

The validator separately executes the supported Change IR model, reconstructs expected ordered transitions and semantic effects, and compares target/order/before/after with observed Wasm execution. Concrete effects are then checked against production Change Signatures and optional Change Capabilities before runtime certificate production.

The runtime Lean certificate strengthens the correspondence story but does not turn the validator, Wasm lowerer or witness producer into verified code.

## Application packaging

```text
Console Web                 -> direct Wasm + browser host
Window Web                  -> generated Patch Window browser runtime
Windows/macOS/Linux Console -> direct Wasm + native host
Windows/macOS/Linux Window  -> generated desktop Patch UI player
FreeBSD Console             -> portable C99 + FreeBSD cc
```

Window desktop packages are standalone but **not yet native-widget lowering** to AppKit/Win32/GTK. The local CLI `--target app/native` remains Console-only; Window desktop packaging is currently exposed through Studio/GitHub Actions and the dedicated packager.

## Numeric-model caveat

Production interpreter/direct Wasm/C99 execute JavaScript/Wasm floating-point numbers. Lean range and runtime correspondence claims cover explicit integer formal fragments. Non-integer concrete magnitudes are rejected by runtime certification rather than silently labeled verified.

## Remaining trust boundaries

Still not machine proved:

```text
production JavaScript parser correctness
raw-source validator correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
before/after -> semantic effect reconstruction correctness
RuntimePath producer correctness
full floating-point correspondence
recipe-call/substitution correspondence inside the formal source model
full Patch language semantics
```

The path producer does not enter the trusted theorem base because an invalid path must fail Lean's `decodeCorePath` check.

## Quality gates

- JavaScript tests on Windows/macOS/Linux, Node 22/24;
- source/tamper and runtime-certificate tests;
- Window IR regression tests and a real single-file Window Web build;
- explicit Lean builds including `PatchRuntime.lean`;
- generated static and runtime certificates compiled under pinned Lean;
- direct-Wasm execution and independent transition/effect validation;
- C99 Linux/macOS/FreeBSD compile/run;
- Windows/macOS/Linux Console and Window smoke packages;
- deterministic Patch Studio site/project consistency checks.

## Beginner-facing constraint

All of this remains optional machinery. Ordinary Patch still looks like:

```patch
change score:
  add 1
```

without requiring the programmer to understand Change IR, RuntimePath, Wasm, C99 or Lean.

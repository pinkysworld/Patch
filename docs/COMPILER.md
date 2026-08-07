# Patch Compiler Architecture

## Status

Patch 0.1 was interpreter-only. Patch 0.2 beta.4 has a compiler front end, semantic change analysis, a mechanized formal core, and two portable output forms:

```text
Patch source
   |
   v
parser
   |
   v
AST
   |
   +--> semantic Change Signature analysis
   |       |
   |       +--> inferred recipe effects
   |       `--> Change Capability validation
   |
   v
Patch compiler
   |
   v
Change IR
   |
   +--> .patchapp portable bundle      [implemented]
   +--> bootstrap WebAssembly module   [implemented]
   +--> direct executable Wasm         [next backend stage]
   +--> native host package            [planned]
   `--> portable C99 fallback          [planned]
```

`src/compiler.js` lowers valid Patch source to normalized Change IR. `src/change-analysis.js` infers semantic Change Signatures and validates optional Change Capability policies. `src/bundle.js` packages source + IR + manifest into `.patchapp`. `src/wasm.js` emits an instantiable WebAssembly module containing a compiled Patch payload that a Patch host can load.

The current `.wasm` backend is deliberately called **bootstrap WebAssembly**. It proves the portable binary/container path and runs through the standard WebAssembly validator/loader, but it does not yet lower every Patch operation directly into executable Wasm instructions. Direct Change IR-to-Wasm execution is the next backend milestone.

## Why Change IR

In Patch, a state change is not instrumentation added after assignment. The change is the mutation primitive. The compiler therefore preserves `CHANGE` explicitly in its intermediate representation.

Example:

```patch
change score:
  add 1
```

becomes conceptually:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [
    { "op": "add", "expr": "1" }
  ]
}
```

Later compiler stages may specialize this into efficient machine operations, but the semantic Change IR remains available for execution semantics, history, debugging, preview, replay, GUI updates and conflict analysis.

## Research invariant: State-Change Factorization

The compiler architecture is shaped around a formal property rather than around logging convenience:

> If a supported Patch source step mutates existing persistent state from `S` to `S'`, the transition factors through a semantic change `delta` such that `apply(delta, S) = S'`, and commit occurs through `apply` rather than through a hidden assignment path.

The Lean formal machine already proves this property for its modeled change step. The production compiler still needs a correspondence proof connecting emitted Change IR to that formal model.

## Semantic Change Signatures

Patch statically summarizes the semantic state changes a recipe may produce.

```patch
make reward(player):
  change player:
    add 5 to score
```

The compiler records approximately:

```json
{
  "reward": {
    "params": ["player"],
    "changes": [
      {
        "path": "player.score",
        "operation": "increase",
        "amount": 5,
        "staticAmount": true
      }
    ]
  }
}
```

The production analysis distinguishes `set`, `clear`, source-level `add`/`remove`, and provable numeric `increase`/`decrease`. It also records whether a change is preview-only.

For simple recipe calls the analysis substitutes callee parameters into the caller signature:

```patch
make add_points(target):
  change target:
    add 5 to score

make reward(player):
  do add_points(player)
```

The signature for `reward` contains `player.score -> increase by 5`, with provenance that the effect came through `add_points`.

This is intentionally conservative. Dynamic targets, unknown callees and recursive cycles are marked unproven rather than silently treated as safe.

## Machine-checked Change Signature Soundness

Beta 4 adds `formal/PatchSignature.lean`, which defines a smaller normalized control-flow core containing:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

It also defines a static `inferSignature` function and a runtime `Executes stmt trace` relation.

Lean proves:

```text
RuntimeChanges(stmt) subset-of inferSignature(stmt)
```

for every execution of that formal core. Branch inference intentionally includes effects from both possible branches, so the signature can over-approximate behavior but cannot omit a runtime effect. Bounded repetition can emit an effect multiple times, but every emitted effect remains covered by the body's static signature.

This is an important theorem about the formal core, not yet verification of `src/change-analysis.js`.

## Change Capabilities

Patch can optionally restrict a recipe to a declared semantic change policy:

```patch
allow reward:
  player.score may increase up to 10

make reward(player):
  change player:
    add 5 to score
```

The production compiler checks the inferred committed Change Signature against the policy before emitting IR.

A recipe protected by a capability fails compilation when:

- it changes a target/path not named by the policy;
- it performs a semantic operation not allowed by the policy;
- it exceeds a statically declared `up to` bound;
- a bounded dynamic amount cannot be proven safe;
- a transitive call prevents safe target/effect resolution.

This is intentionally different from a traditional binary read/write permission. A policy can permit `increase player.score up to 10` while rejecting `set player.score`, even though both are writes to the same storage location.

### Formal end-to-end theorem

For the structured Lean core, beta 4 now proves:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

The theorem is `endToEndCapabilitySoundness`. Unlike the earlier composition theorem, it derives signature coverage from the formal execution semantics rather than receiving that coverage as an assumption.

### Remaining compiler bridge

The next research step is to connect production analysis to the formal theorem. Candidate approaches:

1. define a correspondence relation between Change IR effects and Lean `Effect` values;
2. emit a deterministic machine-readable semantic evidence file from the compiler;
3. validate that evidence with a small verified checker;
4. or prove direct correspondence for a restricted executable compiler fragment.

Until one of these bridges exists, documentation must distinguish **formal-core soundness** from **production-compiler soundness**.

### IR representation

Patch IR includes both:

```text
changeSignatures
changeCapabilities
```

alongside host/runtime capability strings such as `ui.window`. These concepts are distinct: host capabilities describe services the application needs; Change Capabilities describe semantic mutations a recipe is allowed to produce.

## Numeric range analysis

Ranged recipe parameters can provide quantitative evidence:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production interval analyzer derives `bonus * 2` as `0..10`. If the possible range exceeds the capability bound, compilation fails conservatively. Runtime guards preserve declared parameter-range assumptions.

The next formal target is soundness of this executable interval analyzer: every supported concrete evaluation must lie inside the inferred interval.

## Application kinds

Patch has one language and one compiler with multiple application profiles.

### Console application

Has console I/O and no graphical event loop by default.

Target packages:

- portable `.patchapp` [implemented];
- bootstrap `.wasm` [implemented];
- direct WebAssembly/WASI console executable [planned];
- Windows PE console executable [planned];
- macOS CLI, preferably Universal where practical [planned];
- Linux ELF CLI [planned];
- BSD/Unix native or portable-C build [planned].

### Window application

Uses Patch UI and a graphical event loop.

The compiler already represents `window`, controls and event handlers in Change IR and Patch Studio can execute/preview that model in the browser. Planned native packages are:

- Windows GUI-subsystem `.exe`;
- macOS `.app` bundle;
- Linux/BSD graphical executable;
- browser/WebAssembly application;
- portable `.patchapp`.

## Portable `.patchapp`

The canonical portable bundle is designed to remain independent of one host OS.

Current beta representation is human-readable JSON:

```text
MyApp.patchapp
  manifest
  source files
  Change IR
  semantic Change Signatures
  Change Capability policies
  assets
```

A later binary/ZIP container may replace the transport encoding while preserving the logical format.

## Bootstrap WebAssembly

Current command:

```text
patch build hello.patch --kind console --target wasm
```

produces a valid `.wasm` module. The module exports linear memory and metadata locating an embedded Patch payload containing source + Change IR, including the semantic change analysis. This lets browser/native Patch hosts load the same compiled artifact and gives CI a real WebAssembly validation/instantiation target today.

The next stage replaces host interpretation of Change IR with direct lowering of the deterministic core to Wasm functions and memory operations. GUI operations then call a small Patch UI host interface rather than embedding platform-specific APIs in Patch source.

## Native packaging strategy

Patch should not implement x86-64, ARM64, RISC-V, PE, Mach-O and ELF code generators independently in the early project.

The initial native strategy is:

```text
program.wasm + small Patch host/runtime = standalone native package
```

This allows one portable program representation while host shells supply windows, menus, file dialogs, clipboard integration, application lifecycle and platform packaging.

A future AOT backend can be added without changing Patch source semantics.

## Unix portability escape hatch

For systems without a supported WebAssembly runtime or Patch native host, the compiler should eventually support:

```text
Patch -> Change IR -> portable C99
```

This is especially valuable for console programs on less common Unix variants and architectures.

## Compiler commands

```text
patch run hello.patch
patch check hello.patch
patch changes hello.patch
patch build hello.patch --kind console --target portable
patch build hello.patch --kind console --target wasm
```

`patch changes` prints the inferred recipe signatures and their declared allowed-change policies.

Windows/macOS/Linux/BSD native targets become active as their host packagers land.

## Quality gates

CI must syntax-check semantic analysis, run Change Signature/Capability tests, compile every example, instantiate the generated bootstrap Wasm, validate Change IR preservation, build `.patchapp`, and build/validate the deployed Patch Studio site on Windows, macOS and Linux.

Formal CI separately builds both Lean libraries and rejects unfinished proofs.

## Compiler design constraint

The sophistication of the backend and policy analysis must never leak into beginner Patch code. A beginner can ignore `allow` completely. Change Capabilities are an optional advanced safety layer built on semantics that Patch already needs for ordinary execution.

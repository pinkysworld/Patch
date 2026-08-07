# Patch Compiler Architecture

## Status

Patch 0.1 was interpreter-only. Patch 0.2 beta.5 has a compiler front end, semantic change analysis, a mechanized formal core, a conservative production-to-formal validation bridge, and two portable output forms.

```text
Patch source
   |
   v
parser / AST
   |
   +--> semantic Change Signature analysis
   |       |
   |       `--> Change Capability validation
   |
   +--> formal bridge reconstruction
   |       |
   |       `--> compare supported production/formal signatures
   |
   v
Change IR 0.5
   |
   +--> .patchapp portable bundle      [implemented]
   +--> bootstrap WebAssembly module   [implemented]
   +--> direct executable Wasm         [next backend stage]
   +--> native host package            [planned]
   `--> portable C99 fallback          [planned]
```

`src/compiler.js` lowers valid Patch source to normalized Change IR. `src/change-analysis.js` infers semantic Change Signatures and validates optional Change Capability policies. `src/formal-bridge.js` independently reconstructs the currently supported formal-core signature shape from the production AST. `src/bundle.js` packages source + IR + manifest into `.patchapp`. `src/wasm.js` emits an instantiable WebAssembly module containing a compiled Patch payload for a Patch host.

The current `.wasm` backend is deliberately called **bootstrap WebAssembly**. It is not yet direct lowering of every Patch operation to executable Wasm instructions.

## Why Change IR

In Patch, a state change is not instrumentation added after assignment. The change is the mutation primitive. The compiler therefore preserves `CHANGE` explicitly in its intermediate representation.

```patch
change score:
  add 1
```

becomes conceptually:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [{ "op": "add", "expr": "1" }]
}
```

Later compiler stages may specialize this into efficient machine operations, but the semantic Change IR remains available for execution semantics, contracts, history, debugging, preview, replay and GUI updates.

## State-Change Factorization

The architecture is shaped around the property:

> If a supported Patch source step mutates existing persistent state from `S` to `S'`, the transition factors through a semantic change `delta` such that `apply(delta, S) = S'`, and commit occurs through that semantic change rather than through hidden assignment followed by logging.

The Lean formal machine proves this for its modeled state-changing step.

## Semantic Change Signatures

Patch statically summarizes semantic state changes a recipe may produce.

```patch
make reward(player):
  change player:
    add 5 to score
```

Conceptually:

```text
reward(player)
  player.score -> increase by 5
```

The production analyzer distinguishes `set`, `clear`, source-level `add`/`remove`, and provable numeric `increase`/`decrease`, including amount intervals. Simple recipe calls are analyzed transitively; dynamic targets, unknown callees and recursive cycles are treated conservatively.

## Machine-checked signature theorem

`formal/PatchSignature.lean` defines a normalized control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

with static `inferSignature` and runtime `Executes stmt trace` definitions.

Lean proves:

```text
RuntimeChanges(stmt) subset-of inferSignature(stmt)
```

for every execution of that formal core. Branch inference may over-approximate by including both alternatives, but cannot omit an emitted runtime effect.

## Change Capabilities

A recipe can be restricted to a semantic policy:

```patch
allow reward:
  player.score may increase up to 10
```

The compiler rejects an inferred `set`, a decrease, an out-of-policy path, or a provably excessive amount.

For the structured Lean core, beta 4 established:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

## Beta 5 production-to-formal bridge

Beta 5 starts connecting the production JavaScript compiler to that theorem.

`buildFormalBridge(ast, changeAnalysis)` performs an independent translation from the real AST into a small Lean-like control-flow representation, infers a formal-style signature from that representation, normalizes the ordinary production signature, and compares them.

For a bridge-supported entry:

```text
production AST ----------------------> production signature
      |
      v
independent formal-bridge lowering
      |
      v
CoreStmt-like representation
      |
      v
formal-style signature
      |
      +------------------------------> compare
                                      |
                               mismatch = error
```

A supported mismatch aborts compilation. This makes divergence between two independently implemented signature paths visible in tests and CI.

### Formal bridge artifact

Patch IR now contains:

```text
formalBridge
```

with:

```json
{
  "format": "patch-formal-bridge",
  "version": "0.1",
  "leanModel": "PatchSignature",
  "theorem": "changeSignatureSoundness",
  "entries": {},
  "summary": {
    "supported": 0,
    "unsupported": 0,
    "mismatches": 0
  }
}
```

Each entry records the reconstructed core, formal-style signature, normalized production signature, whether they match, and reasons when that entry is outside the current correspondence subset.

### Supported today

The bridge currently covers direct supported semantic changes, sequencing, branch alternatives, literal non-negative repetition, and range-derived numeric amounts that classify as `increase` or `decrease`. Preview is conservatively modeled as no committed effect.

### Explicitly outside the current bridge

The current bridge does not claim coverage for:

- recipe calls/parameter substitution across calls;
- dynamic repeat counts;
- `return` control flow;
- undo/redo;
- GUI/window/event execution;
- mixed-sign or otherwise unsupported semantic amount classes;
- unproven/transitive production effects.

Those entries remain valid Patch programs where otherwise supported, but are labeled `supported: false` for formal correspondence.

### What the bridge means

The bridge is **translation validation / conformance evidence**, not a proof that JavaScript is correct. Both comparison paths currently run in JavaScript. The high-value next step is a small verified checker or a formal theorem relating a stable bridge/evidence schema to Lean `CoreStmt`, `Effect`, `inferSignature`, and policy admission.

## CLI formal coverage report

Use:

```text
patch formal program.patch
```

The report shows which program/recipe entries are inside the current bridge subset and why other entries are not yet covered.

`patch check` also reports the number of bridge-supported entries.

## Numeric range analysis

Ranged parameters provide quantitative evidence:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production interval analyzer derives `bonus * 2` as `0..10`. If the possible range exceeds the bound, compilation fails conservatively. Runtime guards preserve declared input-range assumptions.

A future Lean theorem should prove that every concrete evaluation of the supported expression fragment lies inside the interval produced by the analyzer.

## IR representation

Patch IR 0.5 includes:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
```

Host capabilities such as `ui.window` remain distinct from semantic Change Capabilities.

## Application kinds

Patch has one language and compiler with console and window profiles.

Current outputs:

- portable `.patchapp` [implemented];
- bootstrap `.wasm` [implemented].

Planned outputs:

- direct WebAssembly/WASI;
- Windows console/GUI `.exe`;
- macOS CLI and `.app`;
- Linux CLI/GUI;
- BSD/Unix native or C99 fallback.

## Portable `.patchapp` and Wasm

Because `formalBridge` is part of Change IR, current `.patchapp` and bootstrap Wasm payloads carry the bridge evidence automatically alongside signatures and capabilities.

The bootstrap Wasm module remains a carrier for Patch source + Change IR loaded by a Patch host. Direct Change IR-to-Wasm execution is still the next backend stage.

## Native packaging strategy

The initial native strategy remains:

```text
program.wasm + small Patch host/runtime = standalone native package
```

For uncommon Unix systems, a future fallback is:

```text
Patch -> Change IR -> portable C99
```

## Compiler commands

```text
patch run hello.patch
patch check hello.patch
patch changes hello.patch
patch formal hello.patch
patch build hello.patch --kind console --target portable
patch build hello.patch --kind console --target wasm
```

## Quality gates

Every Windows/macOS/Linux CI matrix job now checks syntax, tests the independent formal bridge, executes examples, runs `patch formal` on a supported example, builds `.patchapp`, builds bootstrap Wasm and validates the public Patch Studio site.

Formal CI separately builds both Lean libraries and rejects unfinished `sorry`/`admit` proofs.

## Design constraint

Formal machinery must not make beginner Patch syntax harder. A beginner can ignore `allow`, formal bridge reports and the proof system entirely while still writing normal Patch programs.

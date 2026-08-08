# Patch Compiler Architecture

## Status

Patch 0.2 beta.6 has a compiler front end, semantic change analysis, a mechanized formal core, a conservative production-to-formal validation bridge, and a Lean-verified semantic policy checker that can validate certificates generated from protected Patch recipes.

```text
Patch source
   |
   v
parser / AST
   |
   +--> semantic Change Signature analysis
   |       |
   |       `--> production Change Capability validation
   |
   +--> formal bridge reconstruction
   |       |
   |       `--> compare supported production/formal signatures
   |
   v
Change IR 0.5
   |
   +--> Lean certificate generator
   |       |
   |       v
   |    PatchChecker [Lean verified]
   |       |
   |       `--> checked semantic-policy theorem
   |
   +--> .patchapp portable bundle      [implemented]
   +--> bootstrap WebAssembly module   [implemented]
   +--> direct executable Wasm         [next backend stage]
   +--> native host package            [planned]
   `--> portable C99 fallback          [planned]
```

`src/compiler.js` lowers valid Patch source to normalized Change IR. `src/change-analysis.js` infers semantic Change Signatures and performs the production policy check. `src/formal-bridge.js` independently reconstructs the currently supported formal-core signature shape from the production AST. `src/certificate.js` serializes bridge-supported protected recipes and policies into Lean source. `formal/PatchChecker.lean` independently checks the formal signature against the policy and proves the boolean checker sound with respect to the relational semantics.

`src/bundle.js` packages source + IR + manifest into `.patchapp`. `src/wasm.js` emits an instantiable WebAssembly bootstrap module containing a compiled Patch payload for a Patch host.

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

The production compiler rejects an inferred `set`, a decrease, an out-of-policy path, or a provably excessive amount.

For the structured Lean core:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

is machine checked.

## Production-to-formal bridge

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

A supported mismatch aborts compilation. Bridge evidence is part of Change IR 0.5 and can be inspected with:

```text
patch formal program.patch
```

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

## Beta 6 verified semantic policy checker

Beta 6 introduces `formal/PatchChecker.lean`. The checker is deliberately much smaller than the production compiler.

It implements executable boolean checks for:

- target equality;
- optional field equality;
- semantic operation equality;
- optional interval containment;
- existence of a policy rule covering each inferred semantic effect.

The crucial point is that Lean does not merely execute these booleans. It proves their soundness:

```text
policyAllowsBool(signature, policy) = true
=> PolicyAllows(signature, policy)
```

and therefore:

```text
checkProtected(stmt, policy) = true
Executes(stmt, runtime)
=> every runtime effect has an allowing policy rule
```

The theorem `checkedExecutionCannotEscape` composes checker soundness with the previously proved Change Signature Soundness theorem.

This means the JavaScript production checker is no longer the final authority for the formal subset. The producer supplies translated evidence; Lean independently decides the formal policy judgment.

## Generated Lean certificates

Use:

```text
patch certify program.patch --out Program.patchcert.lean
```

For each protected recipe inside the formal bridge subset, `src/certificate.js` emits:

```text
source SHA-256
Patch IR version
formal CoreStmt
formal policy rules
checkProtected = true theorem
runtime policy-containment theorem
```

The concrete checker theorem is discharged by Lean computation (`native_decide`) and the runtime theorem invokes `checkedExecutionCannotEscape`.

The certificate generator refuses protected recipes outside the bridge subset rather than silently weakening the guarantee.

### Trust boundary

Beta 6 has a smaller trusted computing base, but the whole compiler is **not** verified.

Trusted/unproved today:

```text
Patch source
   -> JavaScript parser
   -> formal-bridge translation
```

Lean-checked after that boundary:

```text
CoreStmt + policy
   -> inferSignature
   -> executable policy checker
   -> PolicyAllows proof
   -> runtime policy containment for formal Executes traces
```

The source SHA-256 in a certificate binds the emitted artifact to exact source bytes, but does not prove that the JavaScript source-to-CoreStmt translation is correct.

The next major theorem therefore concerns correspondence across this boundary, not another restatement of policy containment.

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

The Lean checker independently validates interval containment once an effect interval is translated into the certificate. It still does not prove that the production expression analyzer computed that interval soundly. A later theorem should establish that every concrete evaluation of the supported expression fragment lies inside its production-inferred interval.

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

## Application kinds and output

Patch has one language and compiler with console and window profiles.

Current outputs:

- portable `.patchapp` [implemented];
- bootstrap `.wasm` [implemented];
- Lean-checkable `.patchcert.lean` evidence for protected bridge-supported recipes [implemented].

Planned outputs:

- direct WebAssembly/WASI;
- Windows console/GUI `.exe`;
- macOS CLI and `.app`;
- Linux CLI/GUI;
- BSD/Unix native or C99 fallback.

The bootstrap Wasm module remains a carrier for Patch source + Change IR loaded by a Patch host. Direct Change IR-to-Wasm execution is still the next backend stage.

## Compiler commands

```text
patch run hello.patch
patch check hello.patch
patch changes hello.patch
patch formal hello.patch
patch certify protected.patch --out Protected.patchcert.lean
patch build hello.patch --kind console --target portable
patch build hello.patch --kind console --target wasm
```

## Quality gates

Every Windows/macOS/Linux CI matrix job checks syntax, tests the formal bridge and certificate generator, executes examples, runs the bridge report, generates a Lean certificate, builds `.patchapp`, builds bootstrap Wasm and validates the public Patch Studio site.

Formal CI separately:

1. generates a certificate using the **production JavaScript compiler**;
2. explicitly compiles `PatchFormal`, `PatchSignature`, and `PatchChecker` with pinned Lean 4.30;
3. compiles the generated certificate against those modules;
4. rejects actual `sorry`/`admit` proof placeholders.

Beta 6 intentionally strengthened this gate after discovering that the previous bare `lake build` invocation could complete with zero build jobs. Formal green status now requires actual compilation of the proof modules.

## Design constraint

Formal machinery must not make beginner Patch syntax harder. A beginner can ignore `allow`, formal bridge reports, certificate generation and the proof system entirely while still writing normal Patch programs.

# Patch Compiler Architecture

## Status

Patch 0.2 beta.7 has a compiler front end, semantic change analysis, a mechanized formal core, a conservative production-to-formal bridge, a Lean-verified policy checker, and a **Lean-validated proof-free production evidence boundary**.

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
   +--> conservative formal bridge
   |       |
   |       `--> JavaScript translation-validation comparison
   |
   +--> proof-free EvidenceStmt + production signature claim
   |       |
   |       v
   |    PatchEvidence [Lean verified]
   |       |
   |       +--> validate raw intervals
   |       +--> decode to CoreStmt
   |       +--> infer formal signature
   |       +--> check production-signature correspondence
   |       `--> PatchChecker policy judgment
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

`src/compiler.js` lowers valid Patch source to normalized Change IR. `src/change-analysis.js` infers semantic Change Signatures and performs the production policy check. `src/formal-bridge.js` reconstructs the conservative formal subset. `src/certificate.js` emits proof-free semantic evidence, a separate production-signature claim and policy rules. `formal/PatchEvidence.lean` validates and decodes that evidence; `formal/PatchChecker.lean` checks semantic authority.

`src/bundle.js` packages source + IR + manifest into `.patchapp`. `src/wasm.js` emits an instantiable WebAssembly bootstrap module containing a Patch payload for a Patch host.

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

Later compiler stages may specialize this into efficient machine operations, while the semantic Change IR remains available for contracts, history, debugging, preview, replay and UI state updates.

## State-Change Factorization

The architecture is shaped around the property:

> If a supported Patch source step mutates existing persistent state from `S` to `S'`, the transition factors through a semantic change `delta` such that `apply(delta, S) = S'`, and commit occurs through that semantic change rather than hidden assignment followed by logging.

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

The production analyzer distinguishes `set`, `clear`, source-level `add`/`remove`, and provable numeric `increase`/`decrease`, including amount intervals. Dynamic targets, unknown callees and recursion are treated conservatively.

## Formal signature and policy theorems

`formal/PatchSignature.lean` defines:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

with static `inferSignature` and runtime `Executes stmt trace`.

Lean proves:

```text
RuntimeChanges(stmt) subset-of inferSignature(stmt)
```

and, for a protected formal statement:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

`PatchChecker.lean` makes policy checking executable and proves the boolean checker sound.

## Production-to-formal bridge

`buildFormalBridge(ast, changeAnalysis)` independently translates the real AST into a small formal-like control-flow representation and compares its reconstructed signature with the production Change Signature.

A supported mismatch aborts compilation. The bridge currently covers direct formal-vocabulary changes, sequencing, both branch alternatives, literal repetition and supported range-derived numeric amounts. Preview is modeled as no committed effect.

Recipe calls, dynamic repeat counts, return, undo/redo, GUI/events, mixed-sign unsupported amount classes and unproven/transitive effects remain outside the bridge subset.

Use:

```text
patch formal program.patch
```

This JavaScript comparison remains useful translation-validation evidence, but beta 7 adds an independent Lean boundary after it.

## Beta 7 proof-free evidence schema

The certificate producer emits `EvidenceStmt`, not a trusted generated `CoreStmt`.

The Lean evidence vocabulary is deliberately simple:

```text
EvidenceAmount { lo, hi }
EvidenceEffect { target, field, kind, amount? }
EvidenceStmt = skip | emit | seq | branch | repeat
```

`EvidenceAmount` contains no `lo <= hi` proof. Lean checks the bound order during `decodeEvidenceAmount`; invalid evidence fails decoding.

`decodeEvidenceStmt` recursively validates evidence and produces `Option CoreStmt`.

## Machine-checked evidence/signature correspondence

The production certificate also emits a **separate production Change Signature claim** as `List EvidenceEffect`.

Lean independently:

1. decodes the EvidenceStmt;
2. runs the mechanized `inferSignature` on the decoded `CoreStmt`;
3. erases proof fields into canonical `EvidenceEffect` values;
4. removes duplicate semantic effects;
5. compares the result with the production claim.

The executable check is:

```text
checkEvidenceSignature(evidence, claim)
```

and Lean proves:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceSignature(evidence, claim) = true
------------------------------------------------
encodeSignature(inferSignature(stmt)) = claim
```

via `checkedEvidenceSignatureCorresponds`.

This is stronger than beta 6 because JavaScript no longer creates the formal `CoreStmt` value that the policy theorem directly trusts. Lean derives that core from proof-free evidence and independently reconstructs its signature.

## Evidence-level semantic policy checking

`checkEvidenceProtected(evidence, policy)` first decodes evidence and only then invokes the verified semantic policy checker.

Lean proves:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceProtected(evidence, policy) = true
Executes(stmt, runtime)
------------------------------------------------
every runtime effect has an allowing policy rule
```

via `checkedEvidenceExecutionCannotEscape`.

## Generated Lean certificates

Use:

```text
patch certify program.patch --out Program.patchcert.lean
```

For each protected recipe inside the bridge subset, `src/certificate.js` emits:

```text
source SHA-256
Patch IR version
evidence schema version
proof-free EvidenceStmt
separate production Change Signature claim
formal policy rules
machine-decided evidence/signature theorem
machine-decided evidence/policy theorem
runtime policy-containment theorem
```

The generator refuses protected recipes outside the supported bridge/evidence subset rather than silently weakening the guarantee.

### Remaining trust boundary

Beta 7 still does **not** verify the whole compiler.

Trusted/unproved today:

```text
Patch source
   -> JavaScript parser / AST
   -> proof-free evidence extraction
   -> production signature claim extraction
   -> policy extraction
```

Lean-checked after that boundary:

```text
proof-free evidence
   -> interval validation
   -> CoreStmt decoding
   -> formal signature inference
   -> production-signature correspondence
   -> semantic policy checking
   -> runtime policy containment for formal traces
```

The next major formal theorem should relate the supported production AST/source fragment to the emitted `EvidenceStmt` rather than proving policy soundness again.

## Numeric range analysis

Ranged parameters provide quantitative evidence:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production analyzer derives `bonus * 2` as `0..10`. Lean beta 7 validates that the emitted raw interval is internally well formed and checks policy containment, but it still does not prove that the JavaScript expression analyzer computed a sound interval. That production range-analysis theorem remains a priority.

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

Current outputs:

- portable `.patchapp` [implemented];
- bootstrap `.wasm` [implemented];
- Lean-checkable `.patchcert.lean` evidence for protected bridge-supported recipes [implemented].

Planned outputs include direct WebAssembly/WASI and native Windows/macOS/Linux/BSD packaging.

Bootstrap Wasm remains a carrier for Patch source + Change IR loaded by a Patch host. Direct Change IR-to-Wasm execution is still the next backend stage.

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

Every Windows/macOS/Linux CI matrix job checks syntax, tests the formal bridge and certificate generator, executes examples, generates an evidence certificate, builds `.patchapp`, builds bootstrap Wasm and validates the public Patch Studio site.

Formal CI separately:

1. generates a certificate using the production JavaScript compiler;
2. explicitly compiles `PatchFormal`, `PatchSignature`, `PatchChecker` and `PatchEvidence` with pinned Lean 4.30;
3. compiles the generated evidence certificate;
4. rejects actual `sorry`/`admit` proof placeholders.

## Design constraint

Formal machinery must not make beginner Patch syntax harder. A beginner can ignore `allow`, formal bridge reports, certificate generation and the proof system entirely while writing normal Patch programs.

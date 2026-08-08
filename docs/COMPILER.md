# Patch Compiler Architecture

## Status

Patch 0.2 beta.8 has a compiler front end, semantic Change Signature analysis, Change Capabilities, a conservative semantic bridge, a formal source-core extractor, a Lean-verified policy checker, and machine-checked source/evidence/signature correspondence for the formal subset.

```text
Patch source
   |
   v
JavaScript parser / AST
   |
   +--> production Change Signature analysis
   |       `--> production Change Capability validation
   |
   +--> formal-source extractor
   |       `--> SourceStmt preserving add/remove/set/clear
   |
   +--> semantic formal bridge
   |       `--> EvidenceStmt-style semantic claim
   |
   v
Change IR 0.6
   |
   +--> generated Lean certificate
   |       |
   |       v
   |    PatchSource [Lean]
   |       +--> validate source amount bounds
   |       +--> normalize add/remove/set/clear
   |       +--> check SourceStmt -> EvidenceStmt
   |       v
   |    PatchEvidence [Lean]
   |       +--> validate/decode EvidenceStmt -> CoreStmt
   |       +--> infer formal Change Signature
   |       +--> compare separate production signature claim
   |       v
   |    PatchChecker [Lean]
   |       `--> verify semantic policy
   |
   +--> .patchapp                    [implemented]
   +--> bootstrap .wasm              [implemented]
   +--> direct executable Wasm       [planned]
   `--> native host packaging        [roadmap]
```

## Why Change IR

Patch does not perform an ordinary persistent assignment and then attach a log record. `change` is the source mutation primitive and `CHANGE` is preserved in IR.

```patch
change score:
  add 1
```

conceptually lowers to:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [{ "op": "add", "expr": "1" }]
}
```

This structure is reused by execution, history, inverse generation, provenance, semantic contracts and formal evidence.

## State-Change Factorization

The compiler/runtime architecture follows the intended property:

> For supported persistent mutation, the state transition is performed through a semantic change rather than through hidden assignment followed by observation.

The Lean formal machine proves State-Change Factorization for its modeled state-changing step. Production-runtime correspondence remains a separate obligation.

## Production semantic analysis

`src/change-analysis.js` infers semantic Change Signatures. It can distinguish, for example:

```text
player.score -> increase by [0,10]
player.score -> decrease by 2
player.score -> set
```

Optional `allow` policies constrain the target, field, operation and maximum amount. The production compiler rejects protected code when it cannot prove that inferred committed effects are inside the declared policy.

## Two separate production formal views

Beta 8 deliberately avoids deriving every formal claim through one producer path.

### `src/formal-source.js`

This extractor preserves source mutation verbs:

```text
add | remove | set | clear
```

and structured control flow:

```text
skip | change | seq | branch | repeat
```

For numeric `add`/`remove`, it attaches the production-inferred raw amount range, but it does **not** pre-classify the source verb as increase/decrease.

### `src/formal-bridge.js`

This older independent path reconstructs the semantic formal subset and normalizes operations to semantic effects such as `increase`, `decrease`, `set`, and `clear`.

### `src/change-analysis.js`

This remains the third path producing the production Change Signature claim.

The certificate can therefore contain three distinct statements about a protected recipe:

```text
SourceStmt
EvidenceStmt
production Change Signature claim
```

Lean checks their required correspondence.

## PatchSource: source-level normalization in Lean

`formal/PatchSource.lean` defines:

```text
SourceChangeKind = add | remove | set | clear
SourceChange
SourceStmt
```

and executable `normalizeSourceChange` / `lowerSourceStmt` functions.

Examples of normalization:

```text
add [0,5]       -> increase [0,5]
remove [0,5]    -> decrease [0,5]
add [-5,-5]     -> decrease [5,5]
remove [-5,-5]  -> increase [5,5]
```

Raw bounds are validated by Lean before use. Mixed-sign source ranges are rejected from the certifiable source subset because one static semantic direction cannot describe them.

The source/evidence checker is:

```text
checkSourceEvidence(source, evidence)
```

and Lean proves:

```text
checkSourceEvidence(source, evidence) = true
------------------------------------------------
lowerSourceStmt(source) = some evidence
```

via `checkSourceEvidence_sound`.

## Source → signature correspondence

`checkSourceSignature source claim` composes the source lowering with beta.7 evidence decoding and formal signature inference:

```text
SourceStmt
   -> Lean semantic normalization
   -> EvidenceStmt
   -> CoreStmt
   -> inferSignature
   -> canonical EvidenceEffect signature
   -> compare with production claim
```

`checkSourceSignature_sound` proves that a successful executable check yields a decoded formal statement whose canonical inferred signature exactly equals the separate production claim.

## Formal source-level policy containment

The current formal source execution relation is:

```text
SourceExecutes(source, runtime)
```

which requires successful Lean lowering to evidence, successful evidence decoding to `CoreStmt`, and an existing formal `Executes` trace.

Lean proves:

```text
SourceExecutes(source, runtime)
checkSourceProtected(source, policy) = true
------------------------------------------------
every runtime semantic effect is allowed by policy
```

via `checkedSourceExecutionCannotEscape`.

This is a theorem about the formal source core. It is **not yet** a theorem that the JavaScript interpreter/runtime implements the same execution relation.

## Generated certificates

Use:

```text
patch certify program.patch --out Program.patchcert.lean
```

For each protected recipe inside both supported production subsets, the generated artifact contains:

```text
exact source SHA-256
Patch IR version
source schema version
semantic evidence schema version
formal SourceStmt
separate semantic EvidenceStmt
separate production Change Signature claim
semantic policy
source/evidence equality theorem
source/signature correspondence theorem
source/policy checker theorem
formal source-runtime containment theorem
```

The generator refuses unsupported protected recipes rather than silently weakening the guarantee.

## Remaining trusted boundary

Beta 8 does **not** verify the whole compiler.

Still trusted/unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> SourceStmt extraction
```

and:

```text
Patch numeric expression
   -> production-inferred amount interval
```

Lean checks, for the current subset, everything after the formal `SourceStmt` and its raw amount intervals:

```text
SourceStmt
   -> semantic normalization
   -> EvidenceStmt equality
   -> CoreStmt decoding
   -> formal signature reconstruction
   -> production-signature correspondence
   -> semantic policy checking
   -> containment for formal SourceExecutes traces
```

The next formal priorities are AST→SourceStmt correspondence, interval-analyzer soundness, and then production-runtime trace correspondence.

## IR representation

Patch IR **0.6** includes:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
```

Host/runtime capabilities such as `ui.window` remain distinct from semantic Change Capabilities.

## Current formal subset

Covered by the source/evidence certificate path:

- direct `add`, `remove`, `set`, `clear` changes;
- proven non-mixed-sign numeric ranges for `add`/`remove`;
- sequence;
- `if` alternatives;
- literal non-negative repetition;
- preview as no committed effect.

Explicitly unsupported today include recipe calls/substitution, dynamic loops, `return`, undo/redo, GUI/event execution, mixed-sign numeric updates, and operations outside the current formal vocabulary.

## Outputs

Current outputs:

- portable `.patchapp`;
- bootstrap `.wasm`;
- generated Lean `.patchcert.lean` source/evidence certificate.

Bootstrap Wasm is a genuine instantiable carrier containing Patch source + Change IR for a Patch host. It is not direct Change IR-to-Wasm execution.

## Quality gates

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax including `formal-source.js`, tests, examples, formal coverage reporting, certificate generation, `.patchapp`, bootstrap Wasm and the public site.

Formal CI explicitly builds:

```text
PatchFormal
PatchSignature
PatchChecker
PatchEvidence
PatchSource
```

with Lean 4.30, compiles a certificate generated by the production compiler, and rejects unfinished proof placeholders.

## Design constraint

Formal machinery must remain optional from the beginner's perspective. Ordinary Patch code still looks like:

```patch
change score:
  add 1
```

without requiring users to understand SourceStmt, EvidenceStmt, Lean or the checker architecture.

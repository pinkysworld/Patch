# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, state transitions, effect inference, capabilities, range analysis, provenance, source calculi, translation validation, proof-carrying evidence, verified checkers, or simple syntax. All of those have substantial prior art.

The current research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** because the mandatory mutation representation contains semantic operation structure, Patch derives operation- and magnitude-aware summaries and policies from it.

Beta 8 strengthens the assurance evidence for those claims. It does **not** introduce a new novelty headline. A formal `SourceStmt` preserves source-level `add`, `remove`, `set`, and `clear`; Lean itself normalizes those source operations into semantic evidence, checks the separately emitted `EvidenceStmt`, reconstructs the formal Change Signature, compares it with a separate production signature claim, and checks the policy.

## Important prior-art collisions

### Plaid

Sunshine et al., *First-Class State Change in Plaid*, OOPSLA 2011, DOI 10.1145/2048066.2048122, makes changing abstract object states central to a programming language. Patch must not claim to invent first-class state change or language-level state evolution.

### Worlds

Warth et al., *Worlds: Controlling the Scope of Side Effects*, ECOOP 2011, DOI 10.1007/978-3-642-22655-7_9, reifies program state and supports scoped speculation/commit/discard. Patch must not claim reified state, speculative state, or undo as new.

### Classical and richer effect systems

Lucassen and Gifford's *Polymorphic Effect Systems*, POPL 1988, DOI 10.1145/73560.73564, is foundational prior art for inferred effects. Modern graded, quantitative, refinement and behavioral effect systems can express much more than binary read/write information.

Patch therefore must not claim that inferring what a function changes, or attaching numeric information to effects, is new by itself.

The candidate distinction is more specific: operation-/magnitude-sensitive state-transition information is derived from the **same semantic mutation representation through which persistent mutation must execute**.

### Effects as Capabilities

Brachthaeuser, Schuster and Ostermann, *Effects as Capabilities*, OOPSLA 2020, DOI 10.1145/3428194, explicitly combines effects and capabilities. Patch must not claim “effects + capabilities” as novel.

Patch instead investigates policies such as:

```text
player.score may increase up to 10
```

where `increase`, `decrease`, `set`, and `clear` are semantically distinct authorities over the same path.

### Typestate, permissions, refinements and object capabilities

These families already constrain state transitions and authority in rich ways. Patch needs a systematic comparison before any priority claim about expressive power.

### Translation validation

Necula's PLDI 2000 work on translation validation is established compiler assurance. Patch's independent producer paths and checked correspondence artifacts are not a new verification paradigm.

### Proof-Carrying Code and certifying compilation

Necula's POPL 1997 *Proof-Carrying Code*, DOI 10.1145/263699.263712, established producer-supplied safety evidence checked by a smaller consumer-side verifier. Patch's generated Lean artifacts and small verified checkers are assurance infrastructure, not a novelty claim.

### Source calculi and verified lowering

Formal source/intermediate languages, semantics-preserving lowering and compiler-correctness proofs have extensive prior art. Beta 8's `SourceStmt` layer must not be presented as a new verification technique. Its purpose is to reduce producer-side semantic trust for Patch's specific mutation model.

### Other neighboring systems

Patch must also compare against XMF first-class undoability, ChEOPS/COPE/Edit Transactions, Elm/Redux-like update architectures, event sourcing, Edit Lenses, incremental change structures, patch theory, reversible languages, CRDTs, provenance/Whyline, abstract interpretation and quantitative/refinement type systems.

## Formal contribution status

### State-Change Factorization

Machine checked for the current Lean state-changing machine step. Every modeled persistent transition has a well-formed semantic Change witness and commits through the single modeled commit route.

### Mutation Transparency

Machine checked as a corollary. The witnessing Change appears in resulting history.

### Change Signature Soundness

For the structured Lean `CoreStmt` execution model:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
```

is machine checked.

### End-to-end formal capability containment

For protected formal statements:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

is machine checked.

### Verified policy checker

`PatchChecker.lean` implements an executable target/field/operation/interval policy checker and proves successful decisions sound.

### Verified semantic evidence boundary

`PatchEvidence.lean` validates proof-free semantic evidence, decodes it into `CoreStmt`, reconstructs the formal signature and checks a separate production signature claim.

### Beta 8 formal Source core

`PatchSource.lean` now moves the checked boundary one step closer to source semantics:

```text
SourceStmt(add/remove/set/clear)
        ↓ Lean normalization
EvidenceStmt(increase/decrease/set/clear)
        ↓ Lean decoding
CoreStmt
        ↓ Lean inferSignature
formal signature
        ↓
compare separate production signature claim
        ↓
verified policy checker
```

Lean checks source/evidence equality with `checkSourceEvidence`, and `checkSourceEvidence_sound` proves a successful boolean result means:

```text
lowerSourceStmt(source) = some evidence
```

`checkSourceSignature_sound` proves successful source/signature checking yields a decoded formal statement whose canonical inferred signature equals the production claim.

For the formal source execution relation, Lean proves via `checkedSourceExecutionCannotEscape`:

```text
SourceExecutes(source, runtime)
checkSourceProtected(source, policy) = true
------------------------------------------------
every runtime effect is allowed by policy
```

This reduces trust in producer-side semantic classification. For example, the producer can say the source verb is `add -5`, but Lean itself must normalize it to semantic `decrease 5` and verify that the separately supplied semantic evidence agrees.

## What Beta 8 still does not prove

The following are still explicit trust gaps:

```text
Patch source bytes
   -> JavaScript parser / production AST
   -> SourceStmt extraction
```

and:

```text
numeric Patch expression
   -> production-inferred amount interval
```

as well as production runtime correspondence with the formal `SourceExecutes` relation.

Therefore **do not** say “Patch programs are formally verified end-to-end.” A correct statement is that the formal source-core-to-semantic-evidence/signature/policy chain is machine checked for the current subset, while production frontend extraction, range-analysis soundness and runtime correspondence remain open.

## Supporting properties, not primary novelty claims

- formal source/evidence checking;
- magnitude/range analysis;
- generated Lean certificates;
- inverse correctness;
- preview laws;
- replay determinism;
- commutation/conflict analysis;
- provenance and `why`;
- GUI/IDE/mobile support;
- portable and future native packaging.

These may strengthen evaluation but should not become the novelty headline.

## Candidate Beta 8 paper claim

A defensible claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation is factored through a structured semantic Change representation. Patch derives operation- and magnitude-aware semantic Change Contracts from that mandatory mutation substrate. For a mechanized core, we prove Change Signature Soundness and runtime policy containment. For a conservative production subset, generated artifacts preserve source mutation verbs in a proof-free Source core; Lean normalizes those source changes to semantic evidence, checks source/evidence correspondence, reconstructs the formal Change Signature, compares it with a separate production claim, and verifies the semantic policy. Production source-to-SourceStmt extraction, interval-analysis soundness, and runtime correspondence remain explicit proof obligations.

This is a candidate contribution claim, not a firstness assertion.

## What would materially weaken the claim?

An earlier general-purpose language/system satisfying most of the following would substantially narrow Patch's contribution:

1. existing persistent state cannot ordinarily mutate outside a structured semantic change mechanism;
2. mutation executes through that representation rather than being logged afterward;
3. the representation distinguishes semantic transition operations beyond only write location;
4. conservative summaries are derived from those same mutations;
5. policies constrain operation kind and quantitative magnitude;
6. runtime-signature-policy containment has formal evidence;
7. a realistic implementation is connected to the formal model through a strong correspondence boundary;
8. the same change representation materially supports tooling such as history/inversion/provenance;
9. evaluation demonstrates practical advantages.

## Systematic search plan

Before submission, search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv across combinations of:

`first-class state change`, `semantic mutation`, `update effects`, `state transition effects`, `graded effects`, `quantitative effects`, `refinement effects`, `behavioral effects`, `effects as capabilities`, `bounded effects`, `state transition permissions`, `operation capabilities`, `verified update language`, `effect soundness`, `proof carrying effects`, `certifying effect systems`, `translation validation effects`, `verified IR correspondence`, `source effect correspondence`, `edit lenses`, `change structures`, `event sourcing semantics`, `reducer state transitions`, `reversible state change`.

## Current positioning

Beta 8 improves the high-venue story because semantic classification itself is no longer entirely producer-trusted inside the certified subset. The producer supplies a source-level mutation representation, a semantic evidence representation and a production signature claim as separate artifacts; Lean checks that the source representation actually lowers to the semantic evidence and that the semantic evidence implies the claimed formal signature and policy judgment.

The strongest next path is:

1. keep State-Change Factorization + quantitative semantic authority as the paper's primary claim;
2. prove/validate production AST → `SourceStmt` extraction for the supported fragment;
3. mechanize interval-analysis soundness because magnitude-aware contracts are central;
4. connect production execution traces to the formal source/core semantics;
5. build two or three compelling security/engineering cases;
6. measure analysis, evidence and checker overhead;
7. conduct a systematic related-work review before submission.

Patch remains a plausible high-venue direction, but **not yet submission-ready**. The next gains should come from closing these formal/evaluation gaps rather than adding surface-language features.

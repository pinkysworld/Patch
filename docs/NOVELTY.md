# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, explicit state transitions, effect inference, capabilities, a live IDE, range analysis, provenance, translation validation, proof-carrying evidence, verified checkers, or English-like syntax. All of those have substantial prior art.

The current research hypothesis has two linked semantic layers:

> **State-Change Factorization:** ordinary persistent mutation is factored through a semantic Change IR that is the exclusive route for post-creation application-state evolution.

and:

> **Semantic Change Contracts:** because mutation already has semantic operation structure, the compiler can infer a Change Signature and constrain possible committed changes with a declared semantic Change Capability policy, including operation-sensitive and quantitative bounds.

Beta 5 added an explicit production/formal translation-validation boundary. Beta 6 added a verified policy-checking boundary. Beta 7 strengthens the assurance story further by having Lean validate and decode **proof-free production evidence** and machine-check that the decoded formal Change Signature equals a separately emitted production-signature claim. These mechanisms support the core contribution but are not themselves claimed as new compiler-verification techniques.

## Important prior-art collisions

### Plaid: first-class state change

Sunshine et al.'s OOPSLA 2011 paper *First-Class State Change in Plaid* makes changing abstract object states a central programming-language concept and gives formal semantics for state transitions/state composition.

Patch therefore must **not** claim to invent first-class state change, explicit state transitions, typestate-oriented programming, or language-level state evolution.

Reference: DOI 10.1145/2048066.2048122.

### Worlds: reified program state, speculation and undo

Warth et al.'s *Worlds: Controlling the Scope of Side Effects* (ECOOP 2011) reifies whole program state, supports speculative nested worlds and commit/discard, and naturally enables undo-like behavior.

Patch cannot claim that reifying state, speculative execution, commit/discard, or automatic undo is new.

Reference: DOI 10.1007/978-3-642-22655-7_9.

### Classical effect systems

Lucassen and Gifford's *Polymorphic Effect Systems* (POPL 1988) is essential prior art. Type-and-effect systems infer conservative approximations of side effects and store regions.

Patch therefore cannot claim that automatically inferring "what a function may change" is new.

The candidate distinction is granularity derived from Patch's mandatory semantic mutation operations. A Change Signature may distinguish, on the same persistent path:

```text
increase by 5
decrease by 2
set
clear
```

and may additionally contain a proved amount interval. Whether this is genuinely distinctive or an instance of richer behavioral/graded/refinement effects must be tested systematically.

Reference: DOI 10.1145/73560.73564.

### Effects as Capabilities / Effekt

Brachthaeuser, Schuster and Ostermann's OOPSLA 2020 work *Effects as Capabilities* explicitly combines effect information and capabilities. Patch therefore must **not** claim that "effects plus capabilities" is new.

Patch's proposal is state-transition oriented: a policy can permit

```patch
player.score may increase up to 10
```

while rejecting `set player.score`, even though both mutate the same storage location.

Reference: DOI 10.1145/3428194.

### Capability, permission, refinement and typestate systems

Ownership, object-capability, permission, typestate, refinement, graded-effect and behavioral type systems can restrict what code may do to resources and how state may evolve. Patch must compare against these families before any priority claim.

### Translation validation

Translation validation is an established compiler-assurance technique. Necula's PLDI 2000 work validates individual compilation results rather than requiring a proof of the complete compiler implementation.

Patch's production/formal comparison and evidence validation must therefore **not** be presented as a new verification paradigm. Their role is to make the implementation-to-proof gap explicit and auditable.

### Proof-Carrying Code and certifying systems

Necula's *Proof-Carrying Code* (POPL 1997) established the idea that a producer can supply code together with safety evidence that a relatively small consumer-side checker validates against a safety policy. Reference: DOI **10.1145/263699.263712**.

Patch generates Lean-checkable artifacts and uses small verified checking components. Therefore Patch must **not** claim to invent proof-carrying safety evidence, certifying compilation, proof-producing compilation, or small-checker architectures.

The Patch-specific research question is whether its **mandatory semantic mutation representation** creates unusually direct evidence for operation- and magnitude-aware state-transition authority. The certificates and evidence decoder are assurance infrastructure for that claim.

### Other neighboring systems

Patch also must distinguish itself from XMF first-class undoability, ChEOPS/COPE/Edit Transactions, Elm/Redux-style update architectures, event sourcing, edit lenses, change structures, patch theory, CRDTs, provenance/why-oriented debugging, reversible programming, refinement types, abstract interpretation and quantitative/graded effect systems.

## Formal contribution status

### State-Change Factorization

For the current Lean machine, every modeled state-changing step is witnessed by a well-formed semantic change and commits through the single change path. Machine checked.

### Mutation Transparency

Every such formal mutation has an inspectable change witness in resulting history. Machine checked.

### Change Signature Soundness

For the structured Lean control-flow core:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
```

is machine checked. Sequencing, branch choice and bounded repetition are modeled. Static signatures may over-approximate untaken branches but cannot miss emitted runtime semantic effects.

### End-to-end Change Capability Soundness

For a protected formal statement whose inferred signature is admitted by a semantic policy, Lean proves:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

### Production translation-validation boundary

For the currently supported production subset, `src/formal-bridge.js` independently reconstructs a formal-style signature from the real AST and compares it with the ordinary production Change Signature.

A supported mismatch is a compiler error. Unsupported constructs are labeled outside the bridge subset. This remains JavaScript translation-validation/conformance evidence, not a source-level correctness theorem.

### Beta 6 verified policy checker

`formal/PatchChecker.lean` implements a small executable checker over normalized formal effects and capability rules. Lean proves that successful checker results imply the relational semantic policy judgment and therefore runtime policy containment for formal executions.

### Beta 7 verified production-evidence correspondence

`formal/PatchEvidence.lean` introduces a proof-free evidence schema. Production emits:

```text
EvidenceStmt
production Change Signature claim
semantic capability policy
```

Raw evidence intervals contain only `lo` and `hi`; they do not carry a producer-generated proof of validity. Lean validates and decodes the evidence into `CoreStmt` and independently runs the formal `inferSignature` function.

Lean then checks:

```text
checkEvidenceSignature(evidence, claim) = true
```

and proves:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceSignature(evidence, claim) = true
------------------------------------------------
encodeSignature(inferSignature(stmt)) = claim
```

The theorem is `checkedEvidenceSignatureCorresponds`.

Policy checking is also lifted to the evidence level. `checkedEvidenceExecutionCannotEscape` proves that a decoded, accepted evidence artifact cannot yield a formal runtime effect outside policy.

This is stronger than beta 6 because a generated `CoreStmt` is no longer directly trusted by the checker. However, the **source/AST-to-evidence extraction is still produced by JavaScript and not yet formally proved correct**. That remaining boundary must stay explicit in the paper.

## Supporting properties, not primary novelty claims

- magnitude/range analysis for bounded semantic changes;
- verified evidence decoding, policy checking and generated certificates;
- inverse correctness for the invertible fragment;
- preview non-interference/agreement;
- deterministic replay consistency;
- soundness of certified commuting changes;
- causal provenance and `why` explanations;
- mobile/web IDE and cross-platform packaging.

These can strengthen the artifact and evaluation without being claimed as individually new.

## Candidate paper claim

A defensible beta-7 claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation executes through a normalized semantic Change IR rather than ordinary assignment plus logging. The same mandatory mutation representation supports operation-sensitive and magnitude-aware semantic Change Contracts. For a mechanized structured core, we prove Change Signature Soundness and runtime policy containment. For a conservative production subset, the compiler emits proof-free semantic evidence and a separate production-signature claim; a small Lean component validates the evidence, decodes it to the formal core, machine-checks signature correspondence, and validates the semantic policy. The remaining source/AST-to-evidence extraction boundary is stated explicitly rather than treated as verified.

This is a **candidate contribution claim**, not a priority assertion.

## What would materially weaken the claim?

An earlier general-purpose language/system satisfying most of the following would substantially narrow Patch's contribution:

1. ordinary existing persistent state cannot mutate outside a structured semantic change mechanism;
2. mutation executes through the structured change rather than being logged afterward;
3. changes contain semantic operation structure more precise than only a location write;
4. inferred summaries conservatively describe those semantic changes;
5. policies constrain operation kind and quantitative magnitude on persistent paths;
6. runtime-signature-policy containment has formal soundness evidence;
7. a realistic implementation is connected to the formal model through a verified or strongly validated evidence/correspondence boundary;
8. one representation is reused for inversion/preview/replay/provenance/tooling;
9. practical evaluation shows concrete advantages.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv for combinations of:

`first-class state change`, `typestate`, `behavioral types`, `graded effects`, `quantitative effects`, `refinement effects`, `effect systems state updates`, `update effects`, `semantic effects`, `effects as capabilities`, `capability type systems`, `bounded effects`, `state transition permissions`, `operation capabilities`, `change-oriented programming`, `runtime state changes`, `translation validation effects`, `verified effect checker`, `proof-carrying effects`, `proof-carrying state transitions`, `certifying compiler effect systems`, `validated evidence IR`, `proof-producing effect analysis`, `edit lenses`, `change structures`, `patch algebra mutable state`, `event sourcing language semantics`, `reducer state transitions`.

## Current positioning

Beta 7 improves the high-venue story because the consumer no longer trusts a producer-generated formal `CoreStmt`. Lean itself validates proof-free semantic evidence, reconstructs the formal core and signature, and checks that result against a separately emitted production signature claim before applying the policy theorem.

The strongest path is now:

1. State-Change Factorization supplies a mandatory semantic mutation substrate;
2. operation- and magnitude-aware signatures are derived from that substrate;
3. semantic capabilities constrain those changes;
4. Lean proves runtime-signature-policy containment for a structured core;
5. the production bridge exposes the supported implementation boundary;
6. proof-free production evidence is independently validated and decoded by Lean;
7. Lean machine-checks evidence/formal-signature correspondence and semantic policy safety;
8. a source/AST-to-evidence correspondence theorem closes the remaining critical frontend trust gap;
9. interval-analysis proof and security/engineering case studies provide measured evidence.

Patch remains a plausible high-venue research direction, but **not yet a submission-ready high-venue paper**. The most important remaining work is source-level evidence extraction soundness, interval-analyzer soundness and measured evaluation, not additional surface-language features.

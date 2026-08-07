# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, explicit state transitions, effect inference, capabilities, a live IDE, range analysis, provenance, translation validation, or English-like syntax. All of those have substantial prior art.

The current research hypothesis has two linked semantic layers:

> **State-Change Factorization:** ordinary persistent mutation is factored through a semantic Change IR that is the exclusive route for post-creation application-state evolution.

and:

> **Semantic Change Contracts:** because mutation already has semantic operation structure, the compiler can infer a Change Signature and optionally prove that possible committed changes are contained in a declared semantic Change Capability policy.

Beta 5 adds an implementation-validation layer:

> **Explicit production/formal correspondence boundary:** production signatures are independently reconstructed through a Lean-like control-flow abstraction for a conservative subset, compared automatically, and unsupported constructs are reported rather than silently treated as verified.

The candidate contribution is the combination and formal connection among these layers, not any one ingredient in isolation.

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

### Translation validation and verified checkers

Compiler translation validation and small verified-checker architectures are established techniques. Beta 5's production/formal bridge is therefore not itself a novelty claim. Its role is to make the implementation-to-proof gap explicit and reproducible while we extend machine-checked correspondence.

### Other neighboring systems

Patch also must distinguish itself from XMF first-class undoability, ChEOPS/COPE/Edit Transactions, Elm/Redux-style update architectures, event sourcing, edit lenses, change structures, patch theory, CRDTs, provenance/why-oriented debugging, and reversible programming.

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

### Beta 5 production validation boundary

For the currently supported production subset, `src/formal-bridge.js` independently reconstructs a formal-style signature from the real AST and compares it with the ordinary production Change Signature.

A supported mismatch is a compiler error. Unsupported constructs are labeled outside the bridge subset.

This is stronger evidence than merely having unrelated tests, but it remains **translation-validation/conformance evidence**, not a machine-checked proof that the JavaScript analyzer is correct. Both comparison paths currently run in JavaScript.

The next meaningful formal step is a small verified checker or a correspondence theorem over a stable semantic evidence representation.

## Supporting properties, not primary novelty claims

- magnitude/range analysis for bounded semantic changes;
- inverse correctness for the invertible fragment;
- preview non-interference/agreement;
- deterministic replay consistency;
- soundness of certified commuting changes;
- causal provenance and `why` explanations;
- mobile/web IDE and cross-platform packaging.

These can strengthen the artifact and evaluation without being claimed as individually new.

## Candidate paper claim

A defensible beta-5 claim is:

> We present Patch, an experimental general-purpose language in which post-creation persistent mutation executes through a normalized semantic Change IR rather than ordinary assignment plus logging. The same mutation representation supports operation-sensitive and magnitude-aware semantic Change Contracts. For a mechanized structured core, we prove that runtime semantic changes are covered by the inferred Change Signature and that a protected execution cannot emit a semantic change outside its admitted capability policy. We additionally provide a conservative production-to-formal validation boundary that independently reconstructs and checks signatures for an explicit supported subset, while clearly separating this evidence from full compiler verification.

This is a **candidate contribution claim**, not a priority assertion.

## What would materially weaken the claim?

An earlier general-purpose language/system satisfying most of the following would substantially narrow Patch's contribution:

1. ordinary existing persistent state cannot mutate outside a structured semantic change mechanism;
2. mutation executes through the structured change rather than being logged afterward;
3. changes contain semantic operation structure more precise than only a location write;
4. inferred summaries conservatively describe those semantic changes;
5. policies constrain operation kind and quantitative magnitude on persistent paths;
6. runtime-signature-policy containment has formal soundness evidence;
7. a realistic implementation is connected to the formal model through a verified or strongly validated correspondence boundary;
8. one representation is reused for inversion/preview/replay/provenance/tooling;
9. practical evaluation shows concrete advantages.

## Search plan before submission

Systematically search ACM DL, IEEE Xplore, DBLP, SpringerLink, Semantic Scholar, Google Scholar and arXiv for combinations of:

`first-class state change`, `typestate`, `behavioral types`, `graded effects`, `quantitative effects`, `refinement effects`, `effect systems state updates`, `update effects`, `semantic effects`, `effects as capabilities`, `capability type systems`, `bounded effects`, `state transition permissions`, `operation capabilities`, `change-oriented programming`, `runtime state changes`, `translation validation effects`, `verified effect checker`, `edit lenses`, `change structures`, `patch algebra mutable state`, `event sourcing language semantics`, `reducer state transitions`.

## Current positioning

Beta 5 improves the high-venue story because the formal theorem and production artifact are no longer completely separate. The correspondence boundary is still partial and non-mechanized, but its coverage and limitations are visible and CI-tested.

The strongest path is now:

1. State-Change Factorization supplies a mandatory semantic mutation substrate;
2. operation- and magnitude-aware signatures are derived from that substrate;
3. semantic capabilities constrain those changes;
4. Lean proves runtime-signature-policy containment for a structured core;
5. the production bridge makes implementation correspondence explicit;
6. a verified checker or theorem upgrades that bridge to machine-checked production assurance for a useful subset;
7. security/engineering case studies demonstrate practical benefit with low programmer burden.

Patch remains a plausible high-venue research direction, but **not yet a submission-ready high-venue paper**. The most important remaining work is verified production correspondence and measured evidence, not additional surface-language features.

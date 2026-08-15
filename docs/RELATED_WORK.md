# Patch related-work review

Status: structured literature pass for the Patch research claim at **0.2.0-beta.34 / Change IR 0.10**.

This document narrows the candidate contribution rather than trying to maximize novelty. Patch does not claim that semantic effects, quantitative types, permissions, state-transition types, pre/postconditions, patches, provenance, or proof-carrying evidence are individually new. Many prior systems are more expressive than Patch along one or more of those dimensions.

The working contribution hypothesis is architectural:

> **Patch makes a structured semantic Change the mandatory route for ordinary post-creation persistent mutation, then derives operation- and magnitude-aware summaries and authority from that same mutation representation.**

The relevant comparison is therefore not merely whether another formalism *can express* a bounded state relation. It is whether ordinary mutation is *factored through the representation from which that relation and its authority are derived*.

## Review method and scope

This pass is a structured programming-languages related-work review, not a claim of exhaustive systematic-review coverage in the medical/social-science sense.

The search and inclusion scope was organized around the mechanisms most likely to subsume or weaken the Patch hypothesis:

1. first-class/reified state change and typestate;
2. classical, algebraic, sequential, graded and dependent effect systems;
3. capabilities, permissions, ownership and typestate permissions;
4. Hoare/refinement/dependent verification of mutable state;
5. source/program change, edit transactions, incremental computation and patch theory;
6. translation validation, proof-carrying code and certifying compilation;
7. provenance/debugging systems where mutation history is reconstructed or queried.

Priority is given to primary papers and author/institution publication pages. The comparison matrix intentionally separates architectural properties from raw expressiveness.

## Comparison dimensions

For each family, the useful questions are:

- **Reified unit:** what is explicitly represented: an object state transition, effect operation, permission, grade, Hoare predicate, source edit, or runtime state delta?
- **Mandatory mutation route:** must ordinary persistent mutation pass through that representation, or is it an annotation/specification/analysis around otherwise conventional updates?
- **Semantic operation:** does the core representation distinguish update meaning such as set/increase/decrease/clear, rather than only target/write/effect class?
- **Magnitude:** does the core representation directly carry or infer a numeric bound on the state delta?
- **Authority:** is authorization/permission checked in the same vocabulary as the mutation representation?
- **Derived from the same substrate:** are execution, summary and authority all derived from the same mandatory state-change representation?
- **Interprocedural composition:** can summaries/effects/permissions compose through calls?
- **History/provenance reuse:** is the same runtime mutation representation also suitable for history/provenance/undo without reconstructing semantic deltas later?

A `partial` entry does not mean a system is weak. It normally means that the cited work addresses a different abstraction boundary.

## Comparison matrix

| System/family | Reified unit | Mandatory mutation route | Semantic operation in core abstraction | Quantitative magnitude in core abstraction | Authority/specification | Same substrate for mutation + authority | Main relation to Patch |
|---|---|---:|---:|---:|---:|---:|---|
| Plaid first-class state change | object abstract-state transition | partial | partial | no central magnitude contract | typestate/state permissions | partial | closest architectural precedent for first-class state transition; Patch shifts focus to general persistent data changes and semantic operation/magnitude authority |
| Worlds | reified program state/world | no | no | no | scoped side effects | no | reifies and scopes state/effects, but is not a mandatory semantic-delta authority substrate |
| Lucassen-Gifford effects | effect/region annotations | no | effect-class level | no | effect typing | no | foundational effect approximation; Patch does not claim invention of effects |
| Algebraic effects / effect-dependent optimisations | effect operation symbols | no | yes, at effect-operation level | not a state-delta magnitude contract | effect annotations/theories | no | operation identity can be semantic, but ordinary store mutation need not be a mandatory Patch-like delta |
| Sequential effects / effect quantales | ordered effect elements | no | system-dependent | system-dependent | effect typing | no | demonstrates that order-sensitive effects are well established; Patch history order is not itself novel |
| Effekt / Effects-as-Capabilities / System C | capabilities and effect requirements | no | effect/resource level | not the Patch delta-bound default | capabilities/effects | partial | strong precedent for connecting capabilities and effects; Patch claim must rely on mandatory mutation factorization, not merely combining effects and capabilities |
| Graded modal/effect types | grades/resources/effects | no | grade-dependent | yes, quantitative program/resource properties | graded typing | no | directly defeats any broad claim that quantitative effect reasoning is new |
| Borrowing permissions / Mezzo | access/ownership/aliasing permission | no | access/typestate level | no semantic delta magnitude | permissions | no | strong authority/typestate precedent focused on aliasing, ownership and legal access |
| HTT / Hoare-style state specifications | pre/post state predicates | no | arbitrarily specifiable in predicates | expressible | specifications/proofs | no | can express state relations more precisely than Patch; Patch distinction is automatic derivation from mandatory mutation representation |
| F* / Dijkstra monads | predicate transformers / weakest preconditions | no | arbitrarily specifiable | expressible | dependent verification | no | broad verification expressiveness is not Patch novelty; Patch trades generality for a mandatory semantic mutation architecture and derived contracts |
| Edit Transactions / COPE | program edits/change sets | for program edits, not application state | edit-level | not runtime state-delta authority | change management | no | change-oriented programming precedent, but the changed object is primarily program/source evolution |
| Theory of Changes / self-adjusting computation | input/program changes for incremental recomputation | no | change/increment level | not Patch authority | incremental semantics | no | changes are first-class for incremental computation, not the sole persistent mutation/authority path |
| Homotopical patch theory / edit lenses | repository/edit patches | domain-specific | edit operations | not Patch authority | patch consistency/composition | no | establishes rich patch algebra prior art; runtime state mutation factorization is a different target |
| Translation validation / PCC | validation certificate/proof | no | orthogonal | orthogonal | validation/safety proof | no | Patch uses these as assurance techniques, not novelty claims |
| Whyline/provenance debugging | causal/provenance relation | no | reconstructed/query-oriented | no | debugging/provenance | no | Patch provenance/history is supporting tooling enabled by explicit deltas, not a claim to invent provenance |
| **Patch** | semantic runtime state delta (`Change`) | **yes for modeled post-creation persistent mutation** | **yes** | **yes for supported numeric fragment** | **Semantic Change Contracts / capabilities** | **yes by design** | candidate contribution is the conjunction, not any individual column |

## Closest architectural precedent: Plaid and reified state

Sunshine et al. make state change first-class in Plaid and model objects as changing abstract state. This is important prior art against any statement that Patch invented first-class or semantically meaningful state transitions.

The Patch hypothesis is narrower. Patch's ordinary modeled persistent mutation is expressed as a `Change` over persistent data, and the same normalized operation list is used to derive semantic signatures, capability checks and history. The candidate distinction is therefore the conjunction of mandatory state-change factorization and operation/magnitude-aware authority, not first-class state change alone.

This is a hypothesis to defend with the artifact and literature, not a firstness assertion.

## Effect systems: classical, algebraic and sequential

Lucassen and Gifford established polymorphic effect systems in which effects approximate side effects. Later algebraic work identifies effect annotations with operation symbols, and sequential-effect work shows that effect ordering can itself be captured compositionally.

These lines of work prevent several overclaims:

- semantic operation labels are not new merely because Patch uses operation names;
- compositional effect summaries are not new;
- ordered/sequential effects are not new;
- interprocedural effect reasoning is not new.

Patch instead uses a semantic operation vocabulary as the executable persistent update representation. The same operation sequence participates in execution/history and in derived authority checking.

## Effects and capabilities

Effects-as-Capabilities and System C directly connect effect reasoning with capabilities. This is especially important because a weak Patch claim such as "we combine effects and capabilities" would be indefensible.

The surviving Patch hypothesis is structural: semantic authority is derived from the same mandatory `Change` objects through which persistent mutation occurs. Patch should not imply that capability/effect systems cannot express equally strong or stronger policies through other mechanisms.

## Quantitative and graded reasoning

Graded modal types, graded effects and related quantitative type systems already support quantitative program properties. Therefore "magnitude-aware effects" alone is not a sufficient novelty claim.

Patch's quantitative distinction is specifically the magnitude of a semantic state delta, for example `score may increase up to 10`, attached to an operation/target pair derived from the actual mutation representation. The research question is whether that restricted, mutation-centered quantity is useful enough to justify being built into the state-change substrate.

## Permissions, ownership and typestate

Borrowing-permission systems and Mezzo provide strong static authority over aliasing, ownership and typestate changes. Plaid also connects permissions/typestate to changing object states.

These systems demonstrate that authority over mutable objects and state transitions is mature prior art. Patch's capability vocabulary must therefore be described as a different axis of authority: *what semantic delta may be committed to a persistent target*, not who owns/aliases an object or whether a typestate transition is legal.

## Hoare/refinement/dependent verification

HTT, F* and Dijkstra-monad approaches can specify rich state relations with preconditions, postconditions, predicate transformers and weakest preconditions. A bounded increase is therefore not inherently beyond existing verification systems. In expressive systems, a relation equivalent to "new score is at most old score plus 10 and never lower" can be specified or proved.

This is the most important expressibility caveat for Patch:

> **Patch is not claiming a uniquely expressible policy. It is claiming a different factorization and default derivation path.**

Patch deliberately uses a less general semantic-change vocabulary so that the operation/magnitude summary can be inferred from the mutation itself and reused for history, provenance and capability checking without a separate general-purpose specification.

## Program changes, edit transactions and patch theory

COPE, Edit Transactions, higher-order change calculi, self-adjusting computation, edit lenses and patch theory all establish substantial prior art around explicit changes. Their primary changed entities and goals differ: live program edits, incremental recomputation, bidirectional updates, or repository/version-control patches.

These works mean Patch must avoid statements such as "programming with changes is new" or "patches have not been formalized". Patch's target is runtime persistent application state and a mandatory commit route, not source evolution or repository merging.

## Assurance techniques

Translation validation, Proof-Carrying Code, certifying compilation and verified compilers are prior art for connecting unverified producers to independently checked evidence. Patch's generated Lean evidence and runtime correspondence reuse these ideas. They strengthen confidence in the artifact but are supporting assurance, not the primary novelty claim.

## Claim that survives this comparison

A defensible working statement is:

> Patch explores a language architecture in which ordinary post-creation persistent mutation is factored through a structured semantic Change, and operation- and magnitude-aware summaries and authority are derived from that same mandatory mutation substrate. Prior work separately and sometimes jointly provides first-class state transitions, rich effects, quantitative grades, permissions/capabilities, and highly expressive state specifications. Patch does not claim these mechanisms are individually new or inexpressible elsewhere; its candidate contribution is their particular coupling to the sole modeled persistent-mutation route.

The phrase **"sole modeled persistent-mutation route"** is deliberate. It scopes the statement to the Patch formal/implemented mutation model and avoids claims about external I/O, GUI toolkit state, foreign code or unsupported language fragments.

## What remains to establish

This literature pass improves the novelty boundary but does not itself prove publication-level novelty. Remaining work includes:

1. checking additional recent dependent/graded effect work for any system whose *default mutation architecture* more directly matches Patch;
2. turning the comparison dimensions into a concise paper table with precise citations;
3. ensuring every firstness-adjacent sentence in `paper/main.tex` uses the narrower architectural formulation;
4. collecting controlled performance data and a broader externally motivated application corpus;
5. obtaining venue/expert feedback on whether the architectural conjunction is sufficiently distinct and useful.

## Core sources

The repository bibliography contains the exact publication metadata used by the manuscript. Core comparison entries include:

- Sunshine et al., *First-Class State Change in Plaid* (OOPSLA 2011).
- Warth et al., *Worlds: Controlling the Scope of Side Effects* (ECOOP 2011).
- Lucassen and Gifford, *Polymorphic Effect Systems* (POPL 1988).
- Kammar and Plotkin, *Algebraic Foundations for Effect-Dependent Optimisations* (POPL 2012).
- Katsumata, *Parametric Effect Monads and Semantics of Effect Systems* (POPL 2014).
- Gordon, *A Generic Approach to Flow-Sensitive Polymorphic Effects* (ECOOP 2017).
- Brachthaeuser, Schuster and Ostermann, *Effects as Capabilities* (OOPSLA 2020).
- Brachthaeuser et al., *Effects, Capabilities, and Boxes* (OOPSLA 2022).
- Orchard, Liepelt and Eades, *Quantitative Program Reasoning with Graded Modal Types* (ICFP 2019).
- Naden et al., *A Type System for Borrowing Permissions* (POPL 2012).
- Pottier and Protzenko, *Programming with Permissions in Mezzo* (ICFP 2013).
- Nanevski, Morrisett and Birkedal, *Hoare Type Theory, Polymorphism and Separation* (JFP 2008).
- Swamy et al., *Dependent Types and Multi-Monadic Effects in F* (POPL 2016).
- Ahman et al., *Dijkstra Monads for Free* (POPL 2017).
- Mattis, Rein and Hirschfeld, *Edit Transactions* (Programming 2017).
- Cai et al., *A Theory of Changes for Higher-Order Languages* (PLDI 2014).
- Angiuli et al., *Homotopical Patch Theory* (JFP 2016).
- Necula, *Translation Validation for an Optimizing Compiler* (PLDI 2000) and *Proof-Carrying Code* (POPL 1997).

# Patch related-work review

Status: structured literature pass for the Patch research claim at **0.2.0-beta.35 / Change IR 0.10**, including a targeted 2025–2026 follow-up.

This document narrows the candidate contribution rather than trying to maximize novelty. Patch does not claim that semantic effects, quantitative types, permissions, state-transition types, pre/postconditions, patches, provenance, or proof-carrying evidence are individually new. Many prior systems are more expressive than Patch along one or more of those dimensions.

The working contribution hypothesis is architectural:

> **Patch makes a structured semantic Change the mandatory route for ordinary post-creation persistent mutation, then derives operation- and magnitude-aware summaries and authority from that same mutation representation.**

The relevant comparison is therefore not merely whether another formalism *can express* a bounded state relation. It is whether ordinary mutation is *factored through the representation from which that relation and its authority are derived*.

## Review method and scope

This is a structured programming-languages related-work review, not a claim of exhaustive systematic-review coverage. The search and inclusion scope targets mechanisms most likely to subsume or weaken the Patch hypothesis:

1. first-class/reified state change and typestate;
2. classical, algebraic, sequential, graded and dependent effect systems;
3. capabilities, permissions, ownership and typestate permissions;
4. Hoare/refinement/dependent verification of mutable state;
5. source/program change, edit transactions, incremental computation and patch theory;
6. translation validation, proof-carrying code and certifying compilation;
7. provenance/debugging systems where mutation history is reconstructed or queried.

Priority is given to primary papers and author/institution publication pages. The comparison matrix intentionally separates architectural properties from raw expressiveness. A `no` or `partial` cell describes whether the cited mechanism makes that property part of its central/default abstraction; it must not be read as a claim that a sufficiently expressive surrounding language could never encode the property.

## Comparison dimensions

- **Reified unit:** object state transition, effect operation, permission, grade, predicate, edit, or runtime state delta.
- **Mandatory mutation route:** whether ordinary persistent mutation must pass through that representation.
- **Semantic operation:** whether update meaning such as set/increase/decrease/clear belongs to the core abstraction.
- **Magnitude:** whether a quantitative bound is directly represented or inferred.
- **Authority/specification:** whether permission or specification is checked in the same vocabulary.
- **Same substrate:** whether mutation execution and authority derive from the same mandatory state-change representation.
- **Interprocedural composition:** whether summaries/effects/permissions compose through calls.
- **History/provenance reuse:** whether the same runtime mutation representation can directly support history/provenance/undo.

## Comparison matrix

| System/family | Reified unit | Mandatory mutation route | Semantic operation in core abstraction | Quantitative magnitude in core abstraction | Authority/specification | Same substrate for mutation + authority | Main relation to Patch |
|---|---|---:|---:|---:|---:|---:|---|
| Plaid first-class state change | object abstract-state transition | partial | partial | no central magnitude contract | typestate/state permissions | partial | closest classic precedent for first-class state transition |
| Worlds | reified program state/world | no | no | no | scoped side effects | no | reifies and scopes state/effects rather than a semantic-delta authority route |
| Lucassen-Gifford effects | effect/region annotations | no | effect-class level | no | effect typing | no | foundational effect approximation |
| Algebraic effects / effect-dependent optimisations | effect operation symbols | no | yes, effect-operation level | not a state-delta magnitude contract | effect annotations/theories | no | semantic effect operation identity is established prior art |
| Sequential effects / effect quantales | ordered effect elements | no | system-dependent | system-dependent | effect typing | no | order-sensitive and value-dependent effects are established prior art |
| Effekt / Effects-as-Capabilities / System C | capabilities and effect requirements | no | effect/resource level | not the Patch delta-bound default | capabilities/effects | partial | strong precedent for connecting capabilities and effects |
| Graded modal/effect types | grades/resources/effects | no | grade-dependent | yes | graded typing | no | quantitative effect reasoning is established prior art |
| **Dependent effect systems (ESOP 2026)** | value-dependent effect grades | no | effect-language dependent | **yes, may depend on program values** | refinement/effect typing | no | eliminates any broad claim that value-dependent quantitative effects are new |
| Borrowing permissions / Mezzo | access/ownership/aliasing permission | no | access/typestate level | no semantic delta magnitude | permissions | no | strong authority/typestate precedent |
| **Typestate via Revocable Capabilities (PLDI 2026)** | flow-sensitive capability availability / typestate | no | protocol/typestate level | no Patch-style numeric delta bound | capabilities | partial | recent close precedent coupling capability lifecycle to stateful protocols |
| **InvalML invalidation effects (OOPSLA 2025)** | permanent/temporary invalidation effects | no | invalidation state | no Patch-style numeric delta bound | type-and-effect safety | no | recent state-sensitive effects for mutable resources/collections |
| HTT / Hoare-style state specifications | pre/post state predicates | no | arbitrarily specifiable in predicates | expressible | specifications/proofs | no | can express state relations more precisely than Patch |
| F* / Dijkstra monads | predicate transformers / weakest preconditions | no | arbitrarily specifiable | expressible | dependent verification | no | general verification expressiveness is not Patch novelty |
| Edit Transactions / COPE | program edits/change sets | for program edits, not application state | edit-level | not runtime state-delta authority | change management | no | explicit change precedent over program/source evolution |
| Theory of Changes / self-adjusting computation | input/program changes | no | change/increment level | not Patch authority | incremental semantics | no | first-class change for incremental recomputation |
| Homotopical patch theory / edit lenses | repository/edit patches | domain-specific | edit operations | not Patch authority | patch consistency/composition | no | rich formal patch algebra prior art |
| Translation validation / PCC | validation certificate/proof | no | orthogonal | orthogonal | validation/safety proof | no | supporting assurance technique, not Patch novelty |
| Whyline/provenance debugging | causal/provenance relation | no | reconstructed/query-oriented | no | debugging/provenance | no | provenance is prior art; Patch reuses explicit deltas for it |
| **Patch** | semantic runtime state delta (`Change`) | **yes for modeled post-creation persistent mutation** | **yes** | **yes for supported numeric fragment** | **Semantic Change Contracts / capabilities** | **yes by design** | candidate contribution is the conjunction, not an individual column |

## Closest architectural precedents

### Plaid and reified state

Plaid makes state change first-class and models objects as changing abstract state. This blocks any assertion that Patch invented first-class or semantically meaningful state transitions. Patch instead focuses on general modeled persistent data changes, with the normalized operation list reused for execution, signatures, capability checks and history.

### Effects and capabilities

Effects-as-Capabilities and System C directly connect effect reasoning with capabilities. A claim that Patch is novel merely for combining effects and capabilities is therefore indefensible. The surviving hypothesis is structural: semantic authority is derived from the same mandatory `Change` objects through which modeled persistent mutation occurs.

### Quantitative and dependent effects

Graded modal types and related systems already support quantitative program properties. The 2026 indexed-graded-monad framework goes further by providing semantics for dependent effects whose quantitative grades may depend on program values, including cost, probability-bound, expectation-bound and temporal-safety instances.

This closes an important loophole in an earlier Patch framing: even **value-dependent quantitative effects** are not a novelty basis. Patch's narrower quantity is the magnitude of a semantic state delta on a target/operation pair, inferred from the mutation that is actually committed and reused as authority.

### Recent state-sensitive capabilities and effects

PLDI 2026 work on revocable capabilities extends capability mechanisms to flow-sensitive typestate management, allowing functions to provide, revoke and return capabilities as protocols evolve. OOPSLA 2025 InvalML uses a polymorphic type-and-effect system to track permanent and temporary invalidation, including mutable-collection and mutable-state-encapsulation use cases.

These systems are closer to Patch than a simple ownership comparison because they connect state-sensitive reasoning to capabilities/effects. They still target capability lifetime, typestate, invalidation and resource safety rather than making each ordinary persistent update a semantic operation/magnitude delta from which execution, authority and history jointly derive. This distinction should be presented as a current comparison result, not a universal impossibility claim.

## Hoare/refinement/dependent verification

HTT, F* and Dijkstra-monad approaches can specify rich state relations with preconditions, postconditions, predicate transformers and weakest preconditions. A bounded increase is therefore not inherently beyond existing verification systems. In expressive systems, a relation equivalent to "new score is at most old score plus 10 and never lower" can be specified or proved.

> **Patch is not claiming a uniquely expressible policy. It is claiming a different factorization and default derivation path.**

Patch deliberately uses a less general semantic-change vocabulary so that operation/magnitude summaries can be inferred from the mutation itself and reused for history, provenance and capability checking without a separate general-purpose specification.

## Explicit program changes and assurance

COPE, Edit Transactions, higher-order change calculi, self-adjusting computation, edit lenses and patch theory establish substantial prior art around explicit changes. Their primary changed entities and goals differ from Patch's runtime persistent application-state commit route.

Translation validation, Proof-Carrying Code, certifying compilation and verified compilers are prior art for checking evidence produced by unverified components. Patch's Lean evidence and runtime correspondence reuse these ideas as supporting assurance rather than novelty headlines.

## Claim that survives the 2025–2026 follow-up

A defensible working statement is:

> Patch explores a language architecture in which ordinary post-creation persistent mutation is factored through a structured semantic Change, and operation- and magnitude-aware summaries and authority are derived from that same mandatory mutation substrate. Prior work separately and sometimes jointly provides first-class state transitions, rich and value-dependent quantitative effects, flow-sensitive typestate capabilities, permissions, and highly expressive state specifications. Patch does not claim these mechanisms are individually new or inexpressible elsewhere; its candidate contribution is their particular coupling to the sole modeled persistent-mutation route.

The phrase **"sole modeled persistent-mutation route"** scopes the statement to the Patch formal/implemented mutation model and avoids claims about external I/O, GUI toolkit state, foreign code or unsupported language fragments.

## Remaining novelty work

The targeted recent-effect/typestate search is now complete for the current paper iteration. Remaining novelty work is primarily evaluative rather than bibliographic:

1. obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful;
2. collect controlled performance data and a broader externally motivated application corpus;
3. continue normal literature surveillance before submission, especially for new 2026/2027 papers, without representing the current pass as exhaustive.

## Core sources

The repository bibliography contains the exact publication metadata used by the manuscript. Particularly important comparison entries include:

- Sunshine et al., *First-Class State Change in Plaid* (OOPSLA 2011).
- Brachthaeuser, Schuster and Ostermann, *Effects as Capabilities* (OOPSLA 2020).
- Orchard, Liepelt and Eades, *Quantitative Program Reasoning with Graded Modal Types* (ICFP 2019).
- Kura, Gaboardi, Sekiyama and Unno, *A Category-Theoretic Framework for Dependent Effect Systems* (ESOP 2026).
- Jia et al., *Typestate via Revocable Capabilities* (PLDI 2026).
- Gao and Parreaux, *A Lightweight Type-and-Effect System for Invalidation Safety* (OOPSLA 2025).
- Nanevski, Morrisett and Birkedal, *Hoare Type Theory, Polymorphism and Separation* (JFP 2008).
- Swamy et al., *Dependent Types and Multi-Monadic Effects in F* (POPL 2016).
- Ahman et al., *Dijkstra Monads for Free* (POPL 2017).
- Mattis, Rein and Hirschfeld, *Edit Transactions* (Programming 2017).
- Cai et al., *A Theory of Changes for Higher-Order Languages* (PLDI 2014).
- Angiuli et al., *Homotopical Patch Theory* (JFP 2016).
- Necula, *Translation Validation for an Optimizing Compiler* (PLDI 2000) and *Proof-Carrying Code* (POPL 1997).

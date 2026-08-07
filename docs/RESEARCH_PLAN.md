# Research and Evaluation Plan

The paper must distinguish implemented beta facts from research hypotheses. Patch should not be submitted to a high venue until the core formal claim, artifact and evaluation all line up.

## Central research question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent runtime mutation, infer the semantic changes a component may produce, constrain those changes with operation-aware capabilities, and derive useful tooling/security properties without making ordinary programming harder to understand?

## RQ1: Expressiveness and ceremony

Can the change-only mutation model express ordinary imperative and event-driven programs without excessive ceremony?

Implement at least 50 programs in Patch and conventional baselines (primarily Python/JavaScript): counters, collections, todo model, state machines, text adventure, small games, form apps, file-processing tools and browser GUI programs. Measure source lines/tokens, number of state-changing constructs, and helper infrastructure required for undo/history/preview in the baseline.

## RQ2: State-Change Factorization

Does every supported post-creation persistent mutation execute through a semantic change?

Formalize the core language and prove a factorization theorem: if a well-typed source step changes persistent state from `S` to `S'`, execution produces `delta` such that `apply(delta, S) = S'`, and no alternate persistent-assignment path bypasses that mechanism.

This should be machine-checked if feasible (Lean 4 is the preferred first option).

## RQ3: Change Signature soundness

Does the compiler-inferred semantic Change Signature conservatively cover every committed change a recipe can produce in the supported fragment?

Build a labeled corpus containing direct changes, branches, loops, preview-only changes, nested helpers and simple transitive calls. For each recipe compare the inferred effects against the committed changes observed across exhaustive/symbolic test cases where feasible.

The formal target is:

```text
RuntimeChanges(f) subset-of Sig(f)
```

Missing a runtime change is a soundness failure. Over-approximation is allowed but should be measured because excessive imprecision weakens capability usefulness.

## RQ4: Change Capability soundness and usefulness

Can Patch enforce semantic authority such as "this recipe may increase player.score by at most 10" rather than only generic write permission?

The formal target is:

```text
compile(f, Cap(f)) succeeds
  => RuntimeChanges(f) subset-of Cap(f)
```

Evaluate positive/negative cases including:

- bounded score/reward updates;
- balances that may decrease but may never be replaced;
- inventory functions limited to add/remove;
- UI handlers restricted to specific fields;
- plugin-like modules with narrow semantic authority;
- nested helper calls;
- dynamic values that the current compiler must conservatively reject.

Measure accepted safe programs, rejected unsafe programs, and false rejections due to insufficient static information.

## RQ5: Change-law correctness

For the supported fragment, establish and test:

- Mutation Transparency;
- inverse correctness;
- preview equivalence/non-interference;
- deterministic replay consistency;
- composition laws;
- soundness of the cases reported as commuting/non-conflicting.

Property-based/randomized testing should supplement proofs and ordinary examples.

## RQ6: Derived tooling

How much functionality can one normalized Change IR drive without application-specific undo/history/security plumbing?

Evaluate history reconstruction, undo/redo coverage, preview, replay, change inspection, Change Contract display, GUI state refresh, timeline debugging and conflict explanation. Count how much dedicated application code is required in Patch versus baseline implementations.

## RQ7: Comparison with effect/capability systems

Compare Patch against classical effect systems, modern effect-capability systems, typestate/permission systems and ordinary read/write capability models.

Questions include:

- Does Patch infer semantically finer distinctions than read/write for its supported state operations?
- Is an operation distinction such as `increase` versus `set` practically useful?
- How much precision is lost without a richer type/range system?
- Can equivalent policies be expressed in baseline systems, and at what annotation/implementation cost?

This RQ is essential to avoid presenting existing effect/capability ideas as new.

## RQ8: Novice comprehension

Do beginners understand state evolution and semantic permissions with Patch's vocabulary?

Use a randomized/counterbalanced controlled study. Tasks should include predicting final values, identifying which operations mutated state, changing behavior, undoing a requested transition, explaining mutation bugs, and identifying why a semantic capability rejects a change.

The capability layer should be tested separately from basic Patch syntax so advanced policy features do not contaminate the core novice comparison.

Measure correctness, completion time, edit/error count, confidence and an appropriate cognitive-load measure. Pre-register hypotheses, exclusions, sample-size rationale and analysis before data collection.

## RQ9: Performance

Measure the overhead of semantic-change execution and compile-time analysis.

Separate:

1. runtime change construction/history overhead;
2. Change Signature inference and capability validation time;
3. JavaScript interpreter beta;
4. direct Change IR / WebAssembly backend;
5. later native/AOT host packaging.

Do not treat interpreter performance as the language's performance ceiling.

## RQ10: GUI and cross-platform artifact

Can the same Patch source, Change IR and semantic policy model support console and GUI applications across browser and desktop targets without exposing platform APIs in ordinary code?

The artifact evaluation should include browser/PWA execution, Windows/macOS/Linux CI, portable `.patchapp`, WebAssembly, at least one native GUI host before a systems-heavy submission claim, and reproducible builds from Patch Studio and CLI.

## RQ11: Related-work falsification

Before submission, systematically test the novelty claim against:

- Plaid and typestate-oriented programming;
- Worlds / reified program state;
- classical type-and-effect systems;
- Effects as Capabilities / Effekt and related capability/effect systems;
- ownership/permission/capability type systems;
- behavioral/session/update-effect systems;
- ChEOPS, COPE, Changeboxes and Edit Transactions;
- edit lenses and change structures;
- event sourcing and reducer architectures;
- reversible programming, CRDTs and live-programming systems.

The paper should explicitly explain which part of Patch is genuinely different and which part is recombination/application of prior ideas.

## Artifact milestones

### 0.1 complete

Parser/interpreter, semantic change records, inversion, history, preview, conflict helper, examples, cross-platform tests and initial design manuscript.

### 0.2 beta.2 current

- compiler front end and Change IR;
- semantic Change Signature inference;
- optional Change Capability policies with numeric bounds;
- simple transitive recipe analysis;
- `patch changes` CLI;
- Change Contract view in Patch Studio;
- portable `.patchapp` and bootstrap `.wasm`;
- Patch Studio PWA / iPhone-responsive IDE;
- first GUI language/Designer slice;
- deterministic public-site build and CI validation.

### 0.3 next

- typed AST and richer expression IR;
- range analysis for proving bounded dynamic changes;
- fixed-point/recursive call graph analysis;
- richer capability policy composition;
- causal `why` prototype;
- full visual form designer/property editor;
- persistent project files/import-export;
- serialized `.patchlog` and explicit replay;
- immediate mode / timeline debugger;
- randomized change-algebra and capability tests.

### 0.4 compiler backend

- direct Change IR-to-WebAssembly lowering;
- preserve/verifiably export semantic change evidence;
- WASI-facing console runtime;
- runnable `.patchapp` host;
- benchmark harness;
- first native host proof of concept.

### Research-complete milestone

- systematic literature review;
- machine-checked State-Change Factorization;
- machine-checked Change Signature soundness;
- machine-checked Change Capability soundness for a useful core;
- benchmark/security corpus and reproducibility bundle;
- controlled novice study if retained;
- artifact documentation sufficient for external reproduction.

## High-venue gate

A top PL submission should not be attempted merely because Patch Studio looks polished. Before aiming at OOPSLA/PLDI/ICFP-level review, the project should have at least:

1. a crisp formal contribution beyond terminology;
2. mechanized or otherwise unusually rigorous correctness evidence;
3. a substantial working compiler/runtime artifact;
4. evaluation isolating the benefit of semantic Change IR and Change Contracts over ordinary mutation plus logging/effect annotations;
5. explicit comparison to the closest effect/capability and state-transition systems;
6. no unsupported "first" claims.

If the formal/compiler/security contribution is strongest, pursue a PL venue. If the controlled-user-study contribution is strongest, a PL/HCI or top computing-education/HCI framing may be more defensible. Venue selection should follow the evidence rather than precede it.

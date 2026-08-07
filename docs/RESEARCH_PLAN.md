# Research and Evaluation Plan

The paper must distinguish implemented beta facts from research hypotheses. Patch should not be submitted to a high venue until the core formal claim, artifact and evaluation all line up.

## Central research question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent runtime mutation, compile those changes into a reusable Change IR, and derive strong tooling properties without making ordinary programming harder to understand?

## RQ1: Expressiveness and ceremony

Can the change-only mutation model express ordinary imperative and event-driven programs without excessive ceremony?

Implement at least 50 programs in Patch and conventional baselines (primarily Python/JavaScript): counters, collections, todo model, state machines, text adventure, small games, form apps, file-processing tools and browser GUI programs. Measure source lines/tokens, number of state-changing constructs, and helper infrastructure required for undo/history/preview in the baseline.

## RQ2: State-Change Factorization

Does every supported post-creation persistent mutation execute through a semantic change?

Formalize the core language and prove a factorization theorem: if a well-typed source step changes persistent state from `S` to `S'`, execution produces `delta` such that `apply(delta, S) = S'`, and no alternate persistent-assignment path bypasses that mechanism.

This should be machine-checked if feasible (Lean 4 is the preferred first option).

## RQ3: Change-law correctness

For the supported fragment, establish and test:

- Mutation Transparency;
- inverse correctness;
- preview equivalence;
- deterministic replay consistency;
- composition laws;
- soundness of the cases reported as commuting/non-conflicting.

Property-based/randomized testing should supplement proofs and ordinary examples.

## RQ4: Derived tooling

How much functionality can one normalized Change IR drive without application-specific undo/history plumbing?

Evaluate history reconstruction, undo/redo coverage, preview, replay, change inspection, GUI state refresh, timeline debugging and conflict explanation. Count how much dedicated application code is required in Patch versus baseline implementations.

## RQ5: Novice comprehension

Do beginners understand state evolution better with explicit `change` blocks than with conventional mutable syntax?

Use a randomized/counterbalanced controlled study. Tasks should include predicting final values, identifying which operations mutated state, changing behavior, undoing a requested transition, explaining mutation bugs, and tracing list/object/GUI state updates.

Measure correctness, completion time, edit/error count, confidence and an appropriate cognitive-load measure. Pre-register hypotheses, exclusions, sample-size rationale and analysis before data collection.

## RQ6: Performance

Measure the overhead of semantic-change execution on numeric loops, list operations, object-field updates, GUI event loops and different history/inverse settings.

Separate three stages clearly:

1. JavaScript interpreter beta;
2. compiled Change IR / WebAssembly backend;
3. later native/AOT host packaging.

Do not treat interpreter performance as the language's performance ceiling.

## RQ7: GUI and cross-platform artifact

Can the same Patch source and Change IR support console and GUI applications across browser and desktop targets without exposing platform APIs in ordinary code?

The artifact evaluation should include:

- browser/PWA execution;
- Windows/macOS/Linux CI;
- portable `.patchapp` bundles;
- WebAssembly backend once implemented;
- at least one native GUI host before a systems-heavy submission claim;
- reproducible builds from Patch Studio and CLI.

## RQ8: Related-work falsification

Before submission, systematically test the novelty claim against change-oriented programming/source-evolution systems (ChEOPS, COPE, Changeboxes, Edit Transactions), edit lenses, change structures, event sourcing, reducer architectures, reversible programming, CRDTs and live-programming systems.

The paper should explicitly explain why Patch's runtime-state Change IR is or is not semantically distinct from each family.

## Artifact milestones

### 0.1 complete

Parser/interpreter, semantic change records, inversion, history, preview, conflict helper, examples, cross-platform tests and initial design manuscript.

### 0.2 current

- compiler front end;
- normalized Change IR;
- portable `.patchapp` bundles;
- Patch Studio PWA;
- iPhone/iPad-responsive IDE;
- first GUI language slice and live preview;
- deterministic public-site build and CI validation.

### 0.3 next

- visual form designer and property editor;
- persistent project files and import/export;
- richer Patch UI controls and two-way input binding;
- source spans in Change IR;
- serialized `.patchlog` and explicit replay;
- immediate mode / live change console;
- timeline/change debugger;
- randomized change-algebra tests.

### 0.4 compiler backend

- typed AST;
- WebAssembly backend;
- WASI-facing console runtime;
- runnable `.patchapp` host;
- benchmark harness;
- first native host proof of concept.

### 0.5 native application artifact

- Windows console + GUI packaging;
- macOS CLI + `.app` packaging;
- Linux native host;
- BSD/Unix portability path;
- remote `Build for...` matrix;
- signing/notarization documentation where platform rules require it.

### Research-complete milestone

- systematic literature review;
- machine-checked core theorem(s);
- benchmark corpus and reproducibility bundle;
- full change-law test suite;
- controlled novice study if retained in the paper;
- artifact documentation sufficient for external reproduction.

## High-venue gate

A top PL submission should not be attempted merely because Patch Studio looks polished. Before aiming at OOPSLA/PLDI/ICFP-level review, the project should have at least:

1. a crisp formal contribution beyond terminology;
2. mechanized or otherwise unusually rigorous correctness evidence;
3. a substantial working compiler/runtime artifact;
4. evaluation that isolates the benefit of Change IR over ordinary mutation plus logging;
5. explicit comparison to the closest change-oriented/live-programming systems;
6. no unsupported "first" claims.

If the formal/compiler contribution is strongest, pursue a PL venue. If the controlled-user-study contribution is strongest, a PL/HCI or top computing-education/HCI framing may be more defensible. Venue selection should follow the evidence rather than precede it.

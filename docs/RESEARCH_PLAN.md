# Research and Evaluation Plan

The paper must distinguish implemented beta facts from research hypotheses.

## RQ1: Expressiveness

Can the change-only mutation model express ordinary small imperative programs without excessive ceremony?

Implement 30-50 programs in Patch and a Python/JavaScript baseline: counters, list management, todo model, text adventure, small game, inventory system, state machine, and browser app. Measure source lines, tokens, explicit state-changing constructs, and helper infrastructure required for undo/history in the baseline.

## RQ2: Mutation Transparency

Does the runtime capture every intended persistent mutation in the supported language fragment?

Generate a conformance suite exercising each mutable operation under direct sequence, `if`, `repeat`, recipe calls, and preview. Check that every post-creation state difference corresponds to a committed semantic change record, while previewed changes do not alter committed history.

## RQ3: Derived tooling

How much functionality can be derived from one normalized change representation?

Evaluate undo/redo coverage, inverse generation, deterministic replay, preview correctness, history reconstruction, and conflict classification. Unsupported/noninvertible cases must be reported rather than hidden.

## RQ4: Novice comprehension

Do beginners understand state evolution better with explicit `change` blocks than with conventional mutable syntax?

Use a randomized/counterbalanced controlled study. Tasks: predict final values, identify what changed, modify behavior, undo a requested transition, explain mutation bugs, and trace list/object updates.

Measure correctness, completion time, edit/error count, confidence, and an appropriate cognitive-load measure. Pre-register hypotheses and exclusions before data collection.

## RQ5: Performance

Measure semantic-change recording overhead on numeric loops, list operations, object field updates, and history/inverse settings. Compare the interpreter to equivalent JavaScript. Later compare a Patch Wasm compiler separately rather than treating interpreter speed as the language's performance ceiling.

## RQ6: Conflict analysis

Use a manually labeled corpus of paired changes: independent field writes, commuting numeric additions, competing sets, list edits, and nested records. Measure soundness and conservatism of semantic conflict detection.

## Artifact milestones

### Beta 0.1

Parser/interpreter, semantic changes, inversion, history, preview, conflict helper, browser playground, cross-platform CI, and design paper.

### Beta 0.2

Serialized `.patchlog` histories, explicit replay, source spans in change records, better diagnostics, first-class advanced change values, and property-based tests.

### Beta 0.3

Typed AST, richer schemas/collections, change-algebra law tests, and conflict explanations.

### Compiler 0.4

Rust compiler, Change IR, and WebAssembly/WASI target for browser and Windows/macOS/Linux.

## Publication strategy

If formal semantics/compiler results are strongest, target a PL-oriented story. If novice results are strongest, target PL/HCI or computing education. Do not select a venue until the data shows which contribution is strongest.

# Internal peer-review rounds

This file records four internal review passes over the SCP-oriented manuscript. The purpose is to preserve reviewer objections and distinguish adopted changes from suggestions that would overstate the evidence.

## Round 1 — Programming Languages / Formal Methods

### Major comment 1: Factorization risks sounding deeper than it is

**Concern.** `stateChangeFactorization` is a genuine Lean theorem, but the modeled `Step` relation has one state-changing constructor whose result is `commitUnchecked d m`. The theorem is therefore a mechanized design invariant proved largely by construction. Presenting it as if Lean discovered a non-obvious semantic fact invites a reviewer to call the result tautological.

**Decision: adopt.** The manuscript says explicitly that State-Change Factorization is by construction in the current core machine. Its scientific role is to make the architectural restriction precise and machine-checked; the non-trivial assurance story is the reuse of that representation for signatures/capabilities, ranges, finite calls, and accepted-evidence runtime correspondence.

### Major comment 2: RQ answers should appear near the evidence

**Concern.** The introduction states four RQs, but most answers were delayed until the conclusion.

**Decision: adopt.** Concise answer paragraphs are placed near the corresponding factorization, formal/runtime, and authority evidence.

### Major comment 3: distinguish theorem from producer correctness

**Concern.** The runtime-frame theorem is conditional on accepted independently reconstructed evidence. A reader may otherwise infer that the validator, capture path, or Wasm lowering is verified.

**Decision: adopt.** `Accepted evidence` remains explicit in the theorem statement and the proof-free producer boundary is repeated immediately afterward.

## Round 2 — Systems / Artifact / Evaluation

### Major comment 1: target-only comparison is an ablation, not a competitive baseline

**Concern.** A target-only write model is intentionally coarse and is not representative of modern effect, capability, refinement, or dependent systems. Calling it a baseline could imply an empirical superiority claim that the experiment does not support.

**Decision: adopt.** Use `target-only ablation` consistently. The result is a mechanism-isolation result: when operation and magnitude information are removed, four controlled distinctions disappear.

### Major comment 2: application evidence is internally authored

**Concern.** Checkout/loyalty and usage/quota demonstrate multi-domain behavior, but they do not establish third-party adoption, ecosystem compatibility, or external validity.

**Decision: keep limitation; do not fabricate external evidence.** A genuine third-party case remains desirable. A synthetic or author-created case relabelled as `external` would weaken the paper rather than strengthen it.

### Major comment 3: no performance numbers means no performance claim

**Concern.** The repository has a careful fixed-machine protocol but no reviewed controlled dataset.

**Decision: adopt/retain.** Do not insert CI timings or development timings into the paper. The protocol is reproducibility infrastructure, not a result. Performance remains explicitly outside the current claim surface.

## Round 3 — Journal editor / novelty / presentation

### Major comment 1: use the Elsevier article structure

**Concern.** The working `article` class is adequate for drafting but not the cleanest submission package for an Elsevier journal.

**Decision: adopt.** The manuscript uses `elsarticle`, journal front matter, keywords, and an Elsevier-compatible bibliography style. Submission files are kept flat for Editorial Manager compatibility.

### Major comment 2: recent adjacent work should include reversibility and event-sourced histories

**Concern.** The paper discusses undo/history/provenance, but related work focused mainly on effects, permissions, explicit program edits, and assurance. Reversible languages and event-sourced state histories are obvious reviewer comparisons.

**Decision: adopt.** Add scoped discussion and references. Patch does not claim reversible semantics; it records semantic deltas/history. Event sourcing already makes state-changing operations authoritative history; Patch's proposed distinction is a language-level modeled mutation route coupled to operation/magnitude authority and formal analysis.

### Major comment 3: abstract should report results, not development chronology

**Concern.** Release/beta milestones obscure the contribution and make the work look like a project report.

**Decision: adopt.** The abstract is centered on the mutation architecture, formal evidence, runtime bridge, and authority ablation.

## Round 4 — Skeptical SCP reviewer / central-claim stress test

### Major comment 1: the ablation demonstrates semantic precision, but not automatically the value of the architectural coupling

**Concern.** Rejecting four cases after preserving operation/magnitude information shows that richer semantic authority is useful. It does not, by itself, establish that making semantic Change the mandatory mutation substrate is better than deriving equivalent information from a conventional mutation language with separate analyses.

**Decision: adopt and narrow.** The manuscript should not treat the ablation as proof that mandatory factorization is superior. Add an explicit substrate-reuse audit showing what the current artifact actually reuses: `change` syntax lowers to `CHANGE` IR; `change-analysis.js` derives signatures/capability checks from change nodes; `interpreter.js` turns the same source-level operations into normalized runtime Change records consumed by commit/history/undo/provenance. Phrase this as implementation evidence for architectural coupling, not a comparative superiority experiment.

### Major comment 2: `same substrate` is ambiguous

**Concern.** A reviewer could read `same substrate` as claiming that compile-time analysis, Lean evidence, and runtime tools literally consume one identical serialized object. They do not: compile-time analyses and runtime records are different representations connected through the mandatory semantic mutation vocabulary.

**Decision: adopt.** Define the phrase explicitly. `Same substrate` means one mandatory language-level semantic mutation route and semantic vocabulary from which compile-time and runtime representations are derived; it does **not** mean one shared heap object or one fully verified serialization pipeline.

### Major comment 3: `persistent state` may be misread as durable storage

**Concern.** In systems literature, persistent state often means disk/database durability or state surviving process restarts. Patch currently means language-level application state that persists across statements/events within execution, contrasted with transient event/UI values.

**Decision: adopt.** Define the term near its first use and state that durability across process restarts is not implied.

### Major comment 4: remove unsupported usability claims

**Concern.** Phrases such as `a beginner can ignore...` or `beginner-facing syntax` imply a usability result without a user study.

**Decision: adopt.** Replace them with descriptive claims such as `surface programs can omit...` and `compact source-level mutation syntax`. The paper has no human-subject/usability evaluation and should not imply one.

### Major comment 5: modern effect/capability work further weakens any expressiveness-based novelty argument

**Concern.** Recent work continues to sharpen the semantics and expressiveness of effect/capability systems, including current OOPSLA work comparing type, ability, and effect disciplines. A reviewer may reject any residual suggestion that Patch is novel because its policies are uniquely expressive.

**Decision: already aligned.** Keep the novelty claim architectural and explicitly non-subsumptive. No new comparative theorem is claimed without implementing and formally comparing against those systems.

## Suggestions deliberately not adopted

- **Claim the factorization theorem as deep semantic novelty:** rejected; it is a by-construction invariant.
- **Compare Patch directly against a named modern capability/effect system without implementing that system:** rejected; the current experiment cannot support such a comparison.
- **Use hosted GitHub Actions timing as performance evidence:** rejected; hardware/load are heterogeneous and the repository already prevents this relabelling.
- **Describe an internally authored example as third-party validation:** rejected.
- **Claim a fully verified compiler from generated Lean certificates:** rejected; runtime capture, validators, parser/lowering portions, and the Wasm engine remain outside the proof.
- **Claim the authority ablation proves mandatory factorization is superior to conventional mutation architectures:** rejected; it proves only the controlled semantic distinctions stated in the experiment.

## Current review disposition

After four rounds, the manuscript remains suitable for preparation as an SCP Research Paper, most naturally positioned between **Experimental Software Technology** and **Formal Techniques**. The central claim is now best understood as a language-architecture contribution supported by (1) a machine-checked design invariant, (2) non-trivial scoped formal results built on that invariant, (3) a runtime-correspondence bridge with explicit trust boundaries, (4) an authority ablation, and (5) artifact-level evidence that multiple facilities derive from the mandatory semantic mutation route.

The strongest remaining optional evidence is still a genuine external integration and a controlled fixed-machine assurance-cost dataset. A direct comparison against a named modern effect/capability system would also be valuable, but only if implemented or formalized fairly rather than asserted rhetorically.

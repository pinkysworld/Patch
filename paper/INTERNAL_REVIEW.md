# Internal peer-review rounds

This file records three internal review passes over the SCP-oriented manuscript. The purpose is to preserve reviewer objections and distinguish adopted changes from suggestions that would overstate the evidence.

## Round 1 — Programming Languages / Formal Methods

### Major comment 1: Factorization risks sounding deeper than it is

**Concern.** `stateChangeFactorization` is a genuine Lean theorem, but the modeled `Step` relation has one state-changing constructor whose result is `commitUnchecked d m`. The theorem is therefore a mechanized design invariant proved largely by construction. Presenting it as if Lean discovered a non-obvious semantic fact invites a reviewer to call the result tautological.

**Decision: adopt.** The manuscript should say explicitly that State-Change Factorization is by construction in the current core machine. Its scientific role is to make the architectural restriction precise and machine-checked; the non-trivial assurance story is the reuse of that representation for signatures/capabilities, ranges, finite calls, and accepted-evidence runtime correspondence.

### Major comment 2: RQ answers should appear near the evidence

**Concern.** The introduction states four RQs, but most answers are delayed until the conclusion.

**Decision: adopt.** Add concise answer paragraphs after the factorization section and after the formal/runtime trust-boundary section.

### Major comment 3: distinguish theorem from producer correctness

**Concern.** The runtime-frame theorem is conditional on accepted independently reconstructed evidence. A reader may otherwise infer that the validator, capture path, or Wasm lowering is verified.

**Decision: already addressed, strengthen wording.** Keep `accepted evidence` in the theorem statement and repeat the proof-free producer boundary immediately after it.

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

**Decision: adopt.** Prepare the manuscript with `elsarticle`, journal front matter, keywords, and an Elsevier-compatible bibliography style. Keep all files at one folder level for Editorial Manager compatibility.

### Major comment 2: recent adjacent work should include reversibility and event-sourced histories

**Concern.** The paper discusses undo/history/provenance, but related work focuses mainly on effects, permissions, explicit program edits, and assurance. Reversible languages and event-sourced state histories are obvious reviewer comparisons.

**Decision: adopt.** Add scoped discussion and references. Patch does not claim reversible semantics; it records semantic deltas/history. Event sourcing already makes state-changing operations authoritative history; Patch's proposed distinction is a language-level modeled mutation route coupled to operation/magnitude authority and formal analysis.

### Major comment 3: abstract should report results, not development chronology

**Concern.** Release/beta milestones obscure the contribution and make the work look like a project report.

**Decision: adopted in the journal branch.** Keep the abstract centered on the mutation architecture, formal evidence, runtime bridge, and authority ablation.

## Suggestions deliberately not adopted

- **Claim the factorization theorem as deep semantic novelty:** rejected; it is a by-construction invariant.
- **Compare Patch directly against a named modern capability/effect system without implementing that system:** rejected; the current experiment cannot support such a comparison.
- **Use hosted GitHub Actions timing as performance evidence:** rejected; hardware/load are heterogeneous and the repository already prevents this relabelling.
- **Describe an internally authored example as third-party validation:** rejected.
- **Claim a fully verified compiler from generated Lean certificates:** rejected; runtime capture, validators, parser/lowering portions, and the Wasm engine remain outside the proof.

## Current review disposition

The manuscript is suitable for continued preparation as an SCP Research Paper, most naturally positioned between **Experimental Software Technology** and **Formal Techniques**. The strongest remaining optional evidence is a genuine external integration and a controlled fixed-machine assurance-cost dataset. Neither should be invented or substituted with weaker evidence merely to make the manuscript appear complete.

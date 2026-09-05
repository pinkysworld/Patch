# Internal peer review: Round 8

Date: 2026-08-30

Manuscript: **Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

Review role: skeptical journal reviewer focused on formal-methods narrative, research-question closure, and submission readability.

This is an internal adversarial review, not external peer review.

## Overall verdict

**Promising and substantially clearer, but the strongest submission version is the smaller one.** The manuscript has enough technical material to become difficult to follow if every implementation milestone is narrated chronologically. The contribution is strongest when the reader sees one architectural thesis, four evidence questions, and explicit claim boundaries.

## Major concern 1: the formal section reads too much like release history

The previous formal-assurance narrative described beta.28, beta.29, beta.30, beta.31, and beta.32 in sequence. Although technically accurate, this made the manuscript read partly like an engineering changelog. A reviewer primarily needs to know what is proved now, what evidence connects the production path to the proved fragment, and what remains trusted.

### Recommendation

Organize the assurance story by proof obligation rather than by implementation chronology:

1. semantic Change machine;
2. signature/capability and range reasoning;
3. finite exact call-tree composition;
4. selected production direct-WebAssembly correspondence;
5. exact trust boundary.

Retain beta.32 only where the version identifier helps identify the concrete artifact boundary.

### Disposition: accepted and implemented

The formal section now follows those assurance layers. Intermediate beta history and several implementation-specific Lean module names were removed from the submission-facing narrative. The theorem labels and theorem meanings were preserved. No theorem was widened.

## Major concern 2: the research questions are introduced but not explicitly answered

The Introduction states four useful research questions, but previously the reader had to reconstruct the answer to each one across formal sections, evaluation tables, the public-code stress test, limitations, and conclusion. This weakens the empirical narrative even when the evidence itself is present.

### Recommendation

Add a short research-question closure immediately after the evaluation. Each answer should state both the result and its boundary.

### Disposition: accepted and implemented

The Evaluation section now ends with explicit answers:

- **RQ1:** supported for the modeled fragment, not arbitrary foreign/product state;
- **RQ2:** semantic operation and magnitude add precision over the paper's target-only ablation in the tested cases;
- **RQ3:** selected direct-WebAssembly executions are related to exact formal call-tree effects under the stated accepted-evidence trust boundary;
- **RQ4:** the public-code corpus shows partial representational fit while exposing host-persistence ownership and multi-target atomicity boundaries.

The text explicitly warns against reusing evidence for one RQ to imply stronger claims for another.

## Major concern 3: formal detail and evaluation should have different rhetorical roles

The formal development establishes scoped semantic properties. The semantic-authority cases test usefulness of the authority dimensions. The public-code stress test tests representational plausibility and boundaries. Mixing these into one undifferentiated validation claim would overstate the evidence.

### Recommendation

Keep the evidence types separate and align each one with an RQ.

### Disposition: accepted

The manuscript now presents formal assurance, controlled authority evaluation, production correspondence, and public-code mutation-shape evidence as distinct forms of evidence.

## Minor concern 1: duplicate assurance tables

The previous manuscript had both a theorem table and a separate trust-boundary table with overlapping information.

### Disposition: accepted

They were replaced by one compact assurance-summary table with layer, established statement, and boundary.

## Minor concern 2: product and measurement material competes with the research narrative

Product GUI/native details and an unclaimed performance protocol are useful artifact information but should not read like additional contributions.

### Disposition: accepted

They are now compressed into **Reproducibility and Artifact Boundary**. The manuscript continues to make no performance or scalability claim.

## Claim-scope check

The revision does **not** add Relational ChangeSets, least-authority inference, certified host adapters, temporal authority, ChangeLens, or safe parallelism to Paper 1. Those remain follow-on work. The beta.32 theorem boundary is unchanged.

## Reviewer-style final assessment

The revised paper is easier to evaluate because its logic is now explicit:

**architecture -> formal properties -> production correspondence -> authority evaluation -> public-code stress test -> bounded answers to RQ1-RQ4.**

The main remaining weakness is external validation depth, not internal narrative structure. A genuine third-party migration/integration study could strengthen future evidence, but it should not be added merely to enlarge Paper 1 before submission. The current paper is more credible when it states that limitation directly.

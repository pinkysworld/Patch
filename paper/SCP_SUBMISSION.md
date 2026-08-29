# Science of Computer Programming submission notes

## Proposed article positioning

**Target:** Science of Computer Programming (SCP), Research Papers track

**Best fit:** Experimental Software Technology, with substantial Formal Techniques content

**Working title:**

> Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs

**Core one-sentence contribution:**

> Patch makes a structured semantic Change the mandatory modeled route for post-creation persistent mutation and derives operation- and magnitude-aware authority, provenance and assurance from that same representation.

## Candidate abstract message

The abstract in `main.tex` is written around four points:

1. ordinary mutable programs often reconstruct semantic meaning around writes;
2. Patch instead factors persistent mutation through structured Changes;
3. formal and runtime evidence establish scoped properties without claiming a fully verified compiler;
4. controlled semantic-authority cases demonstrate distinctions over a deliberately coarse target-only write-authority ablation.

Do not broaden this into a claim that Patch invents effects, capabilities, quantitative reasoning, first-class state changes or bounded state specifications.

## Candidate highlights

Keep these concise if the submission system asks for highlights:

- Persistent mutation is factored through explicit semantic Change objects.
- Change Contracts distinguish target, operation and bounded numeric magnitude.
- Lean proves scoped signature, policy, range and finite call-tree properties.
- Runtime evidence connects selected direct-Wasm executions to formal call trees.
- Authority cases expose distinctions hidden by target-only write permission.

## Suggested classification / keywords

- Programming language design
- Mutable state
- Effect systems
- Capabilities and permissions
- Formal verification
- WebAssembly
- Program provenance
- Programming environments

## What is an actual result

The current manuscript may claim the implemented/mechanized results already present in the repository, including:

- State-Change Factorization and Mutation Transparency in the modeled machine;
- signature/capability and integer-range theorems for explicit Lean fragments;
- finite transitive exact call-tree refinement for the encoded fragment;
- accepted-evidence runtime-frame correspondence for selected direct-Wasm executions;
- reconstruction of repeated-identical and mixed-guard dynamic invocation frames;
- the eight-case semantic-authority decision matrix;
- safe execution and controlled escalation behavior in checkout/loyalty and usage/quota cases;
- commit-bound reproducibility packaging.

## What must not be presented as an existing result

Do not claim:

- end-to-end compiler verification;
- validator or runtime-capture completeness;
- complete parser/lowering correctness;
- complete sandboxing;
- third-party ecosystem validation;
- performance overhead, scalability or asymptotic behavior without a reviewed `controlled` dataset;
- novelty merely from effects, capabilities, magnitude bounds, call frames, translation validation or proof-carrying evidence.

## Reproducibility package

The submission should point reviewers to a frozen release/commit rather than a moving default branch. Before actual submission:

1. choose the exact source commit;
2. run the formal/runtime/security/application checks;
3. regenerate and verify the reproducibility bundle;
4. create a tagged artifact release or archival snapshot;
5. record the immutable artifact identifier in the manuscript or submission metadata if permitted by review policy.

Core commands:

```bash
npm test
npm run transitive-runtime-certify:mixed-guards
npm run evaluate:security
npm run evaluate:checkout-extension
npm run evaluate:quota-extension
npm run bundle:reproducibility
npm run verify:reproducibility
```

## Final reviewer-style checks

Before submission, answer these questions from the manuscript alone:

- Is the distinction between expressibility and mutation architecture unmistakable?
- Is it clear why operation/magnitude authority follows naturally from the Change representation?
- Does every theorem state its fragment and trust boundary?
- Are the runtime claims phrased as consequences of accepted evidence rather than full compiler correctness?
- Does the evaluation support the architectural claim rather than imply a comparison with all prior effect/capability systems?
- Are internally authored application cases clearly distinguished from external validation?
- Are all version numbers that matter for reproduction captured in the frozen artifact rather than cluttering the research narrative?

## Remaining optional strengthening work

Two additions would materially strengthen the paper but are not silently assumed to exist:

- a genuinely external/third-party integration case;
- controlled fixed-machine assurance-cost measurements with raw samples, dispersion and a reviewed analysis.

If either is added, update the abstract, evaluation, threats to validity and conclusion together so the claim surface remains synchronized.

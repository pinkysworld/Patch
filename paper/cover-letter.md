Dear Editors of Science of Computer Programming,

Please consider the manuscript **“Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs”** for the Research Papers track of *Science of Computer Programming*. We believe the manuscript fits especially well within Experimental Software Technology, with substantial Formal Techniques content, because it combines a programming-language design, a production implementation path, mechanized formal results, and an artifact evaluation.

The paper investigates a deliberately narrow architectural question: what follows if ordinary modeled post-creation persistent mutation is forced through a structured semantic Change representation rather than treating semantic meaning as metadata reconstructed around ordinary writes? Patch derives operation- and magnitude-aware Semantic Change Signatures and optional Change Capabilities from that same mandatory representation, while history, provenance, and assurance reuse the same semantic substrate.

The formal contribution is explicitly scoped. A Lean 4 development mechanizes State-Change Factorization as a by-construction design invariant and proves signature/policy, integer-range, finite ranked-call, guarded-trace, and finite transitive call-tree properties for explicit fragments. The implementation connects selected production direct-WebAssembly executions to exact formal call-tree witnesses through independently reconstructed semantic effects and invocation frames plus generated Lean-checkable evidence. We do not claim an end-to-end verified compiler: runtime capture, validator correctness, unsupported parser fragments, lowering, and the WebAssembly engine remain named trust boundaries.

The evaluation contains an eight-case semantic-authority ablation and two larger application cases. The ablation deliberately removes operation and magnitude information while retaining reachable write targets; four controlled distinctions then disappear that Patch rejects because of operation direction, magnitude, transitive magnitude, or unproved magnitude. The paper does not present this ablation as a competitive baseline against modern effect or capability systems and does not claim unique expressibility.

The repository contains a commit-bound reproducibility workflow for the formal, runtime, and application evidence. The manuscript reports no controlled performance result and makes no performance or scalability claim.

**Affiliation:** University of the People.

**Funding:** This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.

**Declaration of competing interests:** The author declares no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

This manuscript is original work and is not being presented as previously published conference proceedings. Any required declaration concerning concurrent submission should be confirmed from the author's status at the time of submission rather than inferred in advance.

Thank you for considering the manuscript.

Sincerely,

Michél Nguyen
University of the People

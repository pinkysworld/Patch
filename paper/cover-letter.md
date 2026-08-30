Dear Editors of Science of Computer Programming,

Please consider the manuscript **“Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs”** for the Research Papers track of *Science of Computer Programming*. The manuscript is being prepared specifically as a journal article for *Science of Computer Programming*, with its closest fit in Experimental Software Technology and substantial Formal Techniques content. It combines programming-language design, a production implementation path, mechanized formal results, and a reproducible artifact evaluation.

The paper investigates a deliberately narrow architectural question: what follows if modeled post-creation application-state mutation is routed through structured semantic Changes rather than ordinary reassignment? Patch derives operation- and magnitude-aware Change Signatures and optional Change Capabilities along that mandatory semantic mutation lineage, while history, provenance, policy checks, and assurance reuse the same mutation semantics.

The principal formal contribution directly connects the mutation machine to the contract vocabulary. For a supported singleton numeric fragment, a Lean 4 bridge derives a directional contract-level Effect from a well-formed committed Change and proves that the effect magnitude equals the actual before/after state delta. If a bounded capability rule allows that effect, the actual committed magnitude lies within the permitted interval. Bounded rules also reject unknown magnitude in both the relational semantics and the verified executable checker. Additional mechanized results cover normalized signature/policy composition, integer ranges, finite ranked and exact calls, guarded traces, finite transitive call trees, and selected runtime-evidence refinement.

The implementation connects selected production direct-WebAssembly executions to exact formal call-tree witnesses through independently reconstructed semantic effects and invocation frames plus generated Lean-checkable evidence. We do not claim an end-to-end verified compiler: source-to-effect extraction, runtime capture, validator correctness, unsupported parser fragments, lowering, and the WebAssembly engine remain explicit trust boundaries.

The evaluation contains an eight-case mechanism-isolation study and two larger application cases. The ablation deliberately removes operation and magnitude information while retaining reachable write targets; four controlled distinctions then disappear that Patch rejects because of operation direction, magnitude, transitive magnitude, or unproved magnitude. The paper does not present this ablation as a competitive baseline against modern effect or capability systems and does not claim unique expressibility or ecological prevalence.

The repository contains commit-bound formal, runtime, application, and reproducibility workflows. The manuscript reports no controlled performance result and makes no performance or scalability claim.

**Affiliation:** University of the People.

**Funding:** This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.

**Declaration of competing interests:** The author declares no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

The intended submission route for this manuscript is the journal *Science of Computer Programming*; no conference submission is planned for this manuscript. The author will confirm all required originality and concurrent-submission declarations in Editorial Manager at the time of submission.

Thank you for considering the manuscript.

Sincerely,

Michél Nguyen
University of the People

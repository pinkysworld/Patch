# Paper

Working manuscript:

**Patch: Change-Oriented Programming with Transparent State Evolution**

## Status

This is a substantial beta/design manuscript, not yet a submission-ready empirical paper. Implemented claims are tied to the repository artifact. Human-comprehension, large-program, native-compiler performance, and cross-platform GUI claims are research questions or implementation goals until measured.

The 0.2 development line has moved beyond the artifact state described in the original 0.1 manuscript:

- a compiler front end now lowers Patch to Change IR;
- `.patchapp` is implemented as the first portable bundle format;
- Patch Studio has become a browser-first PWA with iPhone/iPad responsive support;
- Studio can inspect Change IR and build `.patchapp` locally;
- the first Patch UI slice (`window`, `text`, `button`, `input`, `when ... clicked`) has a browser preview/runtime;
- native Windows/macOS/Linux/BSD and WebAssembly backends are still future work.

The next full manuscript revision should update the Implementation section after the 0.2 branch is merged and CI evidence is available. It should keep native portability claims clearly separated into implemented vs planned targets.

## Build

With a standard LaTeX installation:

```bash
cd paper
pdflatex main.tex
pdflatex main.tex
```

The manuscript contains its display bibliography directly so BibTeX is not required; `references.bib` is maintained as structured citation metadata for later venue formatting.

## Before submission

- complete the systematic literature review;
- verify citation metadata against publisher records;
- mechanize or machine-check the core properties;
- execute the benchmark suite;
- evaluate the GUI/state-unification claim with nontrivial applications;
- preregister/run the novice study if the paper retains the HCI/education claim;
- replace design-stage language with measured results;
- select the venue only after results show whether the PL, systems/tooling, or PL/HCI contribution is strongest.

# Paper

Working manuscript:

**Patch: Change-Oriented Programming with Transparent State Evolution**

## Status

This is a substantial beta/design manuscript, not yet a submission-ready empirical paper. Implemented claims are tied to the repository artifact. Human-comprehension, large-program, and compiler-performance claims are explicitly presented as research questions rather than fabricated results.

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
- preregister/run the novice study if the paper retains the HCI/education claim;
- replace design-stage language with measured results;
- select the venue only after results show whether the PL or PL/HCI contribution is stronger.

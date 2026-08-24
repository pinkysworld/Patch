# Patch assurance evaluation

Status: **evaluation harness for Patch 0.2.0-beta.35 / Change IR 0.10, with a process-isolated controlled-measurement protocol**.

This document defines a reproducible methodology for measuring the engineering cost of Patch's current assurance stack. It does **not** report publication claims by itself. Timing results depend on hardware, operating system, Node/V8, system load and Lean build state, so paper results must record the full environment and use controlled repeated runs.

The stricter paper-candidate procedure is documented in `docs/CONTROLLED_EVALUATION.md`.

## Research questions

The initial evaluation separates two scaling dimensions that beta.32 makes especially relevant:

1. **Call-tree depth:** how do direct-Wasm compilation, runtime correspondence and generated certificate size scale as the certified finite call tree becomes deeper?
2. **Concrete invocation count:** how do independent transition/effect validation and invocation-frame reconstruction scale when the same finite call structure executes repeatedly?

A third combined set exercises increasing depth and repeated calls together.

## Deterministic corpus

`src/evaluation-corpus.js` generates programs with:

```text
program -> root -> layer_N -> ... -> layer_1 -> leaf -> one quantitative change
```

`nestedDepth` changes the number of nested recipe-call edges below the certified `root -> layer_N` edge. `invocations` changes only how many concrete `do root(...)` calls execute. The leaf performs one numeric semantic change per root invocation.

This design keeps the two primary scaling axes interpretable:

- depth increases static/transitive call-tree structure;
- invocation count increases runtime transitions and independently reconstructed invocation frames.

The generator records expected final state, transition count, recipe count and leaf amount. Benchmarks abort if representative execution or beta.32 correspondence disagrees with these expectations.

## Phase-level JavaScript benchmark

Run:

```bash
npm run evaluate:assurance -- --preset paper --iterations 10 --warmup 3 \
  --out evaluation/results/assurance.json \
  --csv evaluation/results/assurance.csv
```

For a shorter development run:

```bash
npm run evaluate:assurance:quick
```

The phase harness measures:

| Metric | Measured operation | Interpretation |
|---|---|---|
| `compileMs` | `compileToDirectWasm(source)` | production frontend + direct-Wasm lowering |
| `executeMs` | `runDirectWasm(precompiledModule, metadata)` | direct compiled execution only |
| `validateMs` | `validateDirectSemanticEffects(ir, trace)` | independent IR execution + transition/effect/frame validation |
| `correspondenceMs` | `buildTransitiveRuntimeCorrespondence(source)` | end-to-end beta.32 runtime correspondence, including compile/run/validation/frame attribution |
| `certificateGenerationMs` | `generateTransitiveRuntimeCertificate(source)` | beta.30 certificate + beta.32 runtime evidence + Lean source generation |

`certificateGenerationMs` intentionally does **not** include Lean checking. Lean checking is a separate experimental phase because it has different setup/cache characteristics.

Each phase-level metric preserves all raw samples plus minimum, median, mean, p95 and maximum. Median should be the default descriptive statistic. Do not report only the fastest run.

## Process-isolated aggregation

Repeated phase samples in one Node process can share JIT, allocator, cache and garbage-collection history. The paper-candidate layer therefore uses `scripts/run-controlled-assurance.js` to launch multiple independent fresh Node processes around the existing phase harness.

Development example:

```bash
npm run evaluate:assurance:isolated
```

Controlled paper-candidate example:

```bash
npm run evaluate:assurance:controlled -- \
  --preset paper \
  --runs 10 \
  --iterations 10 \
  --warmup 3 \
  --machine-id patch-lab-01 \
  --label 2026-08-paper-baseline \
  --out-dir evaluation/results/controlled
```

The outer runner verifies that every child process reports the same Patch version, scenario shape, runtime protocol and normalized environment identity before aggregation. Environment drift fails closed rather than pooling heterogeneous runs.

It aggregates the **median from each independent process** and records minimum, Q1, median, Q3, p95, maximum, mean, MAD and IQR. All inner-process raw samples remain in `raw/run-NN.json`.

The output directory also contains `controlled-summary.csv` and `SHA256SUMS` covering the aggregate data and all raw JSON/CSV reports.

### Measurement classes

The controller requires every run to be one of:

- `development`: exploratory local timing, not manuscript evidence;
- `hosted-ci`: hosted runner timing, useful for reproducibility/regression evidence but not paper performance results;
- `controlled`: fixed-machine paper candidate, requiring an explicit machine id and run label.

The controller refuses `controlled` when `GITHUB_ACTIONS=true`. This prevents an accidental relabeling of variable GitHub-hosted timing as paper-quality measurement.

A successful controlled run is still only a measurement candidate. Statistical interpretation and manuscript claims require separate review.

### Analysis without manuscript mutation

`scripts/analyze-assurance-results.js` reads a `controlled-summary.json`, emits median/Q1/Q3/IQR/MAD tables, ordinary-least-squares sketches and SVG plots of process-median time against `nestedDepth` and `invocations`, and refuses `--sync-paper` for any non-`controlled` measurement class. Even a controlled summary is not copied into `paper/main.tex` by the runner; manuscript inclusion remains a review step.

```bash
npm run analyze:assurance -- \
  --summary evaluation/results/controlled/controlled-summary.json \
  --markdown evaluation/results/controlled/analysis.md \
  --tex evaluation/results/controlled/analysis.tex \
  --svg evaluation/results/controlled/analysis.svg
```

## Artifact-size measurements

Each scenario also records:

- Patch source bytes/lines and SHA-256;
- direct Wasm bytes;
- runtime transition/effect count;
- reconstructed invocation-frame count;
- supported correspondence count;
- maximum certified call depth;
- generated Lean certificate bytes;
- number of certified runtime witnesses.

These measurements help distinguish execution overhead from proof-artifact growth.

## Presets

`smoke` contains one tiny repeated-call case for harness validation.

`quick` contains four representative cases for development.

`paper` contains separate depth scaling, invocation scaling and combined cases. The preset defines the corpus, not the statistical protocol. Publication runs should use the process-isolated controlled runner and preserve its complete raw output directory.

## Lean checker timing

The manual GitHub Actions workflow **Patch Assurance Evaluation** now runs the same process-isolated JavaScript controller but explicitly labels it `hosted-ci`. It also generates beta.32 certificates, builds the pinned Lean environment and records separate wall-clock/resource measurements for Lean verification. It remains `workflow_dispatch` only so evaluation runs do not add routine PR notification noise.

For paper-quality numbers, prefer a dedicated machine with:

- fixed CPU governor/power mode where possible;
- recorded CPU/RAM/OS versions;
- no unrelated heavy workload;
- fixed Node and Lean versions;
- fresh and warm-cache Lean runs reported separately if both are relevant;
- enough independent processes to characterize variance.

CI-hosted timings are useful reproducibility evidence but should not be treated as stable microbenchmark performance numbers because hosted runner hardware and load may vary.

## Reproducibility artifact bundle

The commit-bound reproducibility bundle documented in `docs/REPRODUCIBILITY_BUNDLE.md` is deliberately separate from this benchmark methodology.

The **Patch Reproducibility Bundle** workflow regenerates the current finite transitive call-tree certificate, direct-Wasm runtime certificate, repeated-call invocation-frame certificate, semantic-authority micro-case report and checkout-extension report. It then packages those outputs together with the exact tracked source snapshot, source commit, Patch version and per-file SHA-256 manifest.

The workflow sets `SOURCE_DATE_EPOCH` to the checked-out commit timestamp so non-performance evidence reports do not drift merely because the workflow ran at a different wall-clock time. It also creates a sorted tar/gzip envelope with commit-time mtimes and no gzip timestamp.

That workflow intentionally does **not** execute the `paper` assurance benchmark and does not create manuscript timing results. Hosted-runner CPU, load and microarchitectural variation would make such timings unsuitable for the controlled performance claims described above.

Use the reproducibility bundle for **artifact identity and evidence reruns**. Use the controlled evaluation methodology for **performance measurement**.

## Interpretation discipline

The benchmark measures the current implementation, not an asymptotic proof. Avoid claims such as "linear overhead" unless the collected data and model support them.

Useful plots for the paper are likely:

1. median correspondence time vs. invocation count at fixed depth;
2. median correspondence/certificate-generation time vs. nested depth at one invocation;
3. generated Lean certificate bytes vs. supported correspondence count;
4. independent validation time vs. runtime transition/frame count;
5. Lean checker time vs. generated certificate bytes/witness count.

Use the per-process medians to visualize dispersion and report IQR and/or MAD alongside central estimates. Do not hide the raw independent runs behind a single aggregate line.

The controller intentionally does not fit a scaling model or perform significance tests. Those choices belong in an explicit paper analysis script/notebook so model assumptions remain inspectable.

## Trust and scope boundary

The evaluation does not strengthen beta.32's theorem. Runtime capture, independent JavaScript validator/frame-reconstruction correctness, parser/lowering correctness and Wasm-engine correctness remain the explicit proof-free/trust boundaries documented elsewhere.

Performance measurements should therefore be described as costs of the **implemented assurance pipeline**, not as evidence of full compiler verification.

## Current empirical status

The deterministic corpus, phase harness, process-isolated controller, robust aggregation, environment consistency checks, checksummed raw output and hosted-CI validation path are implemented.

**No controlled paper-quality dataset has been collected in the repository yet. No overhead, scalability or asymptotic claim is made yet.**

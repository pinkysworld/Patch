# Controlled assurance measurement protocol

Patch already has a deterministic assurance corpus and phase-level timing harness. This document defines the stricter protocol used when timing data may become manuscript evidence.

The protocol does not make a performance claim by itself. It separates three classes of timing evidence so development and hosted-CI measurements cannot accidentally be presented as controlled paper results.

## Measurement classes

`development`

- local exploratory timing;
- useful for finding regressions and checking the harness;
- not manuscript evidence.

`hosted-ci`

- timing from GitHub-hosted Actions or another variable hosted runner;
- useful for reproducibility and regression evidence;
- explicitly marked non-publication timing evidence.

`controlled`

- intended for a fixed, documented machine under the protocol below;
- requires an explicit machine id and run label;
- requires the recorded source commit to equal the actual `git HEAD`;
- requires a clean Git working tree before measurement starts;
- is rejected when `GITHUB_ACTIONS=true`;
- is only a controlled-measurement candidate. Interpretation and manuscript synchronization remain separate review steps.

## Why process isolation matters

`scripts/benchmark-assurance.js` measures repeated samples within one Node process. That is useful for phase timing, but a single process can share JIT state, allocator state, caches and garbage-collection history across samples.

`scripts/run-controlled-assurance.js` adds an outer experimental layer. Each independent run starts a fresh Node process that executes the existing benchmark harness. The controller then checks that every child report has the same:

- Patch version;
- corpus preset and scenario shape;
- generated source identity and artifact metadata;
- iteration/warmup protocol;
- certificate-generation setting;
- Node and V8 versions;
- operating-system/platform identity;
- architecture;
- CPU model and logical CPU count;
- recorded total memory.

Any drift fails the aggregation instead of silently combining heterogeneous runs.

## Controlled run command

A paper candidate run should use the `paper` corpus and retain the default 10 independent processes, 10 measured samples per phase per process and 3 warmups unless the experiment plan records a justified alternative.

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

Do not use `--skip-certificate` for the complete paper candidate unless certificate generation is intentionally being studied in a separate run.

The runner resolves the actual Git commit with `git rev-parse HEAD`. A controlled run fails unless the recorded source commit is an exact 40-character commit equal to that `HEAD`, and it fails when `git status --porcelain` reports a dirty working tree. This prevents uncommitted compiler/runtime changes from being measured under the identity of a different commit.

The output path is also fail-closed. Repository, home, filesystem-root and repository-parent paths are rejected, and the runner only clears its known aggregate files plus its own `raw/` child directory rather than recursively deleting an arbitrary output directory.

## Machine preparation

Record and keep stable where practical:

1. CPU model and firmware/BIOS version;
2. RAM size and configuration;
3. operating-system version and kernel/build;
4. Node and V8 versions;
5. Lean version for the separate Lean-check experiment;
6. power mode and CPU governor;
7. whether the machine is on AC power;
8. background services that cannot be disabled;
9. thermal state before the run;
10. source commit and working-tree cleanliness.

Recommended procedure:

1. reboot or otherwise establish a documented starting state;
2. connect AC power and select the fixed performance/power profile used for every run;
3. stop unrelated CPU-, disk- and memory-heavy workloads;
4. allow the machine to reach a stable idle/thermal state;
5. verify the intended Node/Lean toolchain versions;
6. verify the exact Git commit and a clean working tree;
7. run the process-isolated benchmark once as a non-recorded development rehearsal;
8. restore a clean working tree if that rehearsal created any tracked/unignored output;
9. execute the recorded controlled run without other interactive workloads;
10. preserve the complete output directory unchanged.

If hardware, OS, runtime, power mode or experimental procedure changes, create a new machine/run label instead of pooling the measurements.

## Output contract

The output directory contains:

```text
controlled-summary.json
controlled-summary.csv
SHA256SUMS
raw/run-01.json
raw/run-01.csv
...
```

`controlled-summary.json` records:

- Patch version, recorded source commit and actual Git HEAD;
- whether source identity was verified against Git and whether the working tree was clean at start;
- measurement class, machine id and run label;
- process count, measured iterations and warmups;
- normalized environment identity and SHA-256 fingerprint;
- metadata and SHA-256 for every raw child report;
- per-scenario aggregation across the median from each independent process.

For each phase, aggregation records:

- all process medians;
- minimum and maximum;
- Q1, median and Q3;
- p95;
- mean;
- median absolute deviation (MAD);
- interquartile range (IQR).

The raw child JSON remains authoritative for within-process samples. The controller does not discard or replace those samples.

`SHA256SUMS` covers both aggregate files and all raw JSON/CSV reports so the exact measured dataset can be checked after transfer or archival.

## Statistical interpretation

Use the across-process median as the primary central estimate unless the analysis plan states otherwise. Report dispersion alongside it, preferably IQR and/or MAD. Do not select the fastest process or fastest inner-loop sample as the headline number.

The controller intentionally does not fit scaling models, perform significance testing or declare complexity classes automatically. Those decisions depend on the research question and should remain visible in the analysis notebook/script used for the paper.

A claim such as "linear scaling" requires a model and diagnostics that support it. A plot that looks approximately straight is not sufficient.

## Plots

`controlled-summary.csv` is deliberately long-form, with one row per scenario and phase. It can feed R, Python, Julia or a spreadsheet without parsing nested JSON.

Recommended initial figures remain:

1. correspondence time versus invocation count at fixed depth;
2. correspondence and certificate-generation time versus nested call depth;
3. validation time versus transition/frame count;
4. generated certificate size versus supported correspondence count;
5. separate Lean checker time versus certificate size/witness count.

Use raw process medians to show uncertainty, not only a single aggregate line.

## Lean checking

Lean checker timing remains a separate phase because toolchain startup, dependency build state and cache state differ from the Node/direct-Wasm measurements.

The manual `Patch Assurance Evaluation` workflow still records separate pinned-Lean wall time and memory, but because it runs on hosted infrastructure those measurements remain `hosted-ci` evidence. For paper-quality Lean timings, reproduce the same commands on the controlled machine and clearly distinguish cold versus warm dependency/cache conditions.

## Hosted CI

The manual GitHub workflow invokes the process-isolated controller with:

```text
measurementClass = hosted-ci
```

This is deliberate. The workflow can validate the protocol, preserve raw outputs and expose regressions, but the controller refuses to label GitHub Actions timing as `controlled`.

## Claim boundary

A successful `controlled` run means the artifact followed the process-isolation, source-identity and recorded-environment protocol. It does not automatically make every statistical or performance statement valid.

Measured results must still be reviewed for:

- variance and outliers;
- thermal or system interference;
- scenario correctness;
- appropriate aggregation/model choice;
- consistency with the exact commit under evaluation;
- synchronization with the manuscript without overstating the formal guarantee.

Until an actual controlled dataset is collected and reviewed, the Patch manuscript continues to make no empirical overhead or scalability claim.

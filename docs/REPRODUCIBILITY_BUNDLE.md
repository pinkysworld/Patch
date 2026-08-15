# Patch reproducibility bundle

Patch 0.2.0-beta.34 can produce a commit-bound research artifact bundle for independent inspection and reruns of the current formal/runtime and semantic-authority evidence.

The bundle is deliberately separate from the assurance performance benchmark. It packages the implementation, formal sources, examples and generated evidence needed to reproduce the current claims, but it does **not** manufacture paper-quality timing results on a GitHub-hosted runner.

## Artifact contents

A bundle contains:

- the exact Patch package version;
- the exact 40-character source commit checked out by the workflow;
- a snapshot of every Git-tracked repository file relevant to that checkout;
- explicitly supplied generated evidence, including regenerated Lean certificates and case-study reports;
- `BUNDLE-MANIFEST.json`, containing size and SHA-256 for every copied source/evidence file;
- `environment.json`, recording Node/V8, host platform/architecture, CPU model strings and memory for provenance;
- `REPRODUCE.txt`, with the core rerun commands.

Tracked source and explicitly generated files are copied under `source/` using their repository-relative paths. Untracked working-tree files are excluded unless the bundle command names them with `--generated`.

## Build and verify locally

From a clean Patch checkout:

```bash
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated

SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)" \
  npm run evaluate:security -- \
    --out evaluation/reproducibility/security.json \
    --csv evaluation/reproducibility/security.csv \
    --markdown evaluation/reproducibility/security.md

SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)" \
  npm run evaluate:checkout-extension -- \
    --out evaluation/reproducibility/checkout.json \
    --markdown evaluation/reproducibility/checkout.md

node scripts/reproducibility-bundle.js build \
  --out reproducibility/bundle \
  --commit "$(git rev-parse HEAD)" \
  --generated formal/GeneratedTransitiveCallBodyCertificate.lean \
  --generated formal/GeneratedTransitiveRuntimeCertificate.lean \
  --generated formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean \
  --generated evaluation/reproducibility/security.json \
  --generated evaluation/reproducibility/security.csv \
  --generated evaluation/reproducibility/security.md \
  --generated evaluation/reproducibility/checkout.json \
  --generated evaluation/reproducibility/checkout.md

node scripts/reproducibility-bundle.js verify \
  --bundle reproducibility/bundle \
  --version 0.2.0-beta.34 \
  --commit "$(git rev-parse HEAD)"
```

The shorter `npm run bundle:reproducibility` and `npm run verify:reproducibility` commands are available when no extra generated files need to be added manually.

## Deterministic evidence timestamps

The security-ablation and checkout-extension evaluators normally record the current wall-clock time. When `SOURCE_DATE_EPOCH` is set to a non-negative Unix timestamp, both use that timestamp instead. The CI bundle workflow sets it to the checked-out Git commit timestamp.

This makes those generated evidence reports reproducible for the same source commit without pretending that benchmark timings from different machines are reproducible measurements.

## CI artifact

`.github/workflows/reproducibility-bundle.yml` regenerates the formal/runtime evidence and both semantic-authority case-study reports, builds the commit-bound bundle, verifies every manifest hash, and creates a deterministic `tar.gz` archive.

The archive uses:

- sorted file names;
- the source commit timestamp as archive mtime;
- numeric owner/group `0`;
- `gzip -n` so gzip does not inject a wall-clock timestamp or original filename.

The workflow publishes the archive plus a SHA-256 file as a GitHub Actions artifact. The archive name includes the Patch version and the first 12 characters of the exact source commit.

## What this supports

The bundle supports a narrow reproducibility statement:

> A reviewer can identify the exact Patch version and source commit, verify the SHA-256 of every packaged source/evidence file, regenerate the current finite transitive call-tree/runtime certificates and semantic-authority case-study reports, and rerun the documented checks from the same source snapshot.

It also prevents accidental artifact drift between manuscript-supporting code and the evidence handed to reviewers.

## What this does not prove

The bundle does not establish:

- full compiler correctness;
- correctness of the JavaScript parser, lowering code, runtime capture, independent validator or invocation-frame reconstruction beyond the existing evidence boundaries;
- reproducible performance numbers across heterogeneous machines;
- a trusted build environment independent of Git/GitHub, Node, Lean, the host OS or toolchains;
- code signing or supply-chain attestation for every tool used to reproduce the artifact.

`environment.json` is provenance, not part of a cross-machine byte-identical measurement claim.

## Performance measurements remain separate

`docs/EVALUATION.md` and the manual `Patch Assurance Evaluation` workflow remain the path for overhead/scaling experiments. Controlled paper-quality results still require fixed hardware, declared warmups/iterations, preserved raw samples and statistical analysis. The reproducibility bundle includes the evaluation harness source so reviewers can inspect and run it, but the bundle workflow intentionally does not turn hosted-runner timings into manuscript results.

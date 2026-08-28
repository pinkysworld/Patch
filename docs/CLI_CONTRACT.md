# Patch CLI contract

Patch keeps the installed `patch` command intentionally small and scriptable. Starting with the beta.32 production-readiness line, the existing process exit behavior is treated as a stable compatibility contract and selected commands expose a versioned JSON result envelope.

## Stable process exit codes

Patch uses exactly three documented exit codes for normal CLI operation:

| Exit | Meaning |
| ---: | --- |
| `0` | The requested command completed successfully. |
| `1` | CLI usage is incomplete or invalid before Patch source processing begins, for example a required source file is missing. |
| `2` | Source processing, compilation, validation, certification, runtime execution or build work failed. |

Existing commands already used this `0/1/2` behavior. Production-readiness work freezes that behavior instead of introducing a new incompatible exit-code taxonomy.

A stable `PATCHxxxx` diagnostic code provides the finer-grained machine-readable failure class. Consumers should use the process exit code for coarse control flow and the diagnostic code for specific failure handling.

## JSON result envelope

`check`, `formal`, `certify` and `build` accept `--json`. The flag may appear before or after the source path.

```bash
patch check main.patch --json
patch formal --json main.patch
patch certify main.patch --out Main.patchcert.lean --json
patch build main.patch --target c99 --out Main.c --json
```

Successful and failed JSON commands write one JSON document to stdout with this versioned shape:

```json
{
  "format": "patch-cli-result",
  "version": 1,
  "command": "check",
  "ok": true,
  "exitCode": 0,
  "entry": "main.patch",
  "data": {},
  "diagnostic": null
}
```

`format` and `version` are the compatibility boundary. New optional fields may be added within command-specific `data` objects without changing version 1, but existing fields must not silently change meaning. An incompatible envelope change requires a new result version.

For a processing failure, `ok` is false, `exitCode` is `2`, and `diagnostic` contains the versioned `patch-diagnostic` object and stable `PATCHxxxx` code. Source locations use the source filename plus one-based line/column where available. No complete source body is serialized as a JSON field. Standard diagnostic messages may still name the offending statement or expression, just as the human-readable CLI does; the separately downloadable Studio `.patchreport` keeps its stricter source-echo redaction contract.

A missing required source argument in JSON mode returns exit `1`, `diagnostic: null`, and a command-specific usage string in `data.usage`, because no Patch source has been processed yet.

## Command data

### `check --json`

Returns project/IR identity and stable numeric summaries for top-level instructions, recipe Change Signatures, Change Capability policies, semantic bridge coverage, source/range coverage, raw-source validation and raw-guard validation.

### `formal --json`

Returns the formal semantic bridge, formal source/range/guard view, raw-source extraction validation and raw-guard validation. If those translation-validation layers report mismatches, the command exits `2` and includes a compiler diagnostic while preserving the detailed coverage data.

### `certify --json`

Writes the same Lean certificate artifact as ordinary `certify` and returns its output path, source SHA-256, relevant schema versions, formal range claim count and certified recipe names.

### `build --json`

Writes the same artifact as ordinary `build` and returns an `artifact` object with path, project kind, target, format and backend/version metadata where available. Binary artifact bytes are never embedded into stdout JSON.

Local `native`/`app` JSON builds run Cargo quietly so toolchain progress cannot corrupt stdout. A failed native build is represented by the normal JSON failure envelope.

## Human-readable compatibility

Without `--json`, the existing human-readable output remains the default. `run`, `run-wasm`, `changes` and `runtime-certify` retain their existing text behavior in this contract version. `doctor --json` predates the generic CLI result envelope and continues to expose its existing dedicated doctor-report schema. That report includes environment probes plus a `compiler-backends` self-check of the interpreter, direct Wasm and C99 numeric subset, including that Things fail closed on those backends. On Unix hosts with a C compiler the self-check also compiles and runs the numeric C99 program.

Scripts should not parse the human-readable prose when an equivalent JSON mode exists.

## `components`

`patch components` and `patch components --json` dump the canonical Designer registry as a target-capability matrix. The command does not take source and uses a dedicated `patch-components` JSON schema rather than the generic `patch-cli-result` envelope, matching `doctor`.

```bash
patch components
patch components --json
```

The JSON object includes `registryVersion`, the current native contract identity, and one row per component with properties, events and per-target status (`supported`, `authoring`, `unsupported`). Markdown in `docs/COMPONENT_CAPABILITY_MATRIX.md` is generated from the same module; `node scripts/generate-component-matrix.js --check` fails if the file drifts.

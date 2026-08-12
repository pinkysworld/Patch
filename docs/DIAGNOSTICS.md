# Patch diagnostic codes

Patch diagnostics use a small stable machine-readable envelope so compiler, Studio, build and support tooling can identify failure classes without parsing English text.

## Envelope

The current diagnostic format is `patch-diagnostic` version `1`.

```json
{
  "format": "patch-diagnostic",
  "version": 1,
  "code": "PATCH1001",
  "severity": "error",
  "phase": "compile",
  "message": "I do not understand 'nonsense command'.",
  "location": {
    "entry": "main.patch",
    "line": 2,
    "column": 3
  }
}
```

`location` is `null` when a failure is not tied to a Patch source line. Paths are reduced to the entry filename before they enter the normalized diagnostic.

## Stable code families

- `PATCH1000` syntax error
- `PATCH1001` unknown statement
- `PATCH1002` indentation error
- `PATCH1003` expected indented block
- `PATCH1004` invalid language/UI structure
- `PATCH1005` invalid source layout/position
- `PATCH1100` semantic error
- `PATCH1900` compiler error not covered by a narrower code
- `PATCH2001` unknown build target
- `PATCH2002` target does not support the project kind
- `PATCH2900` build error not covered by a narrower code
- `PATCH3000` runtime error
- `PATCH9000` internal/unclassified error

New narrower codes may be added without changing the diagnostic schema version. Existing meanings must not be silently reassigned.

## Source locations

Parser errors already carry exact source line numbers. The normalized diagnostic derives the column from the first non-whitespace character on that source line when the originating error does not provide a more precise column. This means indentation-aware source locations remain useful while preserving existing parser error messages.

Backend lowerers also report original Patch lines for a growing set of fail-closed errors. Diagnostic normalization recognizes the deliberately narrow `at line N`, `at Patch line N` and `at source line N` forms and maps those back to the original entry file. This immediately preserves source locations for existing direct-Wasm failures and the C99 failures that share the direct-Wasm conservative support validator.

The normalizer intentionally does **not** interpret arbitrary compiler/toolchain locations such as `generated.c:17:9` as Patch locations. Final C/C++/Rust/PE/Mach-O/ELF packaging errors still need an explicit source map before they can safely point back to Patch code.

For example, a direct-Wasm build failure that already says `create text at line 3 ...` becomes a `PATCH2900` diagnostic with `main.patch:3:<indent-column>` in CLI `build --json` output instead of losing its source position.

Patch Studio `.patchreport` files include the stable code and normalized source location for compiler failures. They still omit the source body. Diagnostic normalization never needs to embed the offending source line.

## Privacy

The existing Studio privacy boundary remains unchanged: source body and project name are omitted, source echoes are redacted, common token/email/home-directory data is redacted, and no report upload path exists.

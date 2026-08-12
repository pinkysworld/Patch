# Patch source compatibility corpus

Patch remains pre-1.0, but compatibility should be tested rather than described only in prose. The checked-in `compat/source-0.2/` corpus defines source forms from the 0.2 language line that current Patch releases are expected to keep accepting with the same observable behavior.

## Corpus contract

`compat/source-0.2/manifest.json` is versioned as `patch-source-compatibility-corpus` v1. Each case points to a real `.patch` source file and declares either runtime output/state expectations or Window compilation expectations.

The initial corpus covers:

- core numeric `create` + explicit `change` + `show`;
- Thing field creation and source-level field mutation;
- the original loose comma-separated List syntax;
- `make`/`do` recipes plus named Undo and Redo;
- legacy flow-layout Window controls without source-backed coordinates;
- multiple legacy unnamed Windows.

`tests/source-compatibility.test.js` compiles every case against current Change IR and executes Console cases through the interpreter. Window cases must continue to infer Window projects and preserve their legacy non-positioned control structure.

## Compatibility rule

A parser/compiler refactor may change internal AST implementation, analysis algorithms or generated backend code without changing the corpus. If an intentional language change makes a corpus program invalid or changes its observable result, that is a compatibility change and must be handled deliberately rather than by silently editing the old fixture in place.

For pre-1.0 development, the preferred choices are:

1. retain compatibility when practical;
2. add an explicit migration/diagnostic when compatibility cannot be retained;
3. create a new compatibility corpus/version when the language contract itself intentionally advances.

The corpus is not a promise that every historical experimental syntax survives forever. It is an executable baseline for source forms Patch has chosen to keep supporting.

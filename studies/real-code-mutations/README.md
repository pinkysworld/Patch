# Public real-code mutation audit

This directory contains the exploratory external-validity study used by the Science of Computer Programming manuscript.

## Research question

For a deliberately small public corpus of retained-state mutations from extension/plugin/automation code, which **local mutation shapes** align with Patch's current semantic operation vocabulary and source/formal fragments, and which require adapters or restructuring because of representation, dynamic-target, host-state, or update-coupling constraints?

The study is an audit, not a population sample. It does **not** estimate how common any mutation form is across software ecosystems and does not measure migration effort, security benefit, or developer productivity.

## Sampling protocol

The corpus uses a purposive maximum-variation design fixed on 2026-08-30:

- six public JavaScript/TypeScript projects;
- two VS Code extension codebases plus VS Code ESLint, two Obsidian plugins, and Node-RED's automation runtime;
- each project is pinned to a full Git commit SHA;
- exactly three retained-state mutation observations are coded per project;
- tests, fixtures, generated files, build scripts, benchmark-only code, and loop-local temporaries are excluded;
- within each project, observations were chosen to expose different mutation shapes where the source provided them rather than to maximize Patch compatibility.

The fixed three-per-project rule limits post-hoc expansion of projects that happen to look favorable, but this remains purposive selection. Descriptive counts therefore apply only to these 18 audited observations.

## Coding dimensions

Each observation records:

1. **operation family** — the closest local Patch semantic verb (`increase`, `decrease`, `set`, `add`, `remove`, or `clear`);
2. **local surface fit** — `direct`, `adapter`, or `restructure`;
3. **Lean-fragment shape match** — whether the local operation has the same singleton numeric, directional, constant-magnitude shape as the present Change-to-contract theorem;
4. **context constraint** — whether the surrounding update is standalone, coupled across targets, host-persisted, sequential on the same target, or dynamically/batch targeted.

`direct` is intentionally strict. A JavaScript `Set` or `Map` operation is not counted as a direct Patch-list translation merely because Patch has an `add`, `remove`, or `clear` verb. Likewise, dynamic object keys, VS Code `globalState`, callback-based `filter`, spread insertion, tries, and Node-RED context maps retain their adaptation/restructuring status.

A Lean-fragment shape match is only a **shape classification**. It does not prove, certify, translate, or execute the external program in Lean or Patch.

## Projects and immutable source pins

| Project | Ecosystem | Commit |
| --- | --- | --- |
| `gitkraken/vscode-gitlens` | VS Code extension | `25d480b100320bbe386f3e966328d9c1196eccfe` |
| `prettier/prettier-vscode` | VS Code extension | `b3d5ea136fadf5a4cac835df074dc12fcb398b0c` |
| `microsoft/vscode-eslint` | VS Code extension | `f5e644a38575bdc652856be6c8e45559b18f52ad` |
| `blacksmithgu/obsidian-dataview` | Obsidian plugin | `5ad0994ff384cbb797de382e7edff2388141b73a` |
| `obsidian-tasks-group/obsidian-tasks` | Obsidian plugin | `f2695dfaf0c4dd2267c028ff9fcbb9b1c37dddc0` |
| `node-red/node-red` | automation runtime | `dcceaddf23ed489d8ad0ae4e472ec3cc13810695` |

`corpus.json` stores the exact repository, commit, path, context label, and a short source anchor for every observation. The source projects are not vendored or redistributed.

## Reproduction

Deterministically validate the coding manifest and regenerate the descriptive result file:

```bash
npm run evaluate:real-code
npm run evaluate:real-code:check
```

Optionally verify that every recorded source anchor is still present at the exact pinned public GitHub commit:

```bash
npm run verify:real-code-sources
```

The source-anchor check uses only immutable raw GitHub URLs and Node's built-in `fetch`; it is intentionally not required for offline manuscript compilation.

## Frozen descriptive result

For the 18 audited observations:

- all 18 can be assigned a local operation family in Patch's current semantic vocabulary;
- **5** are coded as a direct local current-surface fit;
- **11** need a representation/host/dynamic-target adapter;
- **2** require source restructuring;
- **3** local observations have the same narrow singleton numeric directional constant-magnitude shape as the present Lean Change-to-contract bridge;
- only **7** observations are standalone in the audited context; the other **11** expose coupled, host-persisted, sequential, or dynamic-target context constraints.

These numbers are not prevalence estimates. In particular, the fact that every observation has an operation-family label follows from auditing state-changing source and using a deliberately coarse local semantic coding vocabulary; it must not be reported as "Patch supports 100% of real-world mutations." The much stricter direct-surface classification and the context constraints are the relevant negative evidence.

## Threats to validity

The author performed the coding, with AI tools used to help locate and challenge candidate classifications. There is no independent second coder and therefore no inter-rater reliability statistic. The small purposive corpus is vulnerable to project and site-selection bias. Exact commit pins and source anchors make the coding auditable, but they do not turn the sample into a representative one. The study evaluates mutation *shape*, not behavioral equivalence of translated programs, migration cost, or user experience.

# Patch Language Simplicity Gate

Status: non-negotiable design constraint for language research

Patch can become more powerful internally without becoming harder to start using. Every new syntax proposal must preserve the beginner path.

## The five-minute language

A new learner should be able to make a useful program after learning only:

```patch
create number score = 0
change score:
  add 1
show score
```

Recipes, GUI authoring, capabilities, ranges, ChangeSets, invariants, adapters and proofs are later layers.

## Rules for new syntax

1. Existing beginner programs remain valid and do not require new annotations.
2. Advanced syntax must be optional.
3. Prefer ordinary words to symbols and specialist terminology.
4. Prefer one readable construct that lowers to rich semantics over many low-level constructs.
5. Diagnostics begin with a plain-language explanation.
6. Patch Studio hides research/formal detail until requested.
7. A feature that needs significant ceremony must prove that the ceremony buys a meaningful semantic property.

## Simplicity budget

For every proposed surface feature record:

- new required keywords for beginners: target **0**;
- changes required to the minimal counter example: target **0**;
- mandatory type/proof annotations: target **0**;
- beginner-visible formal terminology: target **0**;
- shortest useful example: keep readable without documentation beside it.

## Relational ChangeSet design test

Preferred direction:

```patch
change together called transfer:
  change alice:
    remove amount
  change bob:
    add amount

  keep alice + bob the same
  make sure alice >= 0
```

Internal concepts such as pre-state/post-state, delta equality, relational predicates, transaction rollback and proof obligations should not leak into the beginner-facing syntax unless there is no simpler faithful form.

## Studio progressive disclosure

Default:

- Editor
- Designer
- Run
- simple errors

Optional/advanced:

- Change Plan
- Invariant Inspector
- Authority Heatmap
- formal evidence
- ChangeLens
- Adapter Inspector

A child should never have to understand the optional panels to write and run ordinary Patch programs.

## Review checklist

Before merging a language feature:

- [ ] old beginner examples unchanged;
- [ ] advanced syntax is optional;
- [ ] no shorter plain-language spelling was rejected without reason;
- [ ] diagnostics have a non-formal first sentence;
- [ ] Studio defaults remain uncluttered;
- [ ] feature has tests for both simple and advanced use;
- [ ] docs show the simple path before the research path.

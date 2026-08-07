# Contributing

Patch is early research software. Small, test-backed changes are preferred.

## Principles

1. Keep beginner syntax small.
2. Put sophistication in the compiler/runtime, not punctuation.
3. Preserve Mutation Transparency: no new way to modify persistent state outside `change` without a strong research reason.
4. Do not claim novelty without prior-art evidence.
5. Add a test for every semantic rule.

## Local checks

```bash
npm test
npm run check
```

A useful pull request explains what behavior changes, whether the semantic-change representation changes, what tests demonstrate it, and whether docs/spec/paper need updates.

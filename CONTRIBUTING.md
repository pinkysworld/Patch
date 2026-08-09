# Contributing

Patch is early research software. Small, test-backed changes are preferred.

## Principles

1. Keep beginner syntax small.
2. Put sophistication in the compiler/runtime, not punctuation.
3. Preserve Mutation Transparency: no new way to modify persistent state outside `change` without a strong research reason.
4. Do not claim novelty without prior-art evidence.
5. Add a test for every semantic rule.
6. Treat release integrity, compatibility and diagnostics as product requirements rather than research polish.

## Local checks

```bash
npm test
npm run check
npm run doctor
```

For a change that affects distributed artifacts, also exercise the relevant build(s) and generate a release manifest/checksum set before release review.

## Security-sensitive changes

Read [SECURITY.md](SECURITY.md) before changing parsers/evaluators, persistent mutation paths, capability checking, generated HTML/Electron code, process invocation, remote-build token handling, certificate/evidence boundaries or release/update mechanisms.

## Compatibility

Pre-1.0 compatibility expectations are documented in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). A breaking source or project-format change needs explicit release notes, a migration story and regression coverage.

## Pull request checklist

A useful pull request explains:

- what behavior changes;
- whether the semantic-change representation changes;
- what tests demonstrate it;
- whether docs/spec/paper need updates;
- whether the change affects source/project/artifact compatibility;
- whether it changes a security or release trust boundary.

The prioritized operational backlog is in [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

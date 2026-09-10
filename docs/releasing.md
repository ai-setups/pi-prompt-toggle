# Releasing

```bash
npm version patch   # or: minor, major
git push --follow-tags
```

That is the whole procedure. Pushing the tag triggers
[`release.yml`](../.github/workflows/release.yml), which verifies the tag matches
`package.json`, runs lint, typecheck and tests, then publishes to npm.

## Picking the number

| | When |
| :-- | :-- |
| `patch` | bug fix |
| `minor` | new capability, existing usage unaffected |
| `major` | breaking change |

## Rules the workflow enforces

- The tag must look like `v1.2.3` (or `v1.2.3-beta.1`). Other tags are ignored.
- The tag must match `version` in `package.json`. `npm version` writes both, so
  they only drift if you edit one by hand.
- Lint, typecheck and tests must pass. The gate is the same one PRs go through.

## Authentication

None to manage. Publishing uses a
[trusted publisher](https://docs.npmjs.com/trusted-publishers): npm issues a
short-lived credential to the workflow over OIDC, which also produces a
provenance attestation. There is no npm token in this repository, and none
should be added.

Changing the workflow filename or moving the repository breaks the trust
relationship — update it under Trusted Publisher in the package settings on
npmjs.com.

## If a release fails

| Symptom | Cause |
| :-- | :-- |
| `tag vX does not match package.json version Y` | Tag and `package.json` disagree. Delete the tag, fix, tag again. |
| Workflow never starts | Tag does not match `v[0-9]+.[0-9]+.[0-9]+`. |
| `401`/`403` on publish | Trusted publisher is missing or points at the wrong repo/workflow. |
| Lint, typecheck or tests fail | Fix on `main` first; a tag alone will not republish. |

A failed run publishes nothing, so it is safe to delete the tag and retry:

```bash
git tag -d v1.2.3 && git push origin :refs/tags/v1.2.3
```

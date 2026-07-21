# iTwin.js Core Agent Instructions

## Read the source of truth

Read only the references relevant to the task:

| Need | Source |
| --- | --- |
| Setup, Rush commands, contribution and PR workflow | `CONTRIBUTING.md` |
| Package scripts, test runner, local conventions | Affected package's `package.json`, tests, and configuration |
| Project graph and publish status | `rush.json` |
| Public API contract | The package's `common/api/*.api.md` report |
| Lockstep version policy | `common/config/rush/version-policies.json` |
| CI behavior | `.github/workflows/` and `common/config/azure-pipelines/` |

## Boundaries

- Change only files relevant to the task. Preserve unrelated changes.
- Do not push, create pull requests, or update GitHub issues unless asked.
- Use non-interactive Git. Do not discard changes without explicit approval.
- Use `rush` from the repository root and `rushx` in a package. Do not use `npm install`, `pnpm install`, or edit `pnpm-lock.yaml` directly.
- Use relative imports within a package. Do not self-import through `@itwin/*`.
- Keep backend and native dependencies out of `core/common` and `core/frontend`.
- Frontend code uses `IModelConnection` and its managers, not new direct RPC clients.
- Do not change an existing exported API or RPC signature without a compatibility plan.
- Keep private implementation in `src/internal/`. Cross-package internals belong in the owning package's `src/internal/cross-package.ts`.

## Public APIs

- Check the release tag and API report before changing an exported symbol.
- Do not break a `@public` API outside a major-version migration plan. Prefer an additive API and deprecation.
- Give every new export a release tag.
- Do not hand-write dates in `@deprecated` tags.

## Before remote work

Before committing work that will be pushed, apply only the checks required by the final diff:

| Final diff includes | Required before push |
| --- | --- |
| Production code | Targeted build, tests, and affected-package lint |
| Exported API, entry point, or release tag | `rush clean && rush build && rush extract-api`; review API report changes |
| Published package | Rush change file with `"type": "none"`; use an empty comment when behavior is unchanged |
| Breaking API or behavior change, or significant feature | Migration guidance in `docs/changehistory/NextVersion.md` |
| External dependency manifest | `rush check` and the Rush update flow |
| Documentation extract or package docs | Relevant `rushx docs` build when available |

- Commit intentional API reports and change files with the implementation.
- Treat a runtime or logical behavior change as breaking even when existing consumer code still compiles.
- If a required check is blocked, state the command and blocker.
- Do not commit `.only` tests.

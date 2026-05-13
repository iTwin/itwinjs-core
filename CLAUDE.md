# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Tooling

This is a **Rush + pnpm monorepo** with 50+ TypeScript packages. Always use `rush`/`rushx`, never `npm` or `pnpm` directly.

```bash
rush install          # Install all deps (after git pull)
rush build            # Incremental build
rush rebuild          # Full rebuild
rush test             # Run all tests
rush cover            # Tests with coverage
rush lint             # ESLint all packages
rush clean            # Clean build outputs
rush extract-api      # Update common/api/*.api.md (required before committing API changes)
rush change           # Generate changelog entry (required before pushing)

# Single package (faster for local dev)
cd core/backend
rushx build / rushx test / rushx lint
```

Build output: dual CJS (`lib/cjs/`) and ESM (`lib/esm/`) per package.

## Running a Single Test

Packages use either **Mocha** (older) or **Vitest** (newer) — check `devDependencies` to identify which.

- **Mocha**: `rushx build && mocha lib/cjs/**/YourFile.test.js`; filter with `.only` on `describe`/`it`
- **Vitest**: `rushx build && rushx test`; filter with `.only` or edit `vitest.config.mts` `include` array
- VS Code: Use the debug configurations in `.vscode/launch.json`; Vitest extension works for Vitest packages

**Always `rushx build` before running Mocha tests** — it tests compiled output, not source.

Never commit `.only` — CI enforces `forbidOnly`.

## Three-Tier Architecture

```
core/common   ← shared types, interfaces, RpcInterface (no platform deps)
core/frontend ← browser visualization; RPC clients; IModelConnection facade
core/backend  ← Node.js services; native bindings (@bentley/imodeljs-native); RPC/IPC host
```

Cross-boundary communication:
- **RPC**: Web apps; extend `RpcInterface` from `@itwin/core-common`; frontend/backend deploy independently — **never change RPC signatures**
- **IPC**: Electron/mobile; stateful connections via `IpcHost`/`IpcSession`

`IModelConnection` in `core/frontend` is the main facade for iModel data access (sub-managers: `.models`, `.elements`, `.views`, `.tiles`, etc.). Do not call RPC interfaces directly — use wrapper classes.

## API Stability — Critical Rules

Every exported symbol **must** have a TSDoc release tag:

| Tag | Constraint |
|---|---|
| `@public` | Backward-compatible only; breaking changes require major release + team approval |
| `@beta` | May change; requires changelog + migration docs |
| `@alpha` | Experimental; may change freely |
| `@internal` | Not in API surface; never import from internal barrels outside `cross-package.ts` |

**Before any public API change**: run `rush extract-api`, review `common/api/*.api.md` diffs. Additions are non-breaking; removals/renames/signature changes are breaking.

Deprecation format (pipeline auto-adds date, **do not add it manually**):
```typescript
/** @deprecated Use NewClass instead. */
/** @deprecated in 4.5.0. Use NewClass instead. */
```

## Version Policy

All published packages use **lockstep versioning** — versions sync automatically. **Never manually edit internal dependency versions in `package.json`.**

When running `rush change` non-interactively, always use bump type `"none"` in the generated JSON.

## Code Organization

- `src/internal/` — non-public implementation; inter-package internal APIs go in `src/internal/cross-package.ts` with comments naming consuming packages
- ESLint rule `@itwin/no-internal-barrel-imports` enforces internal boundaries (tests may disable it)
- Use relative imports within a package, never `@itwin/package-name` self-imports
- Do not import from barrel files (`index.ts`) in Vitest tests — breaks mocking

Shared ESLint config: `common/config/eslint/` (flat config format). Custom rules from `@itwin/eslint-plugin`.

## PR / Commit Checklist

1. `rush build && rush cover && rush lint`
2. `rush clean && rush build && rush extract-api` — commit `common/api/*.api.md` changes
3. `rush change` — commit generated JSON in `common/changes/@itwin/`
4. For breaking changes or significant features: update `docs/changehistory/NextVersion.md` with migration examples using `[ClassName]($package)` link syntax
5. Branch naming: `<gh_username>/<descriptive-name>` (lowercase, dashes)
6. PR descriptions must include a `## Validation` section (targeted verification + known baseline issues)
7. Backports: title `[release/X.X.x] Description` + `@Mergifyio backport release/X.X.x`

## Dependency Management

- **External deps**: edit `package.json` version range → `rush check` (verify consistency) → `rush update`
- **Internal dep versions**: never manually edit — CI auto-updates them
- **Broken node_modules**: `rush update --purge` (re-installs everything cleanly)

## Documentation Code Snippets

Snippets are extracted from live, tested code in `src/test/example-code/` and referenced in markdown via `[[include:SnippetName]]`:

```typescript
// __PUBLISH_EXTRACT_START__ SnippetName
// code to extract
// __PUBLISH_EXTRACT_END__
```

Run `rushx docs` in a package to build TypeDoc; `rush docs` for all packages.

## Key Reference Files

- `rush.json` — full package list and paths
- `common/config/rush/version-policies.json` — lockstep config
- `common/api/*.api.md` — generated API signatures
- `CONTRIBUTING.md` — contribution workflow and FAQ
- `.github/copilot-instructions.md` — extended development guide

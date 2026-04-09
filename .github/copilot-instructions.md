# iTwin.js Development Guide

## ⚠️ Production Codebase - Breaking Changes Policy

**This is a production codebase used by critical infrastructure applications worldwide. Breaking changes impact real projects.**

### API Stability Guarantees

- **`@public`** APIs: **MUST maintain backward compatibility**. Breaking changes only allowed in major version releases
- **`@beta`** APIs: May change but require changelog documentation and migration guidance
- **`@alpha`** APIs: Experimental, may change freely but should be clearly marked
- **`@internal`** APIs: Private implementation, not exposed in API surface

### Before Making ANY Public API Changes

1. **Check the API tag** - Is it `@public`, `@beta`, `@alpha`, or `@internal`?
2. **Run `rush extract-api`** - This generates/updates `common/api/*.api.md` files that track ALL API changes
3. **Review the diff** - Any changes to `@public` APIs in `.api.md` files are breaking changes unless they're additions
4. **Consider alternatives**: Can you add new APIs instead of modifying existing ones? Can you deprecate first?
5. **Document in changelog** - Run `rush change` and explain the breaking change and migration path

### What Constitutes a Breaking Change

- Removing or renaming public classes, interfaces, functions, properties, or methods
- Changing function signatures (parameters, return types)
- Changing property types
- Making required parameters out of optional ones
- Changing class inheritance hierarchies
- Modifying RPC interface contracts (these MUST be backward compatible - frontend/backend deploy independently)

## Architecture Overview

iTwin.js is a **monorepo** containing TypeScript packages for creating Infrastructure Digital Twins. The architecture follows a strict **three-tier separation**:

- **`core/common`**: Shared types, interfaces, and utilities used by both frontend and backend
- **`core/frontend`**: Browser-based visualization (`@itwin/core-frontend`) - depends on common packages only
- **`core/backend`**: Node.js services (`@itwin/core-backend`) - includes native bindings via `@bentley/imodeljs-native`

**Cross-boundary communication** uses:

- **RPC (Remote Procedure Call)**: For web apps with loosely-coupled frontend/backend over HTTPS. Classes extend `RpcInterface` from `@itwin/core-common`
- **IPC (Inter-Process Communication)**: For tightly-coupled Electron/mobile apps with stateful connections

### Packages

See `rush.json` for the full list of packages and their paths. Key structural areas: `core/` (frontend, backend, common, geometry), `domains/`, `presentation/`, `editor/`, `extensions/`, `tools/`, `ui/`, `utils/`.

Documentation code examples live in `example-code/` using extract markers (`__PUBLISH_EXTRACT_START__`/`__PUBLISH_EXTRACT_END__`) referenced in docs via `[[include:ExampleName]]`.

## Rush Monorepo Workflow

### Build & Test Commands

```bash
# Initial setup
rush install          # Install all dependencies (use after git pull)
rush build            # Incremental build (only changed packages)
rush rebuild          # Full rebuild of all packages
rush test             # Run all tests
rush cover            # Run tests with coverage
rush lint             # Run ESLint across all packages
rush clean            # Clean build outputs

# Single package workflow (faster for local development)
cd core/backend
rushx build           # Build this package only
rushx test            # Test this package only
rushx lint            # Lint this package only
```

**Important**: The root `package.json` scripts intentionally fail - always use `rush` commands at repo root or `rushx` in package directories.

### API Management

Before committing API changes:

```bash
rush extract-api      # Update API signature files in common/api/*.api.md
```

API changes require:

1. Updating `common/api/<package>.api.md` files via `rush extract-api`
2. Adding appropriate TSDoc tags (`@public`, `@beta`, `@alpha`, `@internal`)
3. Running `rush change` to create changelog entries

### Version Policy

All published packages use **lockstep versioning** (`prerelease-monorepo-lockStep` policy). Versions are automatically synchronized across packages - do NOT manually edit internal dependency versions in `package.json`.

When generating a changelog non-interactively with `rush change`, always use bump type `"none"` in the generated change file. In this lockstep monorepo, version bumps are coordinated separately and changelog entries should not choose per-package bump types like `"patch"` or `"minor"`.

## Testing

### Mocha vs Vitest

- **Mocha**: Older packages (check `devDependencies` for `mocha`)

  - Config: `.mocharc.json` or `package.json` `mocha` section
  - Run: `rushx test` or use VS Code "Run and Debug" tasks
  - Filter: Add `.only` to `describe()` or `it()` calls
  - **Important**: After modifying source code, run `rushx build` before `rushx test` to compile changes

- **Vitest**: Newer packages (check `devDependencies` for `vitest`)
  - Config: `vitest.config.mts` in package root
  - Run: If the user has the Vitest extension installed, use VS Code's integrated test framework to run tests. Otherwise, use `rushx test` or VS Code "Run and Debug" tasks
  - Browser tests: Some packages use `browser: { provider: "playwright" }` for frontend testing

### Test Conventions

- Test files: `*.test.ts` in `src/test/` directories
- Use custom VS Code debug configurations from `.vscode/launch.json`
- CI builds enforce `forbidOnly` - never commit `.only` to master

## Code Organization Patterns

**Every exported symbol MUST have a release tag** (`@public`, `@beta`, `@alpha`, `@internal`). Missing tags will fail `rush extract-api`.

### Internal/Cross-Package Exports

Packages use `src/internal/` directories for non-public implementation. Inter-package internal APIs are curated in `src/internal/cross-package.ts` files with inline comments documenting which sibling packages consume them. The ESLint rule `@itwin/no-internal-barrel-imports` enforces this boundary — do not import from internal barrels outside of `cross-package.ts`.

### ESLint Configuration

Shared ESLint configs live at `common/config/eslint/` (flat config format). Packages reference these centrally via their lint scripts. Custom rules come from `@itwin/eslint-plugin` (e.g., `@itwin/no-internal-barrel-imports`, deprecation policy enforcement).

### CI Pipelines

- GitHub Actions workflows: `.github/workflows/`
- Azure Pipelines configs: `common/config/azure-pipelines/`

## Documentation

### Change History Documentation

When making **breaking API changes** or adding significant new features, update `docs/changehistory/NextVersion.md`:

1. Add an appropriate section following the structure of existing version files in `docs/changehistory/`
2. Include:
  - Clear description of the change and its impact
  - Migration examples showing "before" and "after" code if applicable
  - Links to relevant API documentation using `($package)` syntax (e.g., `[QuantityFormatter]($frontend)` where $frontend expands to the package documentation)
  - Any configuration or setup changes required
3. Use similar writing style and formatting as other `.md` files in the `changehistory` folder
4. For breaking changes, provide explicit migration guidance with code examples

### TSDoc Comments

All public APIs must include TSDoc comments with:
- Release tags (`@public`, `@beta`, `@alpha`, `@internal`)
- Brief description of purpose
- `@param` tags for all parameters
- `@returns` tag for return values
- `@throws` tag for exceptions
- `@deprecated` tag with migration guidance for deprecated APIs

### Deprecation Format

When adding `@deprecated` tags, follow these formats - **do NOT manually add dates** (the pipeline automatically adds them):

```typescript
// Basic deprecation with description only:
/** @deprecated Use NewClass instead. */

// With version (pipeline will auto-add date):
/** @deprecated in 4.5.0. Use NewClass instead. */
```

Valid formats recognized by the ESLint rule:
- `@deprecated {description}` - Description only (5+ characters required)
- `@deprecated in {major}.{minor}.{patch}. {description}` - With version number
- Description must start with alphanumeric character, `]`, or backtick
- Description should be capitalized and separated by `. ` when version/date present


## Pull Request Workflow

1. Branch naming: `<gh_username>/<descriptive-name>` (lowercase, dash-separated)
2. Make changes and test locally: `rush build && rush cover && rush lint`
3. Update API signatures: `rush extract-api` (after `rush clean && rush build`)
4. Add changelog: `rush change` (creates JSON files in `common/changes/@itwin/`)
5. **For breaking changes or major features**: Update `docs/changehistory/NextVersion.md` with migration guidance
6. Commit changelog files and documentation changes with your code
7. For backports: Title PR with `[release/X.X.x] Description` and use `@Mergifyio backport release/X.X.x`

**Critical**: Always run `rush extract-api` and `rush change` before pushing - CI will fail otherwise.

## Build Tools

TypeScript compilation outputs dual format: CJS in `lib/cjs/`, ESM in `lib/esm/`.

## Common Patterns

## Don't Do This

### Critical - Breaking Changes

- ❌ **NEVER modify `@public` APIs without team approval** - impacts production applications
- ❌ **Don't remove or rename public APIs** - deprecate first with `@deprecated` tag and migration path
- ❌ **Don't change RPC interface signatures** - backend and frontend deploy independently
- ❌ **Don't change database schemas without migration strategy** - existing iModels depend on them
- ❌ **Don't skip `rush extract-api`** - it tracks API changes and will fail CI if not run

### Development Practices

- ❌ Don't use `npm install` or `pnpm install` directly - use `rush install`
- ❌ Don't manually update lockstep package versions in `package.json`
- ❌ Don't commit `.only` in test files
- ❌ Don't import from barrel files (`index.ts`) in tests when using Vitest (breaks mocking)
- ❌ Don't call RPC interfaces directly in new code - use wrapper classes like `IModelConnection`
- ❌ Don't make "chatty" RPC interfaces - batch operations and use pagination
- ❌ Don't use absolute imports for modules within the same package - always use relative paths (e.g., `import { MyClass } from "./MyClass"` instead of `import { MyClass } from "@itwin/package-name"`)
- ❌ Don't manually add dates to `@deprecated` tags - the pipeline adds them automatically
- ✅ **DO write tests for new source code** - aim for comprehensive test coverage of new features and bug fixes

## Key Files to Reference

- `rush.json`: Monorepo structure and project list
- `common/config/rush/version-policies.json`: Version lockstep configuration
- `common/api/*.api.md`: Generated API signatures (updated via `rush extract-api`)
- `CONTRIBUTING.md`: Detailed contribution workflow and FAQ

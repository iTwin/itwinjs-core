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

### Documentation and Code Examples

The **`example-code/`** directory contains tested code snippets that are automatically extracted into documentation:

- Code examples are marked with special comment blocks: `// __PUBLISH_EXTRACT_START__ ExampleName` and `// __PUBLISH_EXTRACT_END__`
- Documentation markdown files reference these extracts using `[[include:ExampleName]]` syntax, wrapped inside a multi-line code block
- This ensures documentation code examples stay in sync with tested, working code

**When generating documentation**: Instead of hardcoding code blocks in markdown files, consider suggesting the user create extraction blocks and reference them in documentation. This maintains consistency and ensures examples remain testable and up-to-date.

### Core Packages

**Foundation (Common to Frontend & Backend):**

- **`@itwin/core-bentley`** (`core/bentley/`): Low-level utilities, logging, events, Id64, GUIDs, and common data structures
- **`@itwin/core-common`** (`core/common/`): Shared types, RPC interfaces, element/model props, rendering definitions
- **`@itwin/core-geometry`** (`core/geometry/`): Computational geometry library (curves, surfaces, solids, transformations)
- **`@itwin/core-quantity`** (`core/quantity/`): Quantity formatting and parsing (units, conversions, display)
- **`@itwin/core-i18n`** (`core/i18n/`): Internationalization and localization support
- **`@itwin/core-orbitgt`** (`core/orbitgt/`): Point cloud and reality data processing

**Backend Packages:**

- **`@itwin/core-backend`** (`core/backend/`): Node.js services - IModelDb, elements, models, schemas, native bindings
- **`@itwin/core-electron`** (`core/electron/`): Electron-specific utilities (ElectronHost, IPC, window management)
- **`@itwin/core-mobile`** (`core/mobile/`): Mobile platform utilities (iOS/Android RPC, authentication)
- **`@itwin/express-server`** (`core/express-server/`): Express web server utilities for backend services
- **`@itwin/ecschema-locaters`** (`core/ecschema-locaters/`): Schema location and loading on backend <!-- Note: "locaters" is the correct package name, even though "locators" is the standard spelling. -->
- **`@itwin/ecschema-editing`** (`core/ecschema-editing/`): Schema creation and modification APIs

**Frontend Packages:**

- **`@itwin/core-frontend`** (`core/frontend/`): Browser-based visualization - IModelConnection, ViewState, Viewport, rendering
- **`@itwin/frontend-devtools`** (`core/frontend-devtools/`): Developer tools UI for debugging and diagnostics
- **`@itwin/frontend-tiles`** (`extensions/frontend-tiles/`): Advanced tile loading and caching strategies
- **`@itwin/webgl-compatibility`** (`core/webgl-compatibility/`): WebGL feature detection and compatibility checks
- **`@itwin/core-markup`** (`core/markup/`): SVG-based markup creation and editing for viewports
- **`@itwin/hypermodeling-frontend`** (`core/hypermodeling/`): 2D/3D drawing sheet integration

**Schema & Metadata:**

- **`@itwin/ecschema-metadata`** (`core/ecschema-metadata/`): EC (Entity-Class) schema management for BIS
- **`@itwin/ecsql-common`** (`core/ecsql/common/`): ECSQL query types and interfaces
- **`@itwin/ecschema-rpcinterface-common`** (`core/ecschema-rpc/common/`): RPC interfaces for schema access
- **`@itwin/ecschema-rpcinterface-impl`** (`core/ecschema-rpc/impl/`): Backend implementation of schema RPC

**Extension & Plugin System:**

- **`@itwin/core-extension`** (`core/extension/`): Extension loading and lifecycle management

**Domain Packages:**

- **`@itwin/analytical-backend`** (`domains/analytical/backend/`): Analytical modeling domain
- **`@itwin/linear-referencing-backend`** (`domains/linear-referencing/backend/`): Linear referencing for infrastructure
- **`@itwin/linear-referencing-common`** (`domains/linear-referencing/common/`): Linear referencing shared types
- **`@itwin/physical-material-backend`** (`domains/physical-material/backend/`): Physical material properties

**Presentation Layer:**

- **`@itwin/presentation-common`** (`presentation/common/`): Rule-driven UI presentation (shared types)
- **`@itwin/presentation-backend`** (`presentation/backend/`): Presentation rules processing on backend
- **`@itwin/presentation-frontend`** (`presentation/frontend/`): Presentation data consumption on frontend

**Editing:**

- **`@itwin/editor-common`** (`editor/common/`): Interactive editing shared types
- **`@itwin/editor-backend`** (`editor/backend/`): Element editing operations on backend
- **`@itwin/editor-frontend`** (`editor/frontend/`): Interactive editing tools and UI

**Build & Testing Tools:**

- **`@itwin/build-tools`** (`tools/build/`): Build scripts, API extraction, documentation generation
- **`@itwin/certa`** (`tools/certa/`): Full-stack test runner (Mocha + Chrome/Electron)
- **`@itwin/perf-tools`** (`tools/perf-tools/`): Performance measurement and profiling
- **`@itwin/ecschema2ts`** (`tools/ecschema2ts/`): Generate TypeScript from EC schemas

**UI Abstractions:**

- **`@itwin/appui-abstract`** (`ui/appui-abstract/`): Abstract UI component definitions

**Utilities:**

- **`@itwin/workspace-editor`** (`utils/workspace-editor/`): Workspace and settings management

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

### Class Registration

Backend entities use registration pattern:

```typescript
// In Entity subclass
public static override get className() { return "MyEntity"; }
ClassRegistry.register(MyEntity, MyEntity.schema);
```

### TSDoc Release Tags

Use release tags consistently - **these determine API stability contracts**:

- **`@public`**: Stable public API with strong backward compatibility guarantees. Breaking changes ONLY in major releases
- **`@beta`**: Public but may change in minor releases. Requires migration documentation
- **`@alpha`**: Experimental API, may change or be removed. Use with caution
- **`@internal`**: Private implementation details, not part of API surface, excluded from docs
- `@packageDocumentation`: Module-level documentation

**Every exported symbol MUST have a release tag.** Missing tags will fail the `rush extract-api` check.

### ECSchema and BIS

iTwin.js uses **EC (Entity-Class)** schemas based on BIS:

- Schema classes in `core/ecschema-metadata`
- Backend locators in `core/ecschema-locators`
- Schemas define Elements, Aspects, Relationships, and Models
- Elements inherit from `Element` base class with required properties: `classFullName`, `code`, `model`

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

- **`@itwin/build-tools`**: Custom build utilities (`betools` commands)
  - `betools extract-api`: Generate API reports
  - `betools docs`: Generate TypeDoc documentation
- **`@itwin/certa`**: Custom test runner for full-stack tests (Mocha wrapper with Chrome/Electron support)
- TypeScript compilation: Dual output (CJS in `lib/cjs/`, ESM in `lib/esm/`)

## Common Patterns

### IModelConnection (Frontend) ↔ IModelDb (Backend)

Frontend uses `IModelConnection` (from `@itwin/core-frontend`) to interact with backend `IModelDb` (from `@itwin/core-backend`) via RPC interfaces like `IModelReadRpcInterface`.

### Element Querying

Use ECSQL (ECMAScript SQL dialect) via:

- Backend: `IModelDb.createQueryReader()` or `ECSqlStatement`
- Frontend: `IModelConnection.createQueryReader()`

### Geometry Handling

`@itwin/core-geometry` provides immutable geometry classes:

- `Point3d`, `Vector3d`, `Range3d` for basic types
- `CurvePrimitive`, `SolidPrimitive` for complex shapes
- Use static methods for construction, avoid mutation

## Debugging Tips

1. Use VS Code launch configurations (`.vscode/launch.json`) for package-specific debugging
2. For frontend tests in browser: Check `vitest.config.mts` for browser provider settings
3. For RPC debugging: Enable `RpcConfiguration.developmentMode = true`
4. Native debugging: `@bentley/imodeljs-native` requires Node.js with N-API support

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
- ✅ **DO write tests for new source code** - aim for comprehensive test coverage of new features and bug fixes

## Key Files to Reference

- `rush.json`: Monorepo structure and project list
- `common/config/rush/version-policies.json`: Version lockstep configuration
- `common/api/*.api.md`: Generated API signatures (updated via `rush extract-api`)
- `CONTRIBUTING.md`: Detailed contribution workflow and FAQ

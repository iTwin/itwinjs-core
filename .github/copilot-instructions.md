# iTwin.js Core - AI Coding Agent Instructions

## Project Overview

iTwin.js is a TypeScript monorepo for creating, querying, and displaying Infrastructure Digital Twins. The codebase follows a **frontend-backend architecture** with RPC communication, built using [Rush](http://rushjs.io/) for monorepo management.

### Key Architecture Layers

- **`core/bentley`**: Foundation utilities (no dependencies on other iTwin packages)
- **`core/geometry`**: Computational geometry (depends only on bentley)
- **`core/common`**: Shared types/interfaces between frontend and backend
- **`core/backend`**: Node.js backend with native library access via `@bentley/imodeljs-native`
- **`core/frontend`**: Browser/Electron frontend with WebGL rendering
- **Domains**: Domain-specific packages (analytical, linear-referencing, physical-material)
- **Presentation**: Data presentation layer with backend/frontend/common split
- **Editor**: Editing tools with backend/frontend/common split

### Critical Data Flow Pattern

Frontend ↔️ RPC Interface ↔️ Backend interaction is central:

```typescript
// Frontend calls backend via RPC
const client = RpcManager.getClientForInterface(SomeRpcInterface);
const result = await client.someMethod(params);

// Backend implements RPC
export class SomeRpcImpl extends SomeRpcInterface {
  public async someMethod(params: Params): Promise<Result> {
    // Implementation
  }
}
```

**Key points:**

- RPC interfaces are defined in `*-common` packages
- Implementations are in `*-backend` packages
- Clients are consumed in `*-frontend` packages
- Always version RPC interfaces (see `@beta` decorators below)

### iModel Connection Patterns

Three main connection types with distinct use cases:

```typescript
// 1. CheckpointConnection - Readonly remote iModel checkpoint
const checkpoint = await CheckpointConnection.openRemote(iTwinId, iModelId);

// 2. SnapshotConnection - Local read-only snapshot file
const snapshot = await SnapshotConnection.openFile(filePath);

// 3. BriefcaseConnection - Editable briefcase with change tracking
const briefcase = await BriefcaseConnection.openFile(briefcaseProps);
```

**Backend equivalents:**

- `SnapshotDb.openFile()` / `SnapshotDb.openCheckpoint()` - Readonly operations
- `BriefcaseDb.open()` - Editable with changeset support

Always close connections: `await connection.close()`

## Build & Development Workflow

### Essential Commands

```bash
# Initial setup (required after git clone or pull)
rush install              # Install dependencies (uses pnpm)
rush build               # Incremental build of changed packages
rush rebuild             # Full rebuild of all packages

# Development workflow
rush build               # Build changed packages only
rush test                # Run all tests
rush cover               # Run tests with coverage
rush lint                # Lint all packages
rush clean               # Clean build artifacts

# Package-specific (faster for isolated work)
cd core/frontend
rushx build             # Build only this package
rushx test              # Test only this package
rushx cover             # Test with coverage
rushx lint              # Lint this package
```

### Making Changes

1. Branch naming: `<username>/descriptive-name` (all lowercase, dash-separated)
2. Make changes and build: `rush build`
3. Update API signatures if public APIs changed: `rush extract-api`
   - Must run `rush clean && rush build` first for accurate extraction
   - Review diffs in `common/api/*.api.md` files
4. Add changelog entry: `rush change`
   - Only for published packages and public API changes
   - CI will fail if this step is skipped
5. Commit and push

### Monorepo Structure Details

- Each package has **independent** `node_modules` with symlinks managed by Rush
- Use `rushx` instead of `npm run` for package scripts
- TypeScript configs extend from `@itwin/build-tools/tsconfig-base.json`
- All packages output to `lib/cjs` (CommonJS) and `lib/esm` (ES Modules)

## Testing Conventions

### Test Framework by Package

- **Mocha**: `core/backend`, `presentation/*`, `full-stack-tests/*`
- **Vitest**: `core/frontend`, `core/bentley`, `core/geometry`, `core/common`

### Mocha Test Pattern

```typescript
import { expect } from "chai";
import * as sinon from "sinon";

describe("ComponentName", () => {
  let component: ComponentType;

  before(async () => {
    // One-time setup for entire suite
    await IModelHost.startup();
  });

  after(async () => {
    // One-time cleanup
    await IModelHost.shutdown();
  });

  beforeEach(() => {
    // Setup before each test
    component = new ComponentType();
  });

  afterEach(() => {
    // Cleanup after each test
    sinon.restore();
  });

  it("should do something", () => {
    expect(component.value).to.equal(expected);
  });
});
```

### Vitest Test Pattern

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("ComponentName", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("should do something", () => {
    expect(component.value).toBe(expected);
  });
});
```

### Full-Stack Test Pattern

```typescript
// Backend setup in full-stack-tests/*/src/backend
await IModelHost.startup({ cacheDir });
RpcManager.registerImpl(SomeRpcInterface, SomeRpcImpl);

// Frontend setup in full-stack-tests/*/src/frontend
await IModelApp.startup();
RpcManager.initializeClient({}, [SomeRpcInterface]);
```

## API Documentation Standards

Use JSDoc tags to document API surface:

- `@public` - Public stable API
- `@beta` - Public but may change before stable
- `@alpha` - Experimental, likely to change
- `@internal` - Internal only, not part of public API
- `@deprecated in X.X` - Marked for removal (include removal timeline)

Example:

```typescript
/**
 * Opens a checkpoint connection to an iModel.
 * @param iTwinId - The iTwin GUID
 * @param iModelId - The iModel GUID
 * @returns A promise resolving to the connection
 * @public
 */
export async function openCheckpoint(
  iTwinId: string,
  iModelId: string
): Promise<CheckpointConnection>;
```

**Critical:** Changes to `@public` or `@beta` APIs require running `rush extract-api` and updating changelog with `rush change`.

## Common Patterns & Conventions

### Error Handling

```typescript
import { IModelError, IModelStatus } from "@itwin/core-common";

// Throw typed errors
throw new IModelError(IModelStatus.NotFound, "Element not found");

// Check for specific errors
if (
  error instanceof IModelError &&
  error.errorNumber === IModelStatus.NotFound
) {
  // Handle not found
}
```

### Async Patterns

Prefer async/await over promises. Most APIs are async:

```typescript
// Good
const element = await iModel.elements.getElement(id);

// Avoid
iModel.elements.getElement(id).then(element => { ... });
```

### Logging

```typescript
import { Logger, LogLevel } from "@itwin/core-bentley";

Logger.logError("MyCategory", "Error message", () => ({ detail: value }));
Logger.logWarning("MyCategory", "Warning", () => metadata);
Logger.logInfo("MyCategory", "Info", () => metadata);
Logger.logTrace("MyCategory", "Trace", () => metadata);
```

### Working with IDs

Use `Id64String` type for element IDs:

```typescript
import { Id64, Id64String } from "@itwin/core-bentley";

const id: Id64String = "0x123";
if (Id64.isValidId64(id)) {
  // Valid ID
}
```

## Important Files & Locations

- `rush.json` - Monorepo configuration and package list
- `common/api/*.api.md` - Generated API signatures (don't edit manually)
- `common/changes/@itwin/*.json` - Changelog entries (generated by `rush change`)
- `.vscode/launch.json` - Debug configurations for VSCode
- `CONTRIBUTING.md` - Detailed contribution guidelines
- Package-specific:
  - `package.json` - Dependencies and scripts
  - `tsconfig.json` - TypeScript configuration
  - `vitest.config.mts` or `.mocharc.json` - Test configuration

## RPC Interface Design Best Practices

1. **Version each interface** - Use `static interfaceVersion = "X.Y.Z"`
2. **Chunky not chatty** - Minimize round trips, batch operations
3. **Use paging for large results** - Always paginate with `limit`/`offset`
4. **Stateless operations** - No server-side state between requests
5. **Include authorization** - Every request carries auth credentials

See: `docs/learning/backend/BestPractices.md`

## When Editing Existing Code

- Preserve existing code style and patterns
- Maintain API compatibility for `@public` APIs
- Add `@deprecated` with timeline rather than breaking changes
- Update tests alongside code changes
- Run `rush lint` to ensure style compliance

## Debugging Tests

**Mocha tests:** Add `.only` to `describe()` or `it()` to run specific tests:

```typescript
describe.only("MyComponent", () => { ... });
it.only("specific test", () => { ... });
```

**Vitest tests:**

1. Use `.only` modifier like Mocha
2. Or edit `vitest.config.mts` and set `include: ["**/MyFile.test.ts"]`
3. Or use Vitest Explorer VSCode extension

VSCode launch configurations in `.vscode/launch.json` attach debuggers for each package.

## Key Dependencies

- `@bentley/imodeljs-native` - Native C++ bindings (backend only)
- `@itwin/core-bentley` - Foundation utilities
- `@itwin/core-geometry` - Geometry library
- RPC communication over HTTP for web, IPC for Electron/mobile

## Notes for AI Agents

- This is a **mature, production codebase** - breaking changes require careful consideration
- API surface is carefully versioned - respect `@public`, `@beta`, `@alpha` tags
- Tests are required for all changes to core functionality
- Backend and frontend code **never** directly import each other - use RPC/IPC interfaces
- Rush is non-negotiable - never use `npm install` directly (it will break)
- When in doubt about patterns, search for similar code: `grep -r "pattern" core/*/src`

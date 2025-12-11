# iTwin.js Development Guide

## Architecture

iTwin.js is a **Rush monorepo** with strict separation:
- **`core/common`**: Shared types/interfaces for frontend and backend
- **`core/frontend`**: Browser visualization (`IModelConnection`, `ViewState`, `Viewport`)
- **`core/backend`**: Node.js services (`IModelDb`, native bindings)

**Communication**: RPC for web apps (classes extend `RpcInterface`), IPC for Electron/mobile

**Documentation**: Use `// __PUBLISH_EXTRACT_START__ Name` / `// __PUBLISH_EXTRACT_END__` in `example-code/` and reference with `[[include:Name]]` in markdown

## Rush Commands

```bash
rush install          # After git pull
rush build            # Incremental build
rush test             # Run tests
rush lint             # Run ESLint

# Per-package (in package directory):
rushx build
rushx test
```

**Never use npm/pnpm directly - always use `rush` at root or `rushx` in packages.**

## Testing

**Mocha** (older packages): Run `rushx build` then `rushx test`. Use `.only` for filtering (don't commit).
**Vitest** (newer packages): Check `vitest.config.mts`, use VS Code test UI or `rushx test`.

Test files: `*.test.ts` in `src/test/`

## TSDoc Tags (Required)

- **`@public`**: Stable API, backward compatible
- **`@beta`**: May change in minor releases
- **`@alpha`**: Experimental
- **`@internal`**: Private, not documented

**Every exported symbol needs a release tag.**

## Deprecation Format

```typescript
/** @deprecated Use NewClass instead. */
/** @deprecated in 4.5.0. Use NewClass instead. */
```

**Don't add dates manually** - pipeline adds them.

## Critical Don'ts

- ❌ Use npm/pnpm directly - always use `rush` or `rushx`
- ❌ Commit `.only` in tests
- ❌ Use absolute imports within same package (use relative: `./MyClass`)
- ✅ **DO write tests** for new code


# Release tags guidelines

iTwin.js uses [release tags](https://api-extractor.com/pages/tsdoc/doc_comment_syntax/#release-tags) to classify individual APIs according to their intended level of support. Consumers of iTwin.js should consult [API support policies](../api-support-policies.md) for an overview. This article provides iTwin.js contributors with guidance on applying release tags.

## Supported tags

Each API in iTwin.js belongs to one of four [API categories](../api-support-policies.md#api-categories).

By default, any API is also usable by extensions, with the exception of APIs exported by `@itwin/core-frontend` and `@itwin/core-common`; these must be explicitly tagged as `@extensions` for inclusion in the `@itwin/core-extension` package's API. The `@extensions` tag may only be applied to `@public` APIs, as verified by a lint rule.

The `@deprecated` tag can be applied to any API to notify users that it may be removed or changed in a breaking way in the future. For `@public` APIs, deprecations must follow our [deprecation policy](../api-support-policies.md#api-deprecation-policy); marking `@beta`, `@alpha`, or `@internal` APIs as deprecated is optional, but recommended for giving users a heads-up.

## Applying release tags

Every API exported from a package must have a release tag. "Nested" APIs like the members of classes, interfaces, namespaces, and enums inherit the release tag of the containing API, but can override it to be more restrictive. For example, a `@beta` class may contain `@alpha` or `@internal` properties, but may not contain any `@public` properties.

Put the release tag by itself on the last line of the documentation comment:

```ts
/** A prepared query against a SQLite database.
 * @public
 */
export interface SqliteStatement { }
```

Add the `@extensions` tag, if relevant, below the release tag:

```ts
/** A prepared query against a SQLite database.
 * @public
 * @extensions
 */
export interface SqliteStatement { }
```

`@internal` APIs should include documentation indicating why the API should not be used outside of itwinjs-core, and what APIs users should use instead:

```ts
/** A LRU cache of prepared SqliteStatements.
 * @see [[prepareSqliteStatement]] to obtain a prepared statement.
 * @internal because it is an internal optimization detail used by prepareSqliteStatement.
 */
export interface SqliteStatementCache { }
```

A deprecated API must specify the minor version of the package in which it became deprecated and what API to use instead, all on one line below the release tag in the following format:

```ts
/** A prepared query against a SQLite database.
 * @public
 * @deprecated in 4.7. Use the more generic [[PreparedStatement]] instead.
 */
export interface SqliteStatement { }
```

`@public` and `@beta` APIs are included in our [public documentation](https://www.itwinjs.org/), so they must include useful user-facing documentation comments. `@alpha` and `@internal` APIs are excluded from public documentation, but you should still document them for the benefit of other contributors (and your future self).

## Choosing appropriate release tags

iTwin.js is a collection of libraries designed to enable application developers. Therefore, the vast majority of the APIs it exposes are intended to be `@public`. However, `@public` APIs are subject to API support policies that limit how they can be changed in future versions of the package. Strive to design forward-compatible APIs using techniques like:

- Defining APIs in terms of `interface`s (behavior and/or data) rather than `class`es (implementation details).
- Adhering to [SOLID](https://en.wikipedia.org/wiki/SOLID) principles.
- Writing functions that accept arguments as a single `object` to which new optional arguments can be added in the future.
- Avoiding exhaustively enumerated types (e.g., string unions or `enum`s) if new types are likely to be added in the future.
- Using the `_implementationProhibited` symbol for interfaces whose implementations should only be acquired from the package defining the interface, enabling new required fields to be added in the future (see, e.g., [WorkspaceDb]($backend)).

When introducing a brand-new API intended for use outside of the itwinjs-core repository, choose `@public` if the API is relatively simple and unlikely to require breaking changes. Otherwise, choose `@beta` to enable the API to evolve in response to feedback, but keep in mind the eventual goal of promoting the API to `@public`.

`@alpha` should almost never be used, except perhaps when collaborating with other itwinjs-core developers on highly experimental API.

`@internal` should only be used for an API that meets one or more of the following criteria:

- Serves as low-level glue between higher-level `@public` APIs (e.g., `BriefcaseLocalValue`)
- Implements a `@public` interface (e.g., the `WorkspaceDbImpl` class that implements the [WorkspaceDb]($backend) interface).
- Exposes aspects of the `iModelJsNative` native library, the entirety of which is implicitly `@internal` and should never be used outside of the `@itwin/core-backend` package (e.g., `IModelDb.nativeDb` is an `iModelJsNative.DgnDb`).
- Is inherently unstable (e.g., `BackendHubAccess`).
- Is inherently error-prone (e.g., `CodeService.close` should not be invoked except when closing an iModel).

`@internal` APIs require special handling, covered in a dedicated section below.

## Internal APIs

`@internal` APIs are a necessary evil. For one reason or another - as described above - an `@internal` API is **not** to be used by - and, ideally, should be completely inaccessible to - code outside of the itwinjs-core repository. Unfortunately, as of iTwin.js 4.x, all `@internal` APIs are technically available for use to any package. The [@itwin/eslint-plugin](https://www.npmjs.com/package/@itwin/eslint-plugin) provides a `no-internal` lint rule that attempts to flag inappropriate usage of `@internal` APIs, but it has had little impact on non-core packages taking dependencies on `@internal` APIs.

A few categories of `@internal` APIs exist:

- Single-package APIs used only within a single package in itwinjs-core - e.g., a function exported by one source file in `@itwin/core-backend` and imported for use in another source file in that same package.
- Cross-package APIs used by multiple packages in itwinjs-core - e.g., a function exported by `@itwin/core-common` and imported for use in `@itwin/core-backend`.
  - A subset of such APIs are cross-package only because they are consumed by non-published packages like test apps or full-stack tests.
- Nested APIs that reside inside another API - e.g., class methods and namespace members.
- Top-level APIs that do not reside inside another API - e.g., functions and classes not defined inside a namespace.

Nested vs top-level and single-package vs cross-package are two orthogonal API categories.

As of iTwin.js 4.8, we are making efforts to reduce and eventually eliminate the visibility of `@internal` APIs outside of the itwinjs-core repository. Each core package's subdirectory will be organized as follows, using `@itwin/core-backend` as an example:

```
  src/
    core-backend.ts
    internal/
      cross-package.ts
      Symbols.ts
      <files containing internal top-level APIs>
    <files containing non-internal top-level APIs>
```

All top-level internal APIs (whether cross-package or single-package) are defined in source files inside `src/internal/` or subdirectories thereof.

All non-internal top-level APIs are defined in source files inside `src/` or subdirectories thereof.

`src/core-backend.ts` is the "barrel" file that defines the package's public API. It should not export any APIs from inside the `src/internal` directory.

`src/internal/cross-package.ts` exports individual top-level cross-package internal APIs from `src/internal/`.

`src/internal/Symbols.ts` defines [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)s that identify nested internal APIs.

When evaluating an existing or new `@internal` API, apply the following policies in order by priority.

1. If the API does not need to be `@internal` - i.e., it does not meet the criteria defined [above](#choosing-appropriate-release-tags) - apply the appropriate release tag instead
1. Convert a nested API to a top-level API, if possible (e.g., a static class method that does not access private members of the class can be converted to a top-level function).
1. Move a top-level API into `src/internal/`
1. A top-level, cross-package API should be exported from `src/internal/cross-package.ts`. Don't export single-package APIs from `cross-package.ts`- they can be imported wthin the package using a relative path.
1. For a nested API that cannot be converted to a top-level API, convert its name to a Symbol using the example below as a guide.

### Converting a nested API

Imagine we have the following `@internal` API that we want to make inaccessible to code outside of itwinjs-core:

```ts
/** @public */
export class Thing {
  /** @internal */
  public close(): void {
    // implementation goes here
  }
}

```

Add to `src/internal/Symbols.ts` the following, if a `_close` symbol doesn't already exist (keeping the list of symbols sorted alphabetically):

```ts
// Create a name for a Symbol incorporating the property name and package name.
function sym(name: string): string {
  return `${name}_core-backend_INTERNAL_ONLY_DO_NOT_USE`;
}

export const _close = Symbol.for(sym("close"));
```

Update `Thing` to rename `close` to use the symbol, and deprecate the existing `close` method:

```ts
/** @public */
export class Thing {
  /** @internal */
  public [_close]: () => void {
    // implementation goes here
  }
  
  /** @internal
   * @deprecated in 4.8. The thing will automatically be closed when it is no longer in use. This API is for internal use only and will soon be removed.
   */
  public close(): void {
    this[_close]();
  }
}
```

Update all callers of `close` in itwinjs-core to use `[_close]` instead.

The symbols in `Symbols.ts` are not exported from `core-backend.ts`, so they are inaccessible to packages outside of itwinjs-core. We preserve the original `@internal` API to avoid introducing a breaking API change for external callers (who should not be using it in the first place). The deprecation tag will warn them to fix their code to remove their dependency on the internal API. If we were reasonably certain no one was depending on the `close` method, we could simply delete it.

### Transition plan

In iTwin.js 5.0, we will be able to begin enforcing the internal API policy without regard for breaking changes.

Currently, iTwin.js publishes both CommonJS modules (`/lib/cjs/`) and ESModules (`/lib/esm/`), which prevents one package from importing a top-level API from another package using a relative path because it can't know which type of module it should import from. Also, some top-level `@internal` APIs are known or suspected to be used by code outside of itwinjs-core.

- In 4.x (using the `core-backend` example above), we will export the contents of `cross-package.ts` from `core-backend.ts`.
- In 5.0, we will standardize on ESModules, allowing, e.g., core-backend to import `InternalApi` from core-common using `import { InternalApi } from "@itwin/core-common/lib/InternalApi";`. We can then delete `cross-package.ts`.

Currently, it's possible for an app to (mis)configure their dependencies such that they end up with multiple versions of single core package - and hence, multiple independent copies of each `Symbol` defined in `Symbols.ts`.
- In 4.x, we use `Symbol.for` to define those symbols so that they are looked up by name in a global registry, preventing duplication.
- In 5.0, we will prohibit taking a dependency on multiple versions of the same core package (which can lead to all sorts of other problems), and switch to using the `Symbol` constructor, which does not register the symbol in the global registry. This will make it impossible for anyone outside the package to look up the symbol by its name.

Some nested `@internal` APIs are known or suspected to be used by code outside of itwinjs-core.

- In 4.x, we will preserve (and deprecate) those APIs in favor of `@internal` APIs identified by `Symbol`s.
- In 5.0, we can delete all of the deprecated `@internal` APIs.

In 5.0, the only APIs tagged as `@internal` should be nested APIs identified by a `Symbol`. Top-level internal APIs will not require a release tag, because they will not be exported from the package's barrel file.

In 5.0, we will attempt to make the internal APIs inside a package's `lib/` folder inaccessible to consumers of the published packages (i.e., outside of itwinjs-core).

## Reviewing release tags

api-extractor produces a summary of all of the API changes included in a pull request. This makes it very easy to identify potential issues with release tags and breaking changes. When reviewing a pull request, consider the following:

- Do the changes contradict our [package versioning policy](../api-support-policies.md#package-versioning-policy) - e.g., by making breaking changes to a `@public` API?
- Do the changes contradict our [API deprecation policy](../api-support-policies.md#api-deprecation-policy) - e.g., by removing a `@public` API that was not previously tagged as `@deprecated`?
- Do the release tags applied to newly-introduced APIs make sense? For example, should an `@alpha` API be marked `@beta` to solicit early feedback to inform its development?
- Do `@internal` APIs conform to the [polices](#internal-apis) above?
- Do `@public` and `@beta` APIs have sufficient user-facing documentation?

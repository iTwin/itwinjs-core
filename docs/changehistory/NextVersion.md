---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [Semantic rebase (beta)](#semantic-rebase-beta)
  - [Electron 40 support](#electron-40-support)
  - [Display](#display)
    - [Batch category display changes](#batch-category-display-changes)
  - [Quantity Formatting](#quantity-formatting)
    - [Updated default engineering lengths in QuantityFormatter](#updated-default-engineering-lengths-in-quantityformatter)
    - [Fix `Quantity.convertTo()` return type to reflect actual behavior](#fix-quantityconvertto-return-type-to-reflect-actual-behavior)
  - [Presentation](#presentation)
    - [Reducing the number of properties that are loaded with content](#reducing-the-number-of-properties-that-are-loaded-with-content)
  - [API deprecations](#api-deprecations)
    - [`logException()`](#logexception)

## Semantic rebase (beta)

A new `useSemanticRebase` option has been added to [IModelHostConfiguration]($backend). When enabled, `pullChanges` can intelligently merge local and incoming changes that involve schema modifications — a scenario where traditional binary changeset merging produces incorrect results.

Instead of requiring an exclusive lock for schema changes, semantic rebase captures local changes as high-level representations (schema XML and instance patches), applies incoming changesets, then re-applies local changes against the updated schema. This allows schema changes to use shared locks, reducing lock contention.

**Limitations:**

- Incompatible schema changes on both sides may cause the rebase to be rejected. To minimize risk, push schema changes promptly and separately from data changes.
- Cannot be used alongside Schema Sync.
- Profile upgrades still require exclusive locks.

## Electron 40 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 40](https://www.electronjs.org/blog/electron-40-0).

Note: with Electron 40, Chromium no longer uses [SwiftShader](https://github.com/google/swiftshader) as an automatic fallback for WebGL. This may cause issues when Electron is run in an environment without a supported GPU. For more information: [Using Chromium with SwiftShader](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md#automatic-swiftshader-webgl-fallback-is-deprecated).

## Display

### Batch category display changes

[Viewport.changeCategoryDisplay]($frontend) now accepts an optional `batchNotify` parameter. When set to `true`, a single notification event is raised after all categories have been added or removed, rather than one event per category. This significantly improves performance when changing the visibility of a large number of categories at once.

```typescript
// Before: each category triggers a separate event, causing poor performance for large sets
viewport.changeCategoryDisplay(categoryIds, true);

// After: a single batch event is raised after all categories are updated
viewport.changeCategoryDisplay(categoryIds, true, undefined, true);
```

The default behavior (`batchNotify = false`) is unchanged, preserving backward compatibility.

Additionally, [ObservableSet]($bentley) now provides `addAll` and `deleteAll` methods for batch mutations, along with corresponding `onBatchAdded` and `onBatchDeleted` events. [CategorySelectorState]($frontend) exposes these via `addCategoriesBatched` and `dropCategoriesBatched`.

## Quantity Formatting

### Updated default engineering lengths in QuantityFormatter

For applications and tools using [QuantityFormatter]($frontend) and [QuantityType]($frontend) APIs, the default engineering length formatting, retrieved via `QuantityType.LengthEngineering` has been updated. Metric engineering lengths now use millimeters with 3 decimal places; imperial engineering lengths use feet with 2 decimal places.

### Fix `Quantity.convertTo()` return type to reflect actual behavior

The `Quantity.convertTo()` method has always returned a valid `Quantity` object since its initial implementation. However, its TypeScript signature incorrectly indicated it could return `undefined` with the type `Quantity | undefined`. This has been corrected to return `Quantity`.

Quantity code that was defensively checking for `undefined` or using non-null assertions (`!`) can now be simplified. TypeScript will no longer warn about possible undefined values when calling this method.

## Presentation

### Reducing the number of properties that are loaded with content

The `Descriptor` class, which describes the content to be loaded, now has a `fieldsSelector` property that allows specifying which fields should be included or excluded in the content. This is useful for cases when only a subset of fields is needed, which can reduce the amount of data that needs to be loaded and processed.

Similarly, the backend's `PresentationManager.getElementProperties` method now accepts an optional `fieldsSelector` parameter, which allows clients to specify which properties should be included or excluded in the response.

Reducing the number of fields that are loaded with content can improve performance, especially for large datasets, by minimizing the amount of data that needs to be transferred and processed.

## API Deprecations

### `logException()`

| **Deprecated**      | **Replacement**          |
| ------------------- | ------------------------ |
| `logException()`    | Use `logError()` instead |

The @itwin/core-bentley logging method for logging exceptions `logException()` was redundant with `logError()` and it was often unclear as to when either should be used. `logException()` ended up just calling logError() but allowed for passing in error objects instead of a message.

A new `logError()` overload is now provided to maintain this functionality, logging errors passed in the same way as `logException()` but also providing the option to provide LoggingMetaData in addition to the error, which `logException()` did not support.

`logException()` will not be removed until the alloted deprecation window has passed, as per our breaking changes policy.
---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [Node.js 24 support](#nodejs-24-support)
  - [Schema table locks for concurrent schema modifications (experimental)](#schema-table-locks-for-concurrent-schema-modifications-experimental)
  - [Frontend](#frontend)
    - [QuantityFormatter](#quantityformatter)
      - [Updated migration guidance from QuantityType to KindOfQuantity](#updated-migration-guidance-from-quantitytype-to-kindofquantity)
  - [Presentation changes](#presentation-changes)
  - [API deprecations](#api-deprecations)
    - [@itwin/presentation-common](#itwinpresentation-common)
  - [Incremental Schema Loading](#incremental-schema-loading)

## Node.js 24 support

In addition to [already supported Node.js versions](../learning/SupportedPlatforms.md#supported-nodejs-versions), iTwin.js now supports [Node.js 24](https://nodejs.org/en/blog/release/v24.11.0).

## Schema table locks for concurrent schema modifications (experimental)

A new locking mechanism has been added to improve concurrency when importing schemas in multi-user scenarios.
Instead of obtaining a full exclusive lock on the file during schema import, we will now distinguish between:

- **Schema table lock** - Used for trivial schema changes (e.g., adding properties or classes) that don't require data transformation. This lock only blocks concurrent schema imports, allowing other users to continue modifying element data.
- **Full schema lock** - Required when schema changes necessitate data transformation.

This feature is exposed through a beta flag in `IModelHostOptions` and needs to be explicitly enabled:

```typescript
IModelHost.startup({
  enableSchemaTableLocks: true
});
```

## Frontend

### QuantityFormatter

The [QuantityFormatter]($frontend) has been updated to use new schema references for KindOfQuantity definitions. This change aligns with the introduction of `DefaultToolsUnits` and `CivilUnits` schemas, providing more appropriate categorization for different types of measurements used in tools and applications.

- **QuantityFormatter**:
  - Internal `QuantityTypeFormatsProvider` has been updated to map to the new schemas
  - Added support for `AecUnits.LENGTH` for engineering-specific length measurements, particularly imperial formatting using fractional precision (e.g 5 ft 1/4 in)

#### Updated migration guidance from QuantityType to KindOfQuantity

For developers using `QuantityType` enum values in their applications, no code changes are required as the mapping to the new schemas is handled internally. However, for domain agnostic tools directly using KindOfQuantity names or implementing custom property descriptions, update your code to reference the new schema names.

For detailed information about the recommended KindOfQuantity to use in your tools and components, including a complete mapping table of measurements to their corresponding KindOfQuantity names and persistence units, see the [Quantity Formatting and Parsing documentation](../learning/quantity/index.md#using-kindofquantities-to-retrieve-formats).
## Presentation changes

- Changed content traversal to have internal state, improving performance when traversing large contents. See [API deprecations for `@itwin/presentation-common`](#itwinpresentation-common) for more details.

## API deprecations

### @itwin/presentation-common

- Deprecated `traverseContent` and `traverseContentItem` in favor of `createContentTraverser` factory function. The change allows caching some state between calls to traverser methods, improving performance when traversing large contents.

  Migration example:

  ```ts
  // before
  traverseContent(myVisitor, content);
  // ... or
  content.contentSet.forEach((item) => traverseContentItem(myVisitor, content.descriptor, item));

  // now
  const traverseContentItems = createContentTraverser(myVisitor, content.descriptor);
  traverseContentItems(content.contentSet);
  // ... or
  const traverseContent = createContentTraverser(myVisitor);
  traverseContent(content.descriptor, content.contentSet);
  ```

## Incremental Schema Loading

*Incremental Schema Loading* support has been added to the backend on `IModelDb` and `IModelConnection` on frontends.

Clients can control how the schemas are loaded through their application context, using the `incrementalSchemaLoading` option when initializing their `IModelHost` or `IModelApp`. By default, incremental schema loading is disabled, so clients have to enable this feature if they want to use it.

Incremental schema loading allows to load a schema partially. Clients can receive their schema and its elements while references and lazy loaded schema elements are loaded in the background.

- Frontend examples:
  ```ts
  await IModelApp.startup({
    incrementalSchemaLoading: "enabled"
  });
  ```
  ```ts
  await IModelApp.startup({
    incrementalSchemaLoading: "disabled"
  });
  ```

- Backend examples:
  ```ts
  await IModelHost.startup({
    incrementalSchemaLoading: "enabled",
  });
  ```
  ```ts
  await IModelHost.startup({
    incrementalSchemaLoading: "disabled",
  });
  ```
---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [Node.js 24 support](#nodejs-24-support)
  - [Frontend](#frontend)
    - [QuantityFormatter](#quantityformatter)
      - [Updated migration guidance from QuantityType to KindOfQuantity](#updated-migration-guidance-from-quantitytype-to-kindofquantity)
  - [Presentation changes](#presentation-changes)
  - [API deprecations](#api-deprecations)
    - [@itwin/presentation-common](#itwinpresentation-common)

## Node.js 24 support

In addition to [already supported Node.js versions](../learning/SupportedPlatforms.md#supported-nodejs-versions), iTwin.js now supports [Node.js 24](https://nodejs.org/en/blog/release/v24.11.0).

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

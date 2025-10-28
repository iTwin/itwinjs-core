---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Changes](#changes)
  - [@itwin/ecschema-metadata](#itwinecschema-metadata)
    - [Enhancements](#enhancements)
  - [@itwin/presentation-common](#itwinpresentation-common)
    - [Additions](#additions)
  - [Electron 39 support](#electron-39-support)

## @itwin/core-quantity

### Changes

- Fixed a bug in [Parser]($quantity) where invalid unit labels were silently ignored during parsing when no format units were specified, leading to incorrect results. Previously, when using a unitless format with input like "12 im" (a typo "in" for inches), the parser would successfully parse it as "12 meters" when the persistence unit was set to meters. The parser now correctly returns `ParseError.UnitLabelSuppliedButNotMatched` when a unitless format is used and a unit label is provided but cannot be matched to any known unit. This fix ensures parsing errors are noticed and properly handled by the caller, preventing silent failures and ensuring data integrity.

## @itwin/ecschema-metadata

### Enhancements

- Enhanced [FormatSet]($ecschema-metadata) interface to support format referencing. The `formats` property now accepts either a `FormatDefinition` or a string reference to another KindOfQuantity, enabling one format to reference another format's definition. This allows for more flexible format management and reduces duplication when multiple KindOfQuantities should share the same format specification.

- Enhanced [FormatSetFormatsProvider]($ecschema-metadata) to support the updated `FormatSet` interface. Please see the [learnings article](../learning/quantity/index.md) for quantity highlighting features and code examples of the provider.

## @itwin/presentation-common

### Additions

- Added `createContentFormatter` factory function that creates a content formatter for formatting `Content` and its contained `Item` objects. The function takes a `propertyValueFormatter` prop that knows how to format individual numeric values based on their kind-of-quantity. Existing `KoqPropertyValueFormatter` can be used for that:

  ```ts
  const contentFormatter = createContentFormatter({
    propertyValueFormatter: new KoqPropertyValueFormatter({
      schemaContext: iModelConnection.schemaContext,
      formatsProvider: IModelApp.formatsProvider,
    }),
    unitSystem: IModelApp.quantityFormatter.activeUnitSystem,
  });
  ```

## Electron 39 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 39](https://www.electronjs.org/blog/electron-39-0).

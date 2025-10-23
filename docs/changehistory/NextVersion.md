---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Changes](#changes)
  - [@itwin/ecschema-metadata](#itwinecschema-metadata)
    - [Enhancements](#enhancements)

## @itwin/core-quantity

### Changes

- Fixed a bug in [Parser]($quantity) where invalid unit labels were silently ignored during parsing when no format units were specified, leading to incorrect results. Previously, when using a unitless format with input like "12 im" (a typo "in" for inches), the parser would successfully parse it as "12 meters" when the persistence unit was set to meters. The parser now correctly returns `ParseError.UnitLabelSuppliedButNotMatched` when a unitless format is used and a unit label is provided but cannot be matched to any known unit. This fix ensures parsing errors are noticed and properly handled by the caller, preventing silent failures and ensuring data integrity.

## @itwin/ecschema-metadata

### Enhancements

- Enhanced [FormatSet]($ecschema-metadata) interface to support format aliasing. The `formats` property now accepts either a `FormatDefinition` or a string reference to another kindOfQuantityId, enabling one format to reference another format's definition. This allows for more flexible format management and reduces duplication when multiple KindOfQuantities should share the same format specification.

- Enhanced [FormatSetFormatsProvider]($ecschema-metadata) with the following capabilities:
  - **String Reference Resolution**: The provider now automatically resolves string references to their target FormatDefinition. When a format references another via string (e.g., `"AecUnits.LENGTH": "RoadRailUnits.LENGTH"`), calling `getFormat("AecUnits.LENGTH")` will resolve and return the actual FormatDefinition from `RoadRailUnits.LENGTH`.
  - **Cascade Notifications**: When adding or removing a format, the `onFormatsChanged` event now includes not only the modified format but also all formats that reference it (directly or indirectly). For example, if `RoadRailUnits.LENGTH` is updated and both `AecUnits.LENGTH` and `LinearAlignment.LENGTH` reference it, all three formats will be included in the `formatsChanged` array, enabling proper cache invalidation.
  - **Fallback Provider Support**: String references can resolve through the optional fallback provider if the target format isn't found in the format set.

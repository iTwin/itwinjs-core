---
publish: false
---
# NextVersion

## @itwin/ecschema-metadata

### Additions

- Added [FormatSetFormatsProvider]($ecschema-metadata) class that implements [MutableFormatsProvider]($quantity) to manage format definitions within a format set. This provider supports adding and removing formats at runtime and automatically updates the underlying format set when changes are made.

### Changes

- Updated [FormatSet]($ecschema-metadata) interface to use [UnitSystemKey]($quantity) type for the `unitSystem` property. This provides better type safety and aligns with the move away from using `activeUnitSystem` in `quantityFormatter`. Looking ahead, tools and components that use formatting APIs can then listen to just the `onFormatsChanged` event from `IModelApp` instead of `quantityFormatter.onActiveUnitSystemChanged`.

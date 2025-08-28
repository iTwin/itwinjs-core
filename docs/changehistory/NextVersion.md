---
publish: false
---
# NextVersion

## @itwin/ecschema-metadata

### Additions

- Added [FormatSetFormatsProvider]($ecschema-metadata) class that implements [MutableFormatsProvider]($quantity) to manage format definitions within a format set. This provider supports adding and removing formats at runtime and automatically updates the underlying format set when changes are made.

### Changes

- Updated  `unitSystem` property to [FormatSet]($ecschema-metadata) interface, which uses [UnitSystemKey]($quantity) type. This will help move APIs away from relying on `activeUnitSystem` in `quantityFormatter`, as they move to the new formatting APIs using `IModelApp.formatsProvider`. Looking ahead, tools and components that use formatting APIs can then listen to just the `onFormatsChanged` event from `IModelApp.formatsProvider` instead of `IModelApp.quantityFormatter.onActiveUnitSystemChanged`.

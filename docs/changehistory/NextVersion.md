---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Sheet prototypes](#sheet-prototypes)

## Backend

### Sheet prototypes

BisCore 01.00.27 graduates `SheetPrototype` and `SheetBorderPrototype` from the `DrawingProductionExperimental` schema. A [SheetPrototype]($backend) is a `DefinitionElement` sub-modeled by a [SheetModel]($backend) containing the template content for new sheets; it records a `scale`, `height`, and `width`, and may reference a [SheetBorderPrototype]($backend), which is sub-modeled by a [DrawingModel]($backend) holding the border graphics. A [Sheet]($backend) created from a prototype records it via the new `Sheet.sheetPrototype` navigation property.

Both classes use `allowedSubModelClasses` to restrict their sub-models, and their `create` methods throw if the iModel's BisCore schema is older than 01.00.27. The corresponding props ([SheetPrototypeProps]($common), [SheetBorderPrototypeProps]($common), `SheetProps.sheetPrototype`) and navigation relationships ([SheetHasSheetPrototype]($backend), [SheetPrototypeHasSheetBorderPrototype]($backend)) are `@beta`.